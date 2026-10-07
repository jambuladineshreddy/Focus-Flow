# FocusFlow AI 🚀

> **Your AI-powered personal productivity assistant** — Turn goals into plans, manage tasks intelligently, and stay on top of what matters most.

Built for students, working professionals, job seekers, and freelancers.

---

## ✨ Features

- **AI Assistant** — Natural language interface powered by Google Gemini with tool calling
- **Task Management** — List and Kanban views with priority, status, deadlines, filtering
- **Goal Management** — Break goals into tasks, track progress automatically
- **Calendar** — Visual month view, event scheduling, AI conflict detection
- **RAG Knowledge Base** — Upload PDF/TXT/MD/DOCX, AI searches your documents automatically
- **Smart Planning** — AI checks your calendar before scheduling, asks for confirmation on bulk actions
- **Dashboard** — Daily overview with insights, priorities, and upcoming deadlines
- **Multi-user** — Full JWT auth, every user's data is isolated

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| State | TanStack Query |
| Backend | FastAPI, Python 3.12, Pydantic |
| Database | PostgreSQL + SQLAlchemy (async) |
| AI | Google Gemini (`gemini-2.0-flash`) with function calling |
| RAG | ChromaDB (per-user vector collections) |
| Auth | JWT + bcrypt |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL running locally
- A Google Gemini API key ([get one free](https://aistudio.google.com/))

### 1. Clone & setup

```bash
# The virtual environment is already created
# Activate it:
venv\Scripts\activate          # Windows
source venv/bin/activate       # Mac/Linux
```

### 2. Configure Backend

```bash
# Edit backend/.env with your values:
GOOGLE_API_KEY=your_google_api_key_here
DATABASE_URL=postgresql://postgres:password@localhost:5432/focusflow
SECRET_KEY=your-random-secret-key
JWT_SECRET_KEY=your-random-jwt-key
```

### 3. Create PostgreSQL database

```sql
CREATE DATABASE focusflow;
```

### 4. Install backend dependencies

```bash
# (If not done already)
venv\Scripts\pip install -r backend\requirements.txt
```

### 5. Start the backend

```bash
# Option A: Use the startup script
start_backend.bat

# Option B: Manual
cd backend
uvicorn app.main:app --reload --port 8000
```

Backend runs at: **http://localhost:8000**  
Swagger API docs: **http://localhost:8000/docs**

### 6. Start the frontend

```bash
# Option A: Use the startup script
start_frontend.bat

# Option B: Manual
cd frontend
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## 🗂 Project Structure

```
make-simple/
├── venv/                    # Python virtual environment
├── backend/
│   ├── .env                 # Your environment variables (don't commit!)
│   ├── .env.example         # Template
│   ├── requirements.txt
│   ├── Dockerfile
│   └── app/
│       ├── main.py          # FastAPI entry point
│       ├── config.py        # Settings
│       ├── api/routes/      # auth, tasks, goals, calendar, documents, agent
│       ├── models/          # SQLAlchemy models + database setup
│       ├── schemas/         # Pydantic request/response schemas
│       ├── repositories/    # Database query layer
│       ├── services/        # Auth, document processing
│       ├── agent/           # AI agent: prompts, tools, orchestration
│       └── rag/             # ChromaDB vector store
│
├── frontend/
│   ├── src/
│   │   ├── pages/           # Dashboard, Assistant, Tasks, Goals, Calendar, Knowledge, Settings
│   │   ├── components/      # Layout, sidebar
│   │   ├── contexts/        # Auth context
│   │   └── lib/             # API client + types
│   └── tailwind.config.js
│
├── start_backend.bat        # Quick start backend
├── start_frontend.bat       # Quick start frontend
└── docker-compose.yml       # Full Docker deployment
```

---

## 🤖 AI Agent Capabilities

The single Gemini agent has these tools:

| Tool | Description |
|------|-------------|
| `search_knowledge_base` | Semantic search over uploaded documents |
| `create_task` | Create tasks with priority, deadline, duration |
| `list_tasks` | List tasks with filters (today, overdue, priority, etc.) |
| `update_task` | Update status, priority, due date |
| `create_goal` | Create structured goals |
| `list_goals` | View active/completed goals |
| `create_calendar_event` | Schedule events (checks conflicts first) |
| `get_calendar_events` | Read calendar to check availability |

### Example Conversations

```
User: "I have an ML interview next Friday. Create a prep plan."
→ Agent searches knowledge base for ML notes
→ Creates a goal: "ML Interview Preparation"
→ Generates realistic prep tasks
→ Checks calendar for available slots
→ Proposes a schedule

User: "Plan my day"
→ Gets today's tasks (overdue + high priority)
→ Gets today's calendar events
→ Generates a prioritized time-block schedule

User: "What does my project documentation say about the API design?"
→ Searches knowledge base
→ Returns relevant chunks with source citations
```

---

## 🔒 Security Notes

- Never commit `backend/.env` to version control
- Change `SECRET_KEY` and `JWT_SECRET_KEY` to random strings in production
- Use HTTPS in production
- User data is fully isolated — one user cannot access another's data

---

## 🐳 Docker Deployment

```bash
# Set env vars then:
docker-compose up --build
```

---

## 📍 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/{id}` | Update task |
| GET | `/api/goals` | List goals |
| POST | `/api/goals` | Create goal |
| GET | `/api/calendar/events` | Get events |
| POST | `/api/calendar/events` | Create event |
| POST | `/api/documents/upload` | Upload document |
| POST | `/api/agent/chat` | Chat with AI |
| GET | `/api/dashboard` | Dashboard data |
| GET | `/api/conversations` | Chat history |
