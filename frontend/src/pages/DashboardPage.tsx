import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { dashboardApi, type CalendarEvent, type Task, type Goal } from '../lib/api';
import { CheckCircle2, Clock, AlertCircle, Target, TrendingUp, Calendar, ChevronRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function priorityBadge(p: string) {
  if (p === 'high') return <span className="badge-high">HIGH</span>;
  if (p === 'medium') return <span className="badge-medium">MED</span>;
  return <span className="badge-low">LOW</span>;
}

function formatDeadline(dateStr?: string) {
  if (!dateStr) return null;
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'MMM d');
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get().then(r => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const focusHours = stats ? Math.floor(stats.focus_minutes / 60) : 0;
  const focusMins = stats ? stats.focus_minutes % 60 : 0;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="text-2xl font-bold text-slate-900">
          {getGreeting()}, {user?.full_name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {format(new Date(), "EEEE, MMMM d, yyyy")} · Here's what needs your attention.
        </p>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Total Tasks</span>
            <CheckCircle2 className="w-4 h-4 text-slate-300" />
          </div>
          <span className="stat-value">{stats?.total_tasks ?? 0}</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="stat-value text-emerald-600">{stats?.completed_tasks ?? 0}</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Overdue</span>
            <AlertCircle className="w-4 h-4 text-red-400" />
          </div>
          <span className={`stat-value ${(stats?.overdue_tasks ?? 0) > 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {stats?.overdue_tasks ?? 0}
          </span>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Focus Time Today</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="stat-value text-indigo-600">
            {focusHours > 0 ? `${focusHours}h ${focusMins}m` : `${stats?.focus_minutes ?? 0}m`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Priority tasks */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 text-sm">Focus Today</h2>
              <button
                onClick={() => navigate('/tasks')}
                className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                All tasks <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {data?.priority_tasks?.length === 0 ? (
                <div className="empty-state py-10">
                  <CheckCircle2 className="empty-state-icon text-emerald-300" />
                  <p className="empty-state-title">You're clear for now.</p>
                  <p className="empty-state-subtitle">No high-priority tasks pending.</p>
                </div>
              ) : (
                data?.priority_tasks?.map((task: Task, i: number) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs text-slate-400 font-mono w-4 flex-shrink-0">{i + 1}.</span>
                      <p className="text-sm text-slate-800 font-medium truncate">{task.title}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      {task.due_date && (
                        <span className="text-xs text-slate-400">{formatDeadline(task.due_date)}</span>
                      )}
                      {priorityBadge(task.priority)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Insights */}
          {data?.insights && data.insights.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-slate-800 text-sm mb-3">Insights</h2>
              <ul className="space-y-2">
                {data.insights.map((insight: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <span className="text-indigo-400 mt-0.5 flex-shrink-0">›</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Active Goals */}
          {data?.active_goals?.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800 text-sm">Active Goals</h2>
                <button
                  onClick={() => navigate('/goals')}
                  className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  All goals <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {data.active_goals.map((goal: Goal) => (
                  <div key={goal.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-slate-800">{goal.title}</p>
                      <span className="text-xs text-slate-500">{goal.progress}%</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>
                    {goal.deadline && (
                      <p className="text-xs text-slate-400 mt-1">
                        Due {formatDeadline(goal.deadline)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Today's schedule */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 text-sm">Today's Schedule</h2>
              <button
                onClick={() => navigate('/calendar')}
                className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                Calendar <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="px-5 py-3">
              {data?.todays_events?.length === 0 ? (
                <div className="py-6 text-center">
                  <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No events scheduled today</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.todays_events.map((ev: CalendarEvent) => (
                    <div key={ev.id} className="flex gap-3 items-start py-1.5">
                      <div
                        className="w-1 h-full min-h-[32px] rounded-full mt-1 flex-shrink-0"
                        style={{ backgroundColor: ev.color }}
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-700">{ev.title}</p>
                        <p className="text-xs text-slate-400">
                          {format(parseISO(ev.start_time), 'h:mm a')} – {format(parseISO(ev.end_time), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming deadlines */}
          <div className="card">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 text-sm">Upcoming Deadlines</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {data?.upcoming_deadlines?.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-xs text-slate-400">No upcoming deadlines</p>
                </div>
              ) : (
                data?.upcoming_deadlines?.slice(0, 5).map((task: Task) => (
                  <div key={task.id} className="flex items-center justify-between px-5 py-3">
                    <p className="text-sm text-slate-700 truncate flex-1">{task.title}</p>
                    <span className="text-xs text-slate-500 flex-shrink-0 ml-3">
                      {formatDeadline(task.due_date)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AI shortcut */}
          <button
            onClick={() => navigate('/assistant')}
            className="w-full card p-5 text-left hover:border-indigo-200 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
              </div>
              <span className="text-sm font-semibold text-slate-800">Ask FocusFlow AI</span>
            </div>
            <p className="text-xs text-slate-500">
              "Plan my day", "Create study plan", "What should I work on?"
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
