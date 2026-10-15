import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import SessionLocal
from app.services.health.integration_health_service import IntegrationHealthService
from app.api.v1.api_routes import router as api_v1_router
from app.api.v1.ingestion import router as ingestion_router


async def _background_health_check_runner():
    """Background task running periodic health checks at conservative intervals."""
    # Delay startup check by 5 seconds to avoid slowing down initial boot
    await asyncio.sleep(5)
    while True:
        try:
            db = SessionLocal()
            try:
                await IntegrationHealthService.check_all_integrations(db, persist=True)
            finally:
                db.close()
        except Exception:
            pass
        interval = getattr(settings, "HEALTH_CHECK_INTERVAL_SECONDS", 900)
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(app: FastAPI):
    bg_task = asyncio.create_task(_background_health_check_runner())
    yield
    bg_task.cancel()
    try:
        await bg_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="SynChain AI API Core",
    description="Backend API platform powering the SynChain AI risk prediction and logistics simulations",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend integration
cors_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if getattr(settings, "FRONTEND_URL", None) and settings.FRONTEND_URL not in cors_origins:
    cors_origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix="/api/v1")
app.include_router(ingestion_router, prefix="/api")

@app.get("/health")
async def health_check():
    return {
        "status": "nominal",
        "system": "SynChain AI Backend Neural Core",
        "version": "4.2-Prod"
    }
