from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.api_routes import router as api_v1_router
from app.api.v1.ingestion import router as ingestion_router

app = FastAPI(
    title="SynChain AI API Core",
    description="Backend API platform powering the SynChain AI risk prediction and logistics simulations",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
