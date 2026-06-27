from fastapi import FastAPI

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.db.session import engine
from app.models.document import Base
settings = get_settings()
Base.metadata.create_all(bind=engine)


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

@app.get("/health")
def root_health_check():
    return {
        "status": "ok",
        "service": "rag-backend",
    }