from .auth import router as auth_router
from .tasks import router as tasks_router
from .goals import router as goals_router
from .calendar import router as calendar_router
from .documents import router as documents_router
from .agent import router as agent_router
from .habits import router as habits_router

__all__ = [
    "auth_router", "tasks_router", "goals_router",
    "calendar_router", "documents_router", "agent_router", "habits_router"
]
