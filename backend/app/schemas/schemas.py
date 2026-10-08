from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


# ─── Auth Schemas ─────────────────────────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=8)

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    avatar_color: str
    timezone: str
    working_hours_start: int
    working_hours_end: int
    notification_email: Optional[str] = None
    smtp_email: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    timezone: Optional[str] = None
    working_hours_start: Optional[int] = None
    working_hours_end: Optional[int] = None
    avatar_color: Optional[str] = None
    notification_email: Optional[str] = None
    smtp_email: Optional[str] = None


# ─── Task Schemas ─────────────────────────────────────────────────────────────

class TaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    priority: str = "medium"
    status: str = "todo"
    due_date: Optional[datetime] = None
    estimated_minutes: Optional[int] = None
    goal_id: Optional[UUID] = None
    category: Optional[str] = None

class TaskUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[datetime] = None
    estimated_minutes: Optional[int] = None
    goal_id: Optional[UUID] = None
    category: Optional[str] = None

class TaskResponse(BaseModel):
    id: UUID
    user_id: UUID
    goal_id: Optional[UUID]
    title: str
    description: Optional[str]
    priority: str
    status: str
    due_date: Optional[datetime]
    estimated_minutes: Optional[int]
    category: Optional[str]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


# ─── Goal Schemas ─────────────────────────────────────────────────────────────

class GoalCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    priority: str = "medium"
    category: str = "other"

class GoalUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[float] = None

class GoalResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    description: Optional[str]
    deadline: Optional[datetime]
    priority: str
    category: str
    status: str
    progress: float
    created_at: datetime
    updated_at: datetime
    tasks: List[TaskResponse] = []

    class Config:
        from_attributes = True


# ─── Calendar Schemas ─────────────────────────────────────────────────────────

class CalendarEventCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    color: str = "#6366f1"
    task_id: Optional[UUID] = None

class CalendarEventUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    color: Optional[str] = None

class CalendarEventResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    description: Optional[str]
    start_time: datetime
    end_time: datetime
    color: str
    is_ai_generated: bool
    task_id: Optional[UUID]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Document Schemas ─────────────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: UUID
    user_id: UUID
    filename: str
    original_name: str
    file_type: str
    file_size: int
    page_count: Optional[int]
    chunk_count: int
    is_processed: bool
    processing_error: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Conversation / Agent Schemas ─────────────────────────────────────────────

class AgentChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    conversation_id: Optional[UUID] = None

class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    tool_calls_summary: Optional[str]
    sources: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class ConversationResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: Optional[str]
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = []

    class Config:
        from_attributes = True

class AgentChatResponse(BaseModel):
    conversation_id: UUID
    message: MessageResponse
    action_required: bool = False
    pending_action: Optional[dict] = None


# ─── Dashboard Schemas ────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_tasks: int
    completed_tasks: int
    remaining_tasks: int
    overdue_tasks: int
    focus_minutes: int
    active_goals: int

class DashboardResponse(BaseModel):
    stats: DashboardStats
    priority_tasks: List[TaskResponse]
    upcoming_deadlines: List[TaskResponse]
    todays_events: List[CalendarEventResponse]
    active_goals: List[GoalResponse]
    insights: List[str]
