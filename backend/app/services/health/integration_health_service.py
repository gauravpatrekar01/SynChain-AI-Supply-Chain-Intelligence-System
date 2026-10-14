import asyncio
import os
import socket
import time
import httpx
from copy import deepcopy
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import text, desc, func
from neo4j import GraphDatabase

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.postgres.models import (
    EnterpriseIntegration,
    DataImport,
    ImportedRecord,
    IntegrationHealthCheck,
    Product,
    Supplier,
    Warehouse,
    Inventory,
    Order,
)
from app.integrations import get_adapter
from app.core.security import decrypt_secret


def _safe_user_uuid(uid: Any) -> Optional[uuid.UUID]:
    if isinstance(uid, uuid.UUID):
        return uid
    if isinstance(uid, str):
        try:
            return uuid.UUID(uid)
        except (ValueError, AttributeError):
            return None
    return None


def _format_time_ago(dt: Optional[datetime]) -> str:
    if not dt:
        return "No data recorded"
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    diff = now - dt
    seconds = int(diff.total_seconds())
    if seconds < 0:
        return "Just now"
    if seconds < 60:
        return f"{seconds}s ago"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    return f"{days}d ago"


def _sanitize_error_message(err_str: str) -> str:
    """Strip any potential connection credentials or keys from error strings."""
    if not err_str:
        return "Unknown error"
    # Redact common credential patterns
    import re
    cleaned = re.sub(r"://([^:@]+):([^@]+)@", "://***:***@", err_str)
    cleaned = re.sub(r"(access_token|token|appid|api[_-]?key|key|secret|password)=([^&\s\"'<>]+)", r"\1=***", cleaned, flags=re.I)
    cleaned = re.sub(r"(Bearer\s+)[^\s\"'<>]+", r"\1***", cleaned, flags=re.I)
    cleaned = re.sub(r"nak_live_[a-zA-Z0-9]+", "nak_live_***", cleaned)
    cleaned = re.sub(r"sk-[a-zA-Z0-9_\-]+", "sk-***", cleaned)
    return cleaned[:300]


class IntegrationHealthService:
    CHECK_TIMEOUT_SECONDS = 8.0
    HISTORY_TIMEOUT_SECONDS = 2.0
    CACHE_TTL_SECONDS = 60.0
    _cached_results = {}
    _probe_tasks = {}

    @staticmethod
    def get_data_freshness(db: Session) -> Dict[str, Any]:
        """Calculates freshness of ingested supply chain data."""
        try:
            latest_import = db.query(DataImport).order_by(desc(DataImport.created_at)).first()
            latest_record = db.query(ImportedRecord).order_by(desc(ImportedRecord.created_at)).first()
            
            latest_ts = None
            if latest_record and latest_record.created_at:
                latest_ts = latest_record.created_at
            elif latest_import and latest_import.created_at:
                latest_ts = latest_import.created_at

            return {
                "latest_timestamp": latest_ts,
                "formatted": _format_time_ago(latest_ts) if latest_ts else "No ingested records",
                "total_imports": db.query(DataImport).count(),
                "total_imported_records": db.query(ImportedRecord).count(),
            }
        except Exception:
            db.rollback()
            return {"latest_timestamp": None, "formatted": "Unknown", "total_imports": 0, "total_imported_records": 0}

    @staticmethod
    def get_last_successful_check(db: Session, integration_name: str) -> Optional[datetime]:
        try:
            # Health history belongs to SQL, like the authenticated application.
            # An unavailable optional MongoDB must not delay every provider probe.
            record = (
                db.query(IntegrationHealthCheck)
                .filter(
                    IntegrationHealthCheck.integration_name == integration_name,
                    IntegrationHealthCheck.status == "healthy",
                )
                .order_by(desc(IntegrationHealthCheck.checked_at))
                .first()
            )
            return record.checked_at if record else None
        except Exception:
            db.rollback()
            return None

    @classmethod
    async def check_postgres(cls, db: Session) -> Dict[str, Any]:
        """Performs lightweight check on Neon PostgreSQL database."""
        name = "Neon PostgreSQL"
        category = "database"
        start_time = time.perf_counter()
        
        if not settings.DATABASE_URL:
            return {
                "name": name,
                "category": category,
                "configuration_status": "not_configured",
                "connection_status": "unknown",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": None,
                "response_time_ms": 0.0,
                "last_sync_at": None,
                "error_category": "config_missing",
                "error_message": "DATABASE_URL is not configured",
                "is_enabled": False,
                "data_freshness": "Not configured",
                "details": {},
            }

        try:
            # Lightweight SELECT 1
            result = db.execute(text("SELECT 1")).scalar()
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            
            # Query quick non-blocking metadata
            tables_count = db.execute(
                text("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
            ).scalar() or 0
            
            freshness = cls.get_data_freshness(db)
            last_success = datetime.now(timezone.utc)

            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "healthy" if result == 1 else "degraded",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": last_success,
                "response_time_ms": latency_ms,
                "last_sync_at": freshness["latest_timestamp"],
                "error_category": None,
                "error_message": None,
                "is_enabled": True,
                "data_freshness": freshness["formatted"],
                "details": {
                    "tables_detected": tables_count,
                    "engine": "PostgreSQL (Neon Cloud)",
                    "pool_pre_ping": True,
                    "total_imports": freshness["total_imports"],
                    "total_imported_records": freshness["total_imported_records"],
                },
            }
        except Exception as e:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            last_success = cls.get_last_successful_check(db, name)
            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "unhealthy",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": last_success,
                "response_time_ms": latency_ms,
                "last_sync_at": None,
                "error_category": "database_error",
                "error_message": _sanitize_error_message(str(e)),
                "is_enabled": True,
                "data_freshness": "Unavailable",
                "details": {},
            }

    @classmethod
    async def check_mongodb(cls, db: Session) -> Dict[str, Any]:
        """Performs live health check on MongoDB Atlas cluster."""
        name = "MongoDB Atlas Primary Database"
        category = "database"
        start_time = time.perf_counter()

        if not settings.MONGODB_URL:
            return {
                "name": name,
                "category": category,
                "configuration_status": "not_configured",
                "connection_status": "unknown",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": None,
                "response_time_ms": 0.0,
                "last_sync_at": None,
                "error_category": "config_missing",
                "error_message": "MONGODB_URL is not configured",
                "is_enabled": False,
                "data_freshness": "Not configured",
                "details": {},
            }

        last_success = cls.get_last_successful_check(db, name)
        try:
            from app.core.mongodb import ping_mongo, get_mongo_db
            res = await asyncio.to_thread(ping_mongo)
            if not res.get("ok"):
                raise RuntimeError("MongoDB ping did not report success")
            mongo_db = get_mongo_db()
            colls = await asyncio.to_thread(mongo_db.list_collection_names)
            latency_ms = res["latency_ms"]
            now_dt = datetime.now(timezone.utc)
            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "healthy",
                "last_checked_at": now_dt,
                "last_successful_check_at": now_dt,
                "response_time_ms": latency_ms,
                "last_sync_at": None,
                "error_category": None,
                "error_message": None,
                "is_enabled": True,
                "data_freshness": "Atlas Cluster Operational",
                "details": {
                    "database": settings.MONGODB_DB_NAME or "synchain_db",
                    "collections": colls,
                    "collections_count": len(colls),
                    "ssl": True,
                },
            }
        except Exception as e:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            err_str = str(e)
            error_cat = "connection_error"
            if "TLSV1_ALERT_INTERNAL_ERROR" in err_str or "alert internal error" in err_str:
                error_cat = "ip_access_denied"
                sanitized_msg = "MongoDB Atlas TLS handshake rejected. Verify the server IP is allowed in Atlas Network Access."
            elif "Authentication failed" in err_str or "bad auth" in err_str.lower():
                error_cat = "auth_error"
                sanitized_msg = "MongoDB Atlas credentials rejected (verify username/password)."
            elif "timed out" in err_str.lower() or "timeout" in err_str.lower():
                error_cat = "timeout"
                sanitized_msg = "MongoDB Atlas connection timed out."
            else:
                sanitized_msg = _sanitize_error_message(f"MongoDB Atlas connection failed: {err_str}")

            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "unhealthy",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": last_success,
                "response_time_ms": latency_ms,
                "last_sync_at": None,
                "error_category": error_cat,
                "error_message": sanitized_msg,
                "is_enabled": True,
                "data_freshness": "Unavailable",
                "details": {},
            }

    @classmethod
    async def check_neo4j(cls, db: Session) -> Dict[str, Any]:
        """Performs lightweight check on Neo4j Graph Database."""
        name = "Neo4j Aura Graph Engine"
        category = "graph_database"
        start_time = time.perf_counter()

        if not settings.NEO4J_URI or not settings.NEO4J_USERNAME or not settings.NEO4J_PASSWORD:
            return {
                "name": name,
                "category": category,
                "configuration_status": "not_configured",
                "connection_status": "unknown",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": None,
                "response_time_ms": 0.0,
                "last_sync_at": None,
                "error_category": "config_missing",
                "error_message": "NEO4J_URI, NEO4J_USERNAME, or NEO4J_PASSWORD not configured",
                "is_enabled": False,
                "data_freshness": "Not configured",
                "details": {},
            }

        last_success = cls.get_last_successful_check(db, name)
        try:
            # Run in executor to prevent blocking
            def _test_neo4j_sync():
                driver = GraphDatabase.driver(
                    settings.NEO4J_URI,
                    auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD),
                    connection_timeout=4.0,
                    max_connection_lifetime=30.0,
                )
                try:
                    driver.verify_connectivity()
                    with driver.session(database=settings.NEO4J_DATABASE or "neo4j") as session:
                        result = session.run("RETURN 1 AS val")
                        record = result.single()
                        return record["val"] if record else 1
                finally:
                    driver.close()

            loop = asyncio.get_running_loop()
            val = await asyncio.wait_for(loop.run_in_executor(None, _test_neo4j_sync), timeout=6.0)
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            now_dt = datetime.now(timezone.utc)

            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "healthy",
                "last_checked_at": now_dt,
                "last_successful_check_at": now_dt,
                "response_time_ms": latency_ms,
                "last_sync_at": None,
                "error_category": None,
                "error_message": None,
                "is_enabled": True,
                "data_freshness": "Graph nodes active",
                "details": {"cluster_state": "ONLINE", "database": settings.NEO4J_DATABASE},
            }
        except asyncio.TimeoutError:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "unhealthy",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": last_success,
                "response_time_ms": latency_ms,
                "last_sync_at": None,
                "error_category": "timeout",
                "error_message": "Neo4j Aura connectivity timed out after 6.0s",
                "is_enabled": True,
                "data_freshness": "Unavailable",
                "details": {},
            }
        except Exception as e:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            err_msg = str(e)
            error_cat = "connection_error"
            if "getaddrinfo failed" in err_msg or "DNS" in err_msg or "11001" in err_msg:
                error_cat = "dns_error"
                sanitized_msg = "DNS lookup failed for Neo4j host (instance may be stopped or paused)"
            elif "Authentication" in err_msg or "Unauthorized" in err_msg:
                error_cat = "auth_error"
                sanitized_msg = "Neo4j credentials rejected (AuthError)"
            else:
                sanitized_msg = _sanitize_error_message(err_msg)

            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "unhealthy",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": last_success,
                "response_time_ms": latency_ms,
                "last_sync_at": None,
                "error_category": error_cat,
                "error_message": sanitized_msg,
                "is_enabled": True,
                "data_freshness": "Unavailable",
                "details": {"fallback_active": True, "notice": "System operating via Digital Twin memory fallback"},
            }

    @classmethod
    async def check_erpnext(cls, db: Session) -> Dict[str, Any]:
        """Performs lightweight check on ERPNext REST API."""
        name = "ERPNext REST API"
        category = "erp"
        start_time = time.perf_counter()

        url = settings.ERPNEXT_URL or ""
        api_key = settings.ERPNEXT_API_KEY or ""
        api_secret = settings.ERPNEXT_API_SECRET or ""

        # Also inspect if DB has an active EnterpriseIntegration for ERPNext
        query = db.query(EnterpriseIntegration).filter(
            EnterpriseIntegration.system_type == "ERPNext", EnterpriseIntegration.is_active == True
        )
        user_id = _safe_user_uuid(db.info.get("health_user_id"))
        # Background system probes use environment configuration only.
        db_erp = query.filter(EnterpriseIntegration.user_id == user_id).order_by(
            desc(EnterpriseIntegration.updated_at)
        ).first() if user_id else None
        if db_erp and db_erp.base_url:
            url = db_erp.base_url
            if db_erp.encrypted_api_key:
                api_key = decrypt_secret(db_erp.encrypted_api_key)
            if db_erp.encrypted_api_secret:
                api_secret = decrypt_secret(db_erp.encrypted_api_secret)

        last_sync = db_erp.last_tested_at if db_erp else None
        last_success = cls.get_last_successful_check(db, name)

        if not url:
            return {
                "name": name,
                "category": category,
                "configuration_status": "not_configured",
                "connection_status": "unknown",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": None,
                "response_time_ms": 0.0,
                "last_sync_at": None,
                "error_category": "config_missing",
                "error_message": "ERPNEXT_URL is not configured",
                "is_enabled": False,
                "data_freshness": "Not configured",
                "details": {},
            }

        clean_base = url.rstrip("/")
        headers = {
            "Accept": "application/json",
            "Authorization": f"token {api_key}:{api_secret}" if api_key and api_secret else "",
        }

        try:
            async with httpx.AsyncClient(timeout=6.0, follow_redirects=False) as client:
                # Call User resource with limit 1
                resp = await client.get(f"{clean_base}/api/resource/User?limit_page_length=1", headers=headers)
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

                if resp.status_code == 200:
                    now_dt = datetime.now(timezone.utc)
                    return {
                        "name": name,
                        "category": category,
                        "configuration_status": "configured",
                        "connection_status": "healthy",
                        "last_checked_at": now_dt,
                        "last_successful_check_at": now_dt,
                        "response_time_ms": latency_ms,
                        "last_sync_at": last_sync,
                        "error_category": None,
                        "error_message": None,
                        "is_enabled": True,
                        "data_freshness": _format_time_ago(last_sync) if last_sync else "Synchronized",
                        "details": {"base_url": _sanitize_error_message(clean_base), "http_status": 200},
                    }
                elif resp.status_code in (401, 403):
                    return {
                        "name": name,
                        "category": category,
                        "configuration_status": "configured",
                        "connection_status": "unhealthy",
                        "last_checked_at": datetime.now(timezone.utc),
                        "last_successful_check_at": last_success,
                        "response_time_ms": latency_ms,
                        "last_sync_at": last_sync,
                        "error_category": "auth_error",
                        "error_message": f"Authentication credentials rejected by ERPNext (HTTP {resp.status_code})",
                        "is_enabled": True,
                        "data_freshness": _format_time_ago(last_sync) if last_sync else "Auth required",
                        "details": {"base_url": _sanitize_error_message(clean_base), "http_status": resp.status_code},
                    }
                elif resp.status_code == 404:
                    return {
                        "name": name,
                        "category": category,
                        "configuration_status": "configured",
                        "connection_status": "degraded",
                        "last_checked_at": datetime.now(timezone.utc),
                        "last_successful_check_at": last_success,
                        "response_time_ms": latency_ms,
                        "last_sync_at": last_sync,
                        "error_category": "not_found",
                        "error_message": "ERPNext endpoint responded with HTTP 404 (Check API resource path)",
                        "is_enabled": True,
                        "data_freshness": "Degraded",
                        "details": {"base_url": _sanitize_error_message(clean_base), "http_status": 404},
                    }
                else:
                    return {
                        "name": name,
                        "category": category,
                        "configuration_status": "configured",
                        "connection_status": "degraded",
                        "last_checked_at": datetime.now(timezone.utc),
                        "last_successful_check_at": last_success,
                        "response_time_ms": latency_ms,
                        "last_sync_at": last_sync,
                        "error_category": "http_error",
                        "error_message": f"ERPNext responded with HTTP {resp.status_code}",
                        "is_enabled": True,
                        "data_freshness": "Degraded",
                        "details": {"base_url": _sanitize_error_message(clean_base), "http_status": resp.status_code},
                    }

        except httpx.TimeoutException:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "unhealthy",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": last_success,
                "response_time_ms": latency_ms,
                "last_sync_at": last_sync,
                "error_category": "timeout",
                "error_message": "ERPNext server timed out after 6.0s",
                "is_enabled": True,
                "data_freshness": "Unavailable",
                "details": {"base_url": _sanitize_error_message(clean_base)},
            }
        except Exception as e:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "unhealthy",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": last_success,
                "response_time_ms": latency_ms,
                "last_sync_at": last_sync,
                "error_category": "connection_error",
                "error_message": _sanitize_error_message(f"Failed to connect to {clean_base}: {str(e)}"),
                "is_enabled": True,
                "data_freshness": "Unavailable",
                "details": {"base_url": _sanitize_error_message(clean_base)},
            }

    @classmethod
    async def check_openweather(cls, db: Session) -> Dict[str, Any]:
        """Performs lightweight check on OpenWeather API."""
        name = "OpenWeather API"
        category = "weather"
        start_time = time.perf_counter()
        key = settings.WEATHER_API_KEY or ""

        if not key:
            return {
                "name": name,
                "category": category,
                "configuration_status": "not_configured",
                "connection_status": "unknown",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": None,
                "response_time_ms": 0.0,
                "last_sync_at": None,
                "error_category": "config_missing",
                "error_message": "WEATHER_API_KEY is not configured",
                "is_enabled": False,
                "data_freshness": "Not configured",
                "details": {},
            }

        last_success = cls.get_last_successful_check(db, name)

        try:
            # Lightweight call to London weather (inexpensive standard endpoint)
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(
                    f"https://api.openweathermap.org/data/2.5/weather?q=London&appid={key}"
                )
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

                if resp.status_code == 200:
                    data = resp.json()
                    now_dt = datetime.now(timezone.utc)
                    temp_c = round(data.get("main", {}).get("temp", 273.15) - 273.15, 1)
                    weather_desc = data.get("weather", [{}])[0].get("description", "clear")
                    return {
                        "name": name,
                        "category": category,
                        "configuration_status": "configured",
                        "connection_status": "healthy",
                        "last_checked_at": now_dt,
                        "last_successful_check_at": now_dt,
                        "response_time_ms": latency_ms,
                        "last_sync_at": now_dt,
                        "error_category": None,
                        "error_message": None,
                        "is_enabled": True,
                        "data_freshness": "Live telemetry",
                        "details": {
                            "location_monitored": "Global Logistics Corridors",
                            "sample_probe": f"London: {temp_c}°C, {weather_desc}",
                            "http_status": 200,
                        },
                    }
                elif resp.status_code in (401, 403):
                    return {
                        "name": name,
                        "category": category,
                        "configuration_status": "configured",
                        "connection_status": "unhealthy",
                        "last_checked_at": datetime.now(timezone.utc),
                        "last_successful_check_at": last_success,
                        "response_time_ms": latency_ms,
                        "last_sync_at": None,
                        "error_category": "auth_error",
                        "error_message": "Invalid OpenWeather API Key (HTTP 401 Unauthorized)",
                        "is_enabled": True,
                        "data_freshness": "Unavailable",
                        "details": {"http_status": resp.status_code},
                    }
                elif resp.status_code == 429:
                    return {
                        "name": name,
                        "category": category,
                        "configuration_status": "configured",
                        "connection_status": "degraded",
                        "last_checked_at": datetime.now(timezone.utc),
                        "last_successful_check_at": last_success,
                        "response_time_ms": latency_ms,
                        "last_sync_at": None,
                        "error_category": "rate_limit",
                        "error_message": "OpenWeather API rate limit or quota exceeded (HTTP 429)",
                        "is_enabled": True,
                        "data_freshness": "Degraded",
                        "details": {"http_status": 429},
                    }
                else:
                    return {
                        "name": name,
                        "category": category,
                        "configuration_status": "configured",
                        "connection_status": "degraded",
                        "last_checked_at": datetime.now(timezone.utc),
                        "last_successful_check_at": last_success,
                        "response_time_ms": latency_ms,
                        "last_sync_at": None,
                        "error_category": "http_error",
                        "error_message": f"OpenWeather returned HTTP {resp.status_code}",
                        "is_enabled": True,
                        "data_freshness": "Degraded",
                        "details": {"http_status": resp.status_code},
                    }
        except httpx.TimeoutException:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "unhealthy",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": last_success,
                "response_time_ms": latency_ms,
                "last_sync_at": None,
                "error_category": "timeout",
                "error_message": "OpenWeather request timed out after 6.0s",
                "is_enabled": True,
                "data_freshness": "Unavailable",
                "details": {},
            }
        except Exception as e:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "unhealthy",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": last_success,
                "response_time_ms": latency_ms,
                "last_sync_at": None,
                "error_category": "connection_error",
                "error_message": _sanitize_error_message(f"Connection failed: {str(e)}"),
                "is_enabled": True,
                "data_freshness": "Unavailable",
                "details": {},
            }

    @classmethod
    async def check_newsdata(cls, db: Session) -> Dict[str, Any]:
        """Performs lightweight check on NewsData.io Disruption Feed."""
        name = "NewsData.io Intelligence Feed"
        category = "news"
        start_time = time.perf_counter()
        key = settings.NEWS_API_KEY or ""

        if not key:
            return {
                "name": name,
                "category": category,
                "configuration_status": "not_configured",
                "connection_status": "unknown",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": None,
                "response_time_ms": 0.0,
                "last_sync_at": None,
                "error_category": "config_missing",
                "error_message": "NEWS_API_KEY is not configured",
                "is_enabled": False,
                "data_freshness": "Not configured",
                "details": {},
            }

        last_success = cls.get_last_successful_check(db, name)

        try:
            # Query latest supply chain disruption news
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(
                    f"https://newsdata.io/api/1/latest?apikey={key}&q=supply%20chain&size=3"
                )
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

                if resp.status_code == 200:
                    data = resp.json()
                    now_dt = datetime.now(timezone.utc)
                    results = data.get("results", [])
                    total_results = data.get("totalResults", len(results))
                    return {
                        "name": name,
                        "category": category,
                        "configuration_status": "configured",
                        "connection_status": "healthy",
                        "last_checked_at": now_dt,
                        "last_successful_check_at": now_dt,
                        "response_time_ms": latency_ms,
                        "last_sync_at": now_dt,
                        "error_category": None,
                        "error_message": None,
                        "is_enabled": True,
                        "data_freshness": "Live feed active",
                        "details": {
                            "query": "supply chain",
                            "results_count": len(results),
                            "total_results": total_results,
                            "http_status": 200,
                        },
                    }
                elif resp.status_code in (401, 403):
                    return {
                        "name": name,
                        "category": category,
                        "configuration_status": "configured",
                        "connection_status": "unhealthy",
                        "last_checked_at": datetime.now(timezone.utc),
                        "last_successful_check_at": last_success,
                        "response_time_ms": latency_ms,
                        "last_sync_at": None,
                        "error_category": "auth_error",
                        "error_message": "NewsData.io authentication failed (HTTP 401/403)",
                        "is_enabled": True,
                        "data_freshness": "Unavailable",
                        "details": {"http_status": resp.status_code},
                    }
                elif resp.status_code == 429:
                    return {
                        "name": name,
                        "category": category,
                        "configuration_status": "configured",
                        "connection_status": "degraded",
                        "last_checked_at": datetime.now(timezone.utc),
                        "last_successful_check_at": last_success,
                        "response_time_ms": latency_ms,
                        "last_sync_at": None,
                        "error_category": "rate_limit",
                        "error_message": "NewsData.io API rate limit exceeded (HTTP 429)",
                        "is_enabled": True,
                        "data_freshness": "Degraded",
                        "details": {"http_status": 429},
                    }
                else:
                    return {
                        "name": name,
                        "category": category,
                        "configuration_status": "configured",
                        "connection_status": "degraded",
                        "last_checked_at": datetime.now(timezone.utc),
                        "last_successful_check_at": last_success,
                        "response_time_ms": latency_ms,
                        "last_sync_at": None,
                        "error_category": "http_error",
                        "error_message": f"NewsData.io responded with HTTP {resp.status_code}",
                        "is_enabled": True,
                        "data_freshness": "Degraded",
                        "details": {"http_status": resp.status_code},
                    }
        except httpx.TimeoutException:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "unhealthy",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": last_success,
                "response_time_ms": latency_ms,
                "last_sync_at": None,
                "error_category": "timeout",
                "error_message": "NewsData.io request timed out after 6.0s",
                "is_enabled": True,
                "data_freshness": "Unavailable",
                "details": {},
            }
        except Exception as e:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "unhealthy",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": last_success,
                "response_time_ms": latency_ms,
                "last_sync_at": None,
                "error_category": "connection_error",
                "error_message": _sanitize_error_message(f"Connection failed: {str(e)}"),
                "is_enabled": True,
                "data_freshness": "Unavailable",
                "details": {},
            }

    @classmethod
    async def check_storage(cls, db: Session) -> Dict[str, Any]:
        """Performs lightweight check on Cloudinary Cloud Storage or S3-compatible storage."""
        start_time = time.perf_counter()
        
        # Priority 1: Cloudinary Cloud Storage
        if settings.CLOUDINARY_API_KEY:
            name = "Cloudinary Cloud Storage"
            category = "storage"
            cloud_name = settings.CLOUDINARY_CLOUD_NAME or ""
            api_key = settings.CLOUDINARY_API_KEY or ""
            api_secret = settings.CLOUDINARY_API_SECRET or ""

            if not cloud_name:
                return {
                    "name": name,
                    "category": category,
                    "configuration_status": "configured",
                    "connection_status": "degraded",
                    "last_checked_at": datetime.now(timezone.utc),
                    "last_successful_check_at": None,
                    "response_time_ms": 0.0,
                    "last_sync_at": None,
                    "error_category": "config_missing",
                    "error_message": "CLOUDINARY_API_KEY provided, but CLOUDINARY_CLOUD_NAME is required in .env",
                    "is_enabled": True,
                    "data_freshness": "Incomplete configuration",
                    "details": {
                        "api_key_configured": True,
                        "cloud_name_missing": True,
                        "hint": "Set CLOUDINARY_CLOUD_NAME in backend/.env",
                    },
                }

            last_success = cls.get_last_successful_check(db, name)
            ping_url = f"https://api.cloudinary.com/v1_1/{cloud_name}/ping"
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(ping_url, auth=(api_key, api_secret))
                    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

                    if resp.status_code == 200:
                        now_dt = datetime.now(timezone.utc)
                        return {
                            "name": name,
                            "category": category,
                            "configuration_status": "configured",
                            "connection_status": "healthy",
                            "last_checked_at": now_dt,
                            "last_successful_check_at": now_dt,
                            "response_time_ms": latency_ms,
                            "last_sync_at": None,
                            "error_category": None,
                            "error_message": None,
                            "is_enabled": True,
                            "data_freshness": "Cloudinary CDN Operational",
                            "details": {
                                "cloud_name": cloud_name,
                                "service": "Cloudinary Media & Object Storage",
                                "status": "active",
                            },
                        }
                    elif resp.status_code == 401:
                        return {
                            "name": name,
                            "category": category,
                            "configuration_status": "configured",
                            "connection_status": "unhealthy",
                            "last_checked_at": datetime.now(timezone.utc),
                            "last_successful_check_at": last_success,
                            "response_time_ms": latency_ms,
                            "last_sync_at": None,
                            "error_category": "auth_error",
                            "error_message": "Cloudinary authentication failed: verify CLOUDINARY_CLOUD_NAME and API credentials",
                            "is_enabled": True,
                            "data_freshness": "Auth Error",
                            "details": {"cloud_name": cloud_name, "http_status": 401},
                        }
                    else:
                        return {
                            "name": name,
                            "category": category,
                            "configuration_status": "configured",
                            "connection_status": "degraded",
                            "last_checked_at": datetime.now(timezone.utc),
                            "last_successful_check_at": last_success,
                            "response_time_ms": latency_ms,
                            "last_sync_at": None,
                            "error_category": "http_error",
                            "error_message": f"Cloudinary ping returned HTTP {resp.status_code}",
                            "is_enabled": True,
                            "data_freshness": "Degraded",
                            "details": {"cloud_name": cloud_name, "http_status": resp.status_code},
                        }
            except httpx.TimeoutException:
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                return {
                    "name": name,
                    "category": category,
                    "configuration_status": "configured",
                    "connection_status": "unhealthy",
                    "last_checked_at": datetime.now(timezone.utc),
                    "last_successful_check_at": last_success,
                    "response_time_ms": latency_ms,
                    "last_sync_at": None,
                    "error_category": "timeout",
                    "error_message": "Cloudinary ping timed out after 5.0s",
                    "is_enabled": True,
                    "data_freshness": "Unavailable",
                    "details": {"cloud_name": cloud_name},
                }
            except Exception as e:
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                return {
                    "name": name,
                    "category": category,
                    "configuration_status": "configured",
                    "connection_status": "unhealthy",
                    "last_checked_at": datetime.now(timezone.utc),
                    "last_successful_check_at": last_success,
                    "response_time_ms": latency_ms,
                    "last_sync_at": None,
                    "error_category": "connection_error",
                    "error_message": _sanitize_error_message(f"Cloudinary connection error: {str(e)}"),
                    "is_enabled": True,
                    "data_freshness": "Unavailable",
                    "details": {"cloud_name": cloud_name},
                }

        # Fallback Priority 2: AWS / Cloudflare R2 / Neon S3
        name = "Cloudflare R2 / S3 Object Storage"
        category = "storage"
        s3_url = settings.AWS_ENDPOINT_URL_S3 or ""

        if not s3_url:
            return {
                "name": name,
                "category": category,
                "configuration_status": "not_configured",
                "connection_status": "unknown",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": None,
                "response_time_ms": 0.0,
                "last_sync_at": None,
                "error_category": "config_missing",
                "error_message": "No storage provider configured (Cloudinary or AWS S3)",
                "is_enabled": False,
                "data_freshness": "Not configured",
                "details": {},
            }

        last_success = cls.get_last_successful_check(db, name)

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(s3_url)
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

                # Reachability is not proof that the application's credentials work.
                if resp.status_code in (200, 403):
                    now_dt = datetime.now(timezone.utc)
                    status = "degraded"
                    return {
                        "name": name,
                        "category": category,
                        "configuration_status": "configured",
                        "connection_status": status,
                        "last_checked_at": now_dt,
                        "last_successful_check_at": last_success,
                        "response_time_ms": latency_ms,
                        "last_sync_at": None,
                        "error_category": "access_unverified",
                        "error_message": "Storage endpoint is reachable; authenticated bucket access has not been verified.",
                        "is_enabled": True,
                        "data_freshness": "Endpoint reachable; access unverified",
                        "details": {
                            "region": settings.AWS_REGION or "us-east-2",
                            "endpoint_reachable": True,
                            "access_mode": "S3-compatible (Neon/Cloudflare R2)",
                            "http_status": resp.status_code,
                        },
                    }
                else:
                    return {
                        "name": name,
                        "category": category,
                        "configuration_status": "configured",
                        "connection_status": "degraded",
                        "last_checked_at": datetime.now(timezone.utc),
                        "last_successful_check_at": last_success,
                        "response_time_ms": latency_ms,
                        "last_sync_at": None,
                        "error_category": "http_error",
                        "error_message": f"S3 endpoint responded with unexpected HTTP {resp.status_code}",
                        "is_enabled": True,
                        "data_freshness": "Degraded",
                        "details": {"http_status": resp.status_code},
                    }
        except httpx.TimeoutException:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "unhealthy",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": last_success,
                "response_time_ms": latency_ms,
                "last_sync_at": None,
                "error_category": "timeout",
                "error_message": "S3 Storage endpoint timed out after 5.0s",
                "is_enabled": True,
                "data_freshness": "Unavailable",
                "details": {},
            }
        except Exception as e:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "unhealthy",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": last_success,
                "response_time_ms": latency_ms,
                "last_sync_at": None,
                "error_category": "connection_error",
                "error_message": _sanitize_error_message(f"Storage connection failed: {str(e)}"),
                "is_enabled": True,
                "data_freshness": "Unavailable",
                "details": {},
            }

    @classmethod
    async def check_smtp(cls, db: Session) -> Dict[str, Any]:
        """Performs lightweight socket check on configured SMTP Email Gateway."""
        name = "SMTP Email Alert Dispatcher"
        category = "email"
        start_time = time.perf_counter()
        host = settings.SMTP_HOST or ""
        port = settings.SMTP_PORT or 587

        if not host:
            return {
                "name": name,
                "category": category,
                "configuration_status": "not_configured",
                "connection_status": "unknown",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": None,
                "response_time_ms": 0.0,
                "last_sync_at": None,
                "error_category": "config_missing",
                "error_message": "SMTP_HOST is not configured",
                "is_enabled": False,
                "data_freshness": "Not configured",
                "details": {},
            }

        last_success = cls.get_last_successful_check(db, name)

        def _test_socket():
            with socket.create_connection((host, port), timeout=3.5):
                pass
            return True

        try:
            loop = asyncio.get_running_loop()
            await asyncio.wait_for(loop.run_in_executor(None, _test_socket), timeout=4.5)
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            now_dt = datetime.now(timezone.utc)
            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "healthy",
                "last_checked_at": now_dt,
                "last_successful_check_at": now_dt,
                "response_time_ms": latency_ms,
                "last_sync_at": None,
                "error_category": None,
                "error_message": None,
                "is_enabled": True,
                "data_freshness": "Alert routing operational",
                "details": {"host": host, "port": port},
            }
        except asyncio.TimeoutError:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "unhealthy",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": last_success,
                "response_time_ms": latency_ms,
                "last_sync_at": None,
                "error_category": "timeout",
                "error_message": f"SMTP handshake timed out for {host}:{port}",
                "is_enabled": True,
                "data_freshness": "Unavailable",
                "details": {"host": host, "port": port},
            }
        except Exception as e:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "unhealthy",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": last_success,
                "response_time_ms": latency_ms,
                "last_sync_at": None,
                "error_category": "connection_error",
                "error_message": _sanitize_error_message(f"SMTP connection error: {str(e)}"),
                "is_enabled": True,
                "data_freshness": "Unavailable",
                "details": {"host": host, "port": port},
            }

    @classmethod
    async def check_ml_model(cls, db: Session) -> Dict[str, Any]:
        """Performs live health and readiness check on ML delay prediction model and datasets."""
        from app.services.ml.ml_service import MLIntelligenceService
        name = "Machine Learning Delay Predictor"
        category = "ai_ml"
        start_time = time.perf_counter()

        try:
            health_info = await asyncio.to_thread(MLIntelligenceService.check_model_health)
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            status_val = health_info.get("status", "unknown")
            is_healthy = status_val == "healthy"
            last_success = datetime.now(timezone.utc) if is_healthy else cls.get_last_successful_check(db, name)

            return {
                "name": name,
                "category": category,
                "configuration_status": "configured" if health_info.get("model_loaded") else "not_configured",
                "connection_status": status_val,
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": last_success,
                "response_time_ms": latency_ms,
                "last_sync_at": None,
                "error_category": None if is_healthy else "ml_model_error",
                "error_message": None if is_healthy else health_info.get("message"),
                "is_enabled": True,
                "data_freshness": "Model artifact active",
                "details": {
                    "model_path": health_info.get("model_path"),
                    "features_count": health_info.get("features_count"),
                    "supplier_master_exists": health_info.get("supplier_master_exists"),
                    "shipment_history_exists": health_info.get("shipment_history_exists"),
                    "test_inference_latency_ms": health_info.get("test_inference_latency_ms"),
                },
            }
        except Exception as e:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            last_success = cls.get_last_successful_check(db, name)
            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "unhealthy",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": last_success,
                "response_time_ms": latency_ms,
                "last_sync_at": None,
                "error_category": "ml_service_error",
                "error_message": _sanitize_error_message(str(e)),
                "is_enabled": True,
                "data_freshness": "Unavailable",
                "details": {},
            }

    @classmethod
    def _check_specs(cls):
        # SQL is still used for authentication and application data even when
        # MongoDB is configured, so it must always have its own health result.
        specs = [("Neon PostgreSQL", "database", cls.check_postgres)]
        if settings.MONGODB_URL:
            specs.append(("MongoDB Atlas Primary Database", "database", cls.check_mongodb))
        specs.extend([
            ("Neo4j Aura Graph Engine", "graph_database", cls.check_neo4j),
            ("ERPNext REST API", "erp", cls.check_erpnext),
            ("OpenWeather API", "weather", cls.check_openweather),
            ("NewsData.io Intelligence Feed", "news", cls.check_newsdata),
            ("Cloudinary Cloud Storage" if settings.CLOUDINARY_API_KEY else
             "Cloudflare R2 / S3 Object Storage", "storage", cls.check_storage),
            ("SMTP Email Alert Dispatcher", "email", cls.check_smtp),
            ("Machine Learning Delay Predictor", "ai_ml", cls.check_ml_model),
        ])
        return specs

    @staticmethod
    def _worker_session(bind, user_id=None):
        session = Session(bind=bind)
        session.info["health_user_id"] = user_id
        return session

    @classmethod
    async def _run_bounded_check(cls, bind, name, category, checker, user_id=None):
        """Keep blocking drivers off the server loop, with one session per probe.

        A timed-out worker may still be inside a driver call. Keep its task until
        it finishes so subsequent refreshes cannot launch duplicate stuck probes.
        """
        async def run():
            with cls._worker_session(bind, user_id) as check_db:
                return await checker(check_db)

        loop = asyncio.get_running_loop()
        key = (loop, bind, str(user_id), name)
        task = cls._probe_tasks.get(key)
        if task is None:
            task = asyncio.create_task(run())
            cls._probe_tasks[key] = task

            def done(finished):
                if cls._probe_tasks.get(key) is finished:
                    cls._probe_tasks.pop(key, None)
                # Consume errors even if every requesting client has timed out.
                if not finished.cancelled():
                    finished.exception()

            task.add_done_callback(done)

        started = time.perf_counter()
        try:
            return await asyncio.wait_for(asyncio.shield(task), cls.CHECK_TIMEOUT_SECONDS)
        except Exception as exc:
            timed_out = isinstance(exc, (asyncio.TimeoutError, TimeoutError))
            return {
                "name": name,
                "category": category,
                "configuration_status": "configured",
                "connection_status": "unhealthy",
                "last_checked_at": datetime.now(timezone.utc),
                "last_successful_check_at": None,
                "response_time_ms": round((time.perf_counter() - started) * 1000, 2),
                "last_sync_at": None,
                "error_category": "timeout" if timed_out else "check_error",
                "error_message": (
                    f"Health check exceeded {cls.CHECK_TIMEOUT_SECONDS:g}s. Retry after verifying connectivity."
                    if timed_out else _sanitize_error_message(str(exc))
                ),
                "is_enabled": True,
                "data_freshness": "Unavailable",
                "details": {},
            }

    @classmethod
    async def _persist_results(cls, bind, results):
        def persist():
            with cls._worker_session(bind) as history_db:
                for item in results:
                    history_db.add(IntegrationHealthCheck(
                        integration_name=item["name"],
                        category=item["category"],
                        status=item["connection_status"],
                        latency_ms=item["response_time_ms"],
                        error_category=item.get("error_category"),
                        error_message=item.get("error_message"),
                        details={
                            **(item.get("details") or {}),
                            "configuration_status": item["configuration_status"],
                            "is_enabled": item["is_enabled"],
                        },
                        checked_at=item["last_checked_at"],
                    ))
                history_db.commit()

        # Do not turn a useful diagnostic response into an error when the
        # database whose health is being measured cannot store its own history.
        loop = asyncio.get_running_loop()
        key = (loop, bind, "history_write")
        task = cls._probe_tasks.get(key)
        if task is not None:
            return
        task = asyncio.create_task(asyncio.to_thread(persist))
        cls._probe_tasks[key] = task

        def done(finished):
            cls._probe_tasks.pop(key, None)
            if not finished.cancelled():
                finished.exception()

        task.add_done_callback(done)
        try:
            await asyncio.wait_for(asyncio.shield(task), cls.HISTORY_TIMEOUT_SECONDS)
        except Exception:
            pass

    @classmethod
    async def check_all_integrations(
        cls, db: Session, persist: bool = True, force_refresh: bool = False, user_id=None,
    ) -> List[Dict[str, Any]]:
        """Return recent checks or run independent probes with a bounded deadline."""
        bind = db.get_bind()
        cache_key = (bind, str(user_id))
        cached = cls._cached_results.get(cache_key)
        if not force_refresh and cached and time.monotonic() - cached[0] < cls.CACHE_TTL_SECONDS:
            return deepcopy(cached[1])

        builtins = asyncio.gather(*[
            cls._run_bounded_check(bind, name, category, checker, user_id)
            for name, category, checker in cls._check_specs()
        ])
        names = await cls._custom_integration_names(bind, user_id) if user_id else []

        async def check_custom(name):
            async def check(check_db):
                return await cls._check_custom(check_db, name)
            return await cls._run_bounded_check(bind, name, "custom_erp", check, user_id)

        custom_results = await asyncio.gather(*(check_custom(name) for name in names))
        results = await builtins
        results.extend(item for item in custom_results if item is not None)
        # Cache before optional history I/O so overlapping dashboard polls share
        # the completed checks and do not repeatedly consume provider quotas.
        cls._cached_results[cache_key] = (time.monotonic(), deepcopy(results))
        if persist:
            await cls._persist_results(bind, results)
        return results

    @classmethod
    async def _custom_integration_names(cls, bind, user_id):
        parsed_uid = _safe_user_uuid(user_id)
        if not parsed_uid:
            return []

        def read():
            with cls._worker_session(bind, parsed_uid) as db:
                return [row[0] for row in db.query(EnterpriseIntegration.name).filter(
                    EnterpriseIntegration.user_id == parsed_uid,
                    # ERPNext is represented by its dedicated probe above.
                    func.lower(EnterpriseIntegration.system_type) != "erpnext",
                ).all()]

        key = (asyncio.get_running_loop(), bind, str(parsed_uid), "custom_names")
        task = cls._probe_tasks.get(key)
        if task is None:
            task = asyncio.create_task(asyncio.to_thread(read))
            cls._probe_tasks[key] = task
            def done(finished):
                cls._probe_tasks.pop(key, None)
                if not finished.cancelled():
                    finished.exception()
            task.add_done_callback(done)
        try:
            return await asyncio.wait_for(asyncio.shield(task), cls.HISTORY_TIMEOUT_SECONDS)
        except Exception:
            return []

    @classmethod
    async def _check_custom(cls, db, integration_name):
        query = db.query(EnterpriseIntegration).filter(
            func.lower(EnterpriseIntegration.name) == integration_name.strip().lower()
        )
        user_id = _safe_user_uuid(db.info.get("health_user_id"))
        if not user_id:
            return None
        db_int = query.filter(EnterpriseIntegration.user_id == user_id).first()
        if not db_int:
            return None
        now = datetime.now(timezone.utc)
        result = {
            "name": db_int.name,
            "category": "custom_erp",
            "configuration_status": "configured",
            "connection_status": "unknown",
            "last_checked_at": now,
            "last_successful_check_at": cls.get_last_successful_check(db, db_int.name),
            "response_time_ms": 0.0,
            "last_sync_at": None,
            "error_category": None,
            "error_message": None,
            "is_enabled": db_int.is_active,
            "data_freshness": "Disabled" if not db_int.is_active else "Not checked",
            "details": {"system_type": db_int.system_type},
        }
        if not db_int.is_active:
            return result
        started = time.perf_counter()
        adapter = get_adapter(db_int.system_type)(
            base_url=db_int.base_url,
            auth_type=db_int.auth_type,
            api_key=decrypt_secret(db_int.encrypted_api_key) if db_int.encrypted_api_key else None,
            api_secret=decrypt_secret(db_int.encrypted_api_secret) if db_int.encrypted_api_secret else None,
            configuration=db_int.configuration,
        )
        ok = await adapter.test_connection()
        result.update(
            connection_status="healthy" if ok else "unhealthy",
            last_successful_check_at=now if ok else result["last_successful_check_at"],
            response_time_ms=round((time.perf_counter() - started) * 1000, 2),
            error_category=None if ok else "connection_error",
            error_message=None if ok else "Connection test returned failure",
            data_freshness="Connection verified" if ok else "Unavailable",
        )
        return result

    @classmethod
    async def check_single_integration(
        cls, db: Session, integration_name: str, persist: bool = True, user_id=None,
    ) -> Optional[Dict[str, Any]]:
        target = integration_name.strip().lower()
        specs = cls._check_specs()
        specs.append(("MongoDB Atlas Primary Database", "database", cls.check_mongodb))
        aliases = {
            "mongo": cls.check_mongodb, "mongodb": cls.check_mongodb,
            "mongodb atlas": cls.check_mongodb, "atlas": cls.check_mongodb,
            "postgres": cls.check_postgres, "postgresql": cls.check_postgres,
            "neon": cls.check_postgres, "database": cls.check_postgres,
            "neo4j": cls.check_neo4j, "graph": cls.check_neo4j,
            "erpnext": cls.check_erpnext, "erp": cls.check_erpnext,
            "openweather": cls.check_openweather, "weather": cls.check_openweather,
            "newsdata": cls.check_newsdata, "news": cls.check_newsdata,
            "cloudinary": cls.check_storage, "storage": cls.check_storage,
            "r2": cls.check_storage, "s3": cls.check_storage,
            "smtp": cls.check_smtp, "email": cls.check_smtp,
            "ml": cls.check_ml_model, "ml_model": cls.check_ml_model,
            "model": cls.check_ml_model, "ai": cls.check_ml_model,
        }
        spec = next((s for s in specs if s[0].lower() == target), None)
        if spec is None and target in aliases:
            spec = next(s for s in specs if s[2] == aliases[target])
        if spec is None:
            async def custom(check_db):
                return await cls._check_custom(check_db, integration_name)
            spec = (integration_name, "custom_erp", custom)
        bind = db.get_bind()
        result = await cls._run_bounded_check(bind, *spec, user_id=user_id)
        if result:
            cls._cached_results.pop((bind, str(user_id)), None)
            if persist:
                await cls._persist_results(bind, [result])
        return result

    @classmethod
    def get_integration_history(cls, db: Session, integration_name: str, limit: int = 20) -> List[Dict[str, Any]]:
        try:
            records = (
                db.query(IntegrationHealthCheck)
                .filter(IntegrationHealthCheck.integration_name == integration_name)
                .order_by(desc(IntegrationHealthCheck.checked_at))
                .limit(limit)
                .all()
            )
            return [
                {
                    "id": str(r.id),
                    "integration_name": r.integration_name,
                    "category": r.category,
                    "status": r.status,
                    "latency_ms": float(r.latency_ms),
                    "error_category": r.error_category,
                    "error_message": r.error_message,
                    "checked_at": r.checked_at.isoformat() if r.checked_at else None,
                    "details": r.details,
                }
                for r in records
            ]
        except Exception:
            db.rollback()
            return []

    @classmethod
    async def get_integration_history_async(cls, db, integration_name, limit=20):
        bind = db.get_bind()
        def read():
            with cls._worker_session(bind) as history_db:
                return cls.get_integration_history(history_db, integration_name, limit)

        key = (asyncio.get_running_loop(), bind, "history_read", integration_name)
        task = cls._probe_tasks.get(key)
        if task is None:
            task = asyncio.create_task(asyncio.to_thread(read))
            cls._probe_tasks[key] = task
            def done(finished):
                cls._probe_tasks.pop(key, None)
                if not finished.cancelled():
                    finished.exception()
            task.add_done_callback(done)
        try:
            return await asyncio.wait_for(asyncio.shield(task), cls.HISTORY_TIMEOUT_SECONDS)
        except Exception:
            return []
