from fastapi import FastAPI

from app.api.v1.api import api_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/")
def root():
    return {
        "message": "Two-Stroke Knowledge RAG Backend",
        "docs": "/docs",
        "health": f"{settings.api_v1_prefix}/health",
    }