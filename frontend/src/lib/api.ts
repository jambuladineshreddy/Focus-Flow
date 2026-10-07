import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: { email: string; full_name: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  updateMe: (data: Partial<{ full_name: string; timezone: string; working_hours_start: number; working_hours_end: number }>) =>
    api.patch('/auth/me', data),
};

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const tasksApi = {
  getAll: (params?: { status?: string; priority?: string; filter_type?: string; goal_id?: string }) =>
    api.get('/tasks', { params }),
  create: (data: Partial<Task>) => api.post('/tasks', data),
  update: (id: string, data: Partial<Task>) => api.patch(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
};

// ─── Goals ───────────────────────────────────────────────────────────────────

export const goalsApi = {
  getAll: (params?: { status?: string }) => api.get('/goals', { params }),
  create: (data: Partial<Goal>) => api.post('/goals', data),
  update: (id: string, data: Partial<Goal>) => api.patch(`/goals/${id}`, data),
  delete: (id: string) => api.delete(`/goals/${id}`),
};

// ─── Calendar ────────────────────────────────────────────────────────────────

export const calendarApi = {
  getEvents: (params?: { start?: string; end?: string }) =>
    api.get('/calendar/events', { params }),
  create: (data: Partial<CalendarEvent>) => api.post('/calendar/events', data),
  update: (id: string, data: Partial<CalendarEvent>) => api.patch(`/calendar/events/${id}`, data),
  delete: (id: string) => api.delete(`/calendar/events/${id}`),
};

// ─── Documents ───────────────────────────────────────────────────────────────

export const documentsApi = {
  getAll: () => api.get('/documents'),
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (id: string) => api.delete(`/documents/${id}`),
};

// ─── Agent ───────────────────────────────────────────────────────────────────

export const agentApi = {
  chat: (message: string, conversationId?: string) =>
    api.post('/agent/chat', { message, conversation_id: conversationId }),
  getConversations: () => api.get('/conversations'),
  getConversation: (id: string) => api.get(`/conversations/${id}`),
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

export const dashboardApi = {
  get: () => api.get('/dashboard'),
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_color: string;
  timezone: string;
  working_hours_start: number;
  working_hours_end: number;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  goal_id?: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'completed';
  due_date?: string;
  estimated_minutes?: number;
  category?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  deadline?: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  progress: number;
  created_at: string;
  updated_at: string;
  tasks: Task[];
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  color: string;
  is_ai_generated: boolean;
  task_id?: string;
  created_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  filename: string;
  original_name: string;
  file_type: string;
  file_size: number;
  page_count?: number;
  chunk_count: number;
  is_processed: boolean;
  processing_error?: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls_summary?: string;
  sources?: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

export interface DashboardStats {
  total_tasks: number;
  completed_tasks: number;
  remaining_tasks: number;
  overdue_tasks: number;
  focus_minutes: number;
  active_goals: number;
}

// ─── Habits ──────────────────────────────────────────────────────────────────

export interface HabitLog {
  id: string;
  habit_id: string;
  date: string;
  completed: boolean;
  note?: string;
  created_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  icon: string;
  color: string;
  frequency: string;
  target_days: number;
  is_active: boolean;
  created_at: string;
  streak: number;
  total_completions: number;
  logs: HabitLog[];
}

export const habitsApi = {
  getAll: () => api.get<Habit[]>('/habits'),
  create: (data: Partial<Habit>) => api.post<Habit>('/habits', data),
  update: (id: string, data: Partial<Habit>) => api.patch<Habit>(`/habits/${id}`, data),
  delete: (id: string) => api.delete(`/habits/${id}`),
  log: (habitId: string, data: { date: string; completed: boolean; note?: string }) =>
    api.post<HabitLog>(`/habits/${habitId}/log`, data),
  getHeatmap: (days?: number) => api.get<{ heatmap: Record<string, number> }>('/habits/heatmap/data', { params: { days } }),
};

