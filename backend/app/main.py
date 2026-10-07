from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging

from .config import settings
from .models.database import create_tables
from .api.routes import auth, tasks, goals, calendar, documents, agent, habits, notifications

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered personal productivity assistant API",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
API_PREFIX = "/api"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(tasks.router, prefix=API_PREFIX)
app.include_router(goals.router, prefix=API_PREFIX)
app.include_router(calendar.router, prefix=API_PREFIX)
app.include_router(documents.router, prefix=API_PREFIX)
app.include_router(agent.router, prefix=API_PREFIX)
app.include_router(habits.router, prefix=API_PREFIX)
app.include_router(notifications.router, prefix=API_PREFIX)


@app.on_event("startup")
async def startup():
    await create_tables()
    logging.getLogger(__name__).info(f"🚀 {settings.APP_NAME} v{settings.APP_VERSION} started")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}
