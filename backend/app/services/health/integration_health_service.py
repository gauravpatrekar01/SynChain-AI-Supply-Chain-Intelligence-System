import asyncio
import os
import socket
import time
import httpx
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text, desc
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
    cleaned = re.sub(r"(token|key|secret|password|apikey)=([a-zA-Z0-9_\-\.]+)", r"\1=***", cleaned, flags=re.I)
    cleaned = re.sub(r"nak_live_[a-zA-Z0-9]+", "nak_live_***", cleaned)
    cleaned = re.sub(r"sk-[a-zA-Z0-9_\-]+", "sk-***", cleaned)
    return cleaned[:300]


class IntegrationHealthService:
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
            return {"latest_timestamp": None, "formatted": "Unknown", "total_imports": 0, "total_imported_records": 0}

    @staticmethod
    def get_last_successful_check(db: Session, integration_name: str) -> Optional[datetime]:
        try:
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
        db_erp = (
            db.query(EnterpriseIntegration)
            .filter(EnterpriseIntegration.system_type == "ERPNext", EnterpriseIntegration.is_active == True)
            .order_by(desc(EnterpriseIntegration.updated_at))
            .first()
        )
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
                        "details": {"base_url": clean_base, "http_status": 200},
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
                        "details": {"base_url": clean_base, "http_status": resp.status_code},
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
                        "details": {"base_url": clean_base, "http_status": 404},
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
                        "details": {"base_url": clean_base, "http_status": resp.status_code},
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
                "details": {"base_url": clean_base},
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
                "details": {"base_url": clean_base},
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

                # S3-compatible service responding with 200 or 403 AccessDenied confirms endpoint alive & listening
                if resp.status_code in (200, 403):
                    now_dt = datetime.now(timezone.utc)
                    status = "healthy" if resp.status_code == 200 else "healthy"
                    return {
                        "name": name,
                        "category": category,
                        "configuration_status": "configured",
                        "connection_status": status,
                        "last_checked_at": now_dt,
                        "last_successful_check_at": now_dt,
                        "response_time_ms": latency_ms,
                        "last_sync_at": None,
                        "error_category": None,
                        "error_message": None,
                        "is_enabled": True,
                        "data_freshness": "Endpoint operational",
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
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(3.5)
            sock.connect((host, port))
            sock.close()
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
    async def check_all_integrations(cls, db: Session, persist: bool = True) -> List[Dict[str, Any]]:
        """Runs health checks across all known integrations and persists results."""
        tasks = [
            cls.check_postgres(db),
            cls.check_neo4j(db),
            cls.check_erpnext(db),
            cls.check_openweather(db),
            cls.check_newsdata(db),
            cls.check_storage(db),
            cls.check_smtp(db),
        ]

        results = await asyncio.gather(*tasks)

        if persist:
            for item in results:
                try:
                    record = IntegrationHealthCheck(
                        integration_name=item["name"],
                        category=item["category"],
                        status=item["connection_status"],
                        latency_ms=item["response_time_ms"],
                        error_category=item.get("error_category"),
                        error_message=item.get("error_message"),
                        details=item.get("details"),
                        checked_at=item["last_checked_at"],
                    )
                    db.add(record)
                except Exception:
                    pass
            try:
                db.commit()
            except Exception:
                db.rollback()

        return results

    @classmethod
    async def check_single_integration(cls, db: Session, integration_name: str, persist: bool = True) -> Optional[Dict[str, Any]]:
        """Runs health check for a single specified integration."""
        target = integration_name.strip().lower()
        result = None

        if "postgres" in target or "database" in target:
            result = await cls.check_postgres(db)
        elif "neo4j" in target or "graph" in target:
            result = await cls.check_neo4j(db)
        elif "erpnext" in target or "erp" in target:
            result = await cls.check_erpnext(db)
        elif "weather" in target:
            result = await cls.check_openweather(db)
        elif "news" in target:
            result = await cls.check_newsdata(db)
        elif "cloudinary" in target or "storage" in target or "r2" in target or "s3" in target:
            result = await cls.check_storage(db)
        elif "smtp" in target or "email" in target:
            result = await cls.check_smtp(db)
        else:
            # Check DB integrations
            db_int = db.query(EnterpriseIntegration).filter(EnterpriseIntegration.name.ilike(f"%{integration_name}%")).first()
            if db_int:
                start_time = time.perf_counter()
                try:
                    adapter = get_adapter(db_int.system_type)
                    api_key = decrypt_secret(db_int.encrypted_api_key) if db_int.encrypted_api_key else None
                    api_secret = decrypt_secret(db_int.encrypted_api_secret) if db_int.encrypted_api_secret else None
                    inst = adapter(
                        base_url=db_int.base_url,
                        auth_type=db_int.auth_type,
                        api_key=api_key,
                        api_secret=api_secret,
                        configuration=db_int.configuration,
                    )
                    ok = await inst.test_connection()
                    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                    now_dt = datetime.now(timezone.utc)
                    result = {
                        "name": db_int.name,
                        "category": "custom_erp",
                        "configuration_status": "configured",
                        "connection_status": "healthy" if ok else "unhealthy",
                        "last_checked_at": now_dt,
                        "last_successful_check_at": now_dt if ok else db_int.last_tested_at,
                        "response_time_ms": latency_ms,
                        "last_sync_at": db_int.last_tested_at,
                        "error_category": None if ok else "connection_error",
                        "error_message": None if ok else "Connection test returned failure",
                        "is_enabled": db_int.is_active,
                        "data_freshness": "Custom enterprise adapter",
                        "details": {"system_type": db_int.system_type, "base_url": db_int.base_url},
                    }
                except Exception as e:
                    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                    result = {
                        "name": db_int.name,
                        "category": "custom_erp",
                        "configuration_status": "configured",
                        "connection_status": "unhealthy",
                        "last_checked_at": datetime.now(timezone.utc),
                        "last_successful_check_at": db_int.last_tested_at,
                        "response_time_ms": latency_ms,
                        "last_sync_at": db_int.last_tested_at,
                        "error_category": "adapter_error",
                        "error_message": _sanitize_error_message(str(e)),
                        "is_enabled": db_int.is_active,
                        "data_freshness": "Unavailable",
                        "details": {"system_type": db_int.system_type},
                    }

        if result and persist:
            try:
                record = IntegrationHealthCheck(
                    integration_name=result["name"],
                    category=result["category"],
                    status=result["connection_status"],
                    latency_ms=result["response_time_ms"],
                    error_category=result.get("error_category"),
                    error_message=result.get("error_message"),
                    details=result.get("details"),
                    checked_at=result["last_checked_at"],
                )
                db.add(record)
                db.commit()
            except Exception:
                db.rollback()

        return result

    @classmethod
    def get_integration_history(cls, db: Session, integration_name: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Retrieves recent health check records for a specific integration."""
        try:
            records = (
                db.query(IntegrationHealthCheck)
                .filter(IntegrationHealthCheck.integration_name.ilike(f"%{integration_name}%"))
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
            return []
