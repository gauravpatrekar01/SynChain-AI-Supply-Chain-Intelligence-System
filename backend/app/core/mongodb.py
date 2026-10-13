import time
from typing import Optional, Dict, Any
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection
from app.core.config import settings

_client: Optional[MongoClient] = None


def get_mongo_client() -> MongoClient:
    """Returns a cached, pooled PyMongo client connected to MongoDB Atlas."""
    global _client
    if _client is None:
        url = settings.MONGODB_URL
        if not url:
            raise ValueError("MONGODB_URL is not configured in settings or environment.")
        kwargs: Dict[str, Any] = {
            "serverSelectionTimeoutMS": 5000,
            "connectTimeoutMS": 5000,
            "socketTimeoutMS": 10000,
            "retryWrites": True,
            "appname": "SynChain-AI",
        }
        try:
            import certifi
            kwargs["tlsCAFile"] = certifi.where()
        except ImportError:
            pass
        _client = MongoClient(url, **kwargs)
    return _client


def get_mongo_db(db_name: Optional[str] = None) -> Database:
    """Returns the primary SynChain MongoDB database instance."""
    client = get_mongo_client()
    name = db_name or settings.MONGODB_DB_NAME or "synchain_db"
    return client[name]


def ping_mongo() -> Dict[str, Any]:
    """Pings MongoDB Atlas cluster and returns latency and cluster details."""
    start = time.perf_counter()
    client = get_mongo_client()
    res = client.admin.command("ping")
    latency_ms = round((time.perf_counter() - start) * 1000, 2)
    return {
        "ok": res.get("ok") == 1,
        "latency_ms": latency_ms,
        "raw": res,
    }


def get_collection(name: str) -> Collection:
    """Returns a collection from the primary SynChain database."""
    return get_mongo_db()[name]


# Named collection accessors
def users_col() -> Collection:
    return get_collection("users")

def products_col() -> Collection:
    return get_collection("products")

def suppliers_col() -> Collection:
    return get_collection("suppliers")

def warehouses_col() -> Collection:
    return get_collection("warehouses")

def inventories_col() -> Collection:
    return get_collection("inventories")

def orders_col() -> Collection:
    return get_collection("orders")

def integrations_col() -> Collection:
    return get_collection("enterprise_integrations")

def health_checks_col() -> Collection:
    return get_collection("integration_health_checks")

def imported_records_col() -> Collection:
    return get_collection("imported_records")
