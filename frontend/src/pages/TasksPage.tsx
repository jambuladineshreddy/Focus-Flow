import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, type Task } from '../lib/api';
import { Plus, CheckCircle2, Circle, Clock, Calendar, Loader2, LayoutList, LayoutGrid, Trash2, X } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import toast from 'react-hot-toast';

type ViewMode = 'list' | 'kanban';
type FilterStatus = 'all' | 'todo' | 'in_progress' | 'completed';

const PRIORITY_OPTS = ['low', 'medium', 'high'];
const STATUS_OPTS = ['todo', 'in_progress', 'completed'];
const CATEGORY_OPTS = ['study', 'work', 'career', 'personal', 'health', 'other'];

function PriorityBadge({ p }: { p: string }) {
  if (p === 'high') return <span className="badge-high">HIGH</span>;
  if (p === 'medium') return <span className="badge-medium">MED</span>;
  return <span className="badge-low">LOW</span>;
}

function StatusBadge({ s }: { s: string }) {
  if (s === 'completed') return <span className="badge-completed">✓ Done</span>;
  if (s === 'in_progress') return <span className="badge-inprogress">In Progress</span>;
  return <span className="badge-todo">To Do</span>;
}

function TaskCard({ task, onUpdate, onDelete }: { task: Task; onUpdate: (id: string, data: Partial<Task>) => void; onDelete: (id: string) => void }) {
  const isDone = task.status === 'completed';
  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isDone;

  return (
    <div className={`card p-4 hover:shadow-md transition-all ${isDone ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onUpdate(task.id, { status: isDone ? 'todo' : 'completed' })}
          className="mt-0.5 flex-shrink-0 text-slate-300 hover:text-emerald-500 transition-colors"
        >
          {isDone
            ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            : <Circle className="w-5 h-5" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium text-slate-800 ${isDone ? 'line-through text-slate-400' : ''}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{task.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <PriorityBadge p={task.priority} />
            {task.due_date && (
              <span className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                <Calendar className="w-3 h-3" />
                {format(parseISO(task.due_date), 'MMM d')}
                {isOverdue && ' · Overdue'}
              </span>
            )}
            {task.estimated_minutes && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                {task.estimated_minutes >= 60
                  ? `${Math.floor(task.estimated_minutes / 60)}h ${task.estimated_minutes % 60 || ''}m`
                  : `${task.estimated_minutes}m`}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <select
            value={task.status}
            onChange={e => onUpdate(task.id, { status: e.target.value as any })}
            className="text-xs border border-slate-200 rounded-md px-1.5 py-1 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {STATUS_OPTS.map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <button
            onClick={() => onDelete(task.id)}
            className="text-slate-300 hover:text-red-400 transition-colors p-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ title, tasks, status, onUpdate, onDelete }: {
  title: string; tasks: Task[]; status: string;
  onUpdate: (id: string, data: Partial<Task>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex-1 min-w-[260px]">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{tasks.length}</span>
      </div>
      <div className="space-y-2 min-h-[100px]">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function CreateTaskModal({ onClose, onSave }: { onClose: () => void; onSave: (data: Partial<Task>) => void }) {
  const [form, setForm] = useState<Partial<Task>>({
    title: '', priority: 'medium', status: 'todo', category: ''
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Create Task</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="label">Title *</label>
            <input
              autoFocus
              className="input"
              placeholder="What needs to be done?"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Optional details..."
              value={form.description || ''}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as any })}>
                {PRIORITY_OPTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">None</option>
                {CATEGORY_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Due date</label>
              <input
                type="datetime-local"
                className="input"
                value={form.due_date ? form.due_date.slice(0, 16) : ''}
                onChange={e => setForm({ ...form, due_date: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              />
            </div>
            <div>
              <label className="label">Est. minutes</label>
              <input
                type="number"
                className="input"
                placeholder="60"
                min={5}
                value={form.estimated_minutes || ''}
                onChange={e => setForm({ ...form, estimated_minutes: Number(e.target.value) || undefined })}
              />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => { if (form.title) { onSave(form); onClose(); } }}
            className="btn-primary"
            disabled={!form.title}
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [view, setView] = useState<ViewMode>('list');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterPriority, setFilterPriority] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', filterStatus, filterPriority],
    queryFn: () =>
      tasksApi.getAll({
        status: filterStatus === 'all' ? undefined : filterStatus,
        priority: filterPriority || undefined,
      }).then(r => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) => tasksApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => toast.error('Failed to update task'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Task deleted');
    },
    onError: () => toast.error('Failed to delete task'),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Task>) => tasksApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Task created');
    },
    onError: () => toast.error('Failed to create task'),
  });

  const onUpdate = (id: string, data: Partial<Task>) => updateMutation.mutate({ id, data });
  const onDelete = (id: string) => deleteMutation.mutate(id);
  const onCreate = (data: Partial<Task>) => createMutation.mutate(data);

  // Kanban grouping
  const byStatus = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    completed: tasks.filter(t => t.status === 'completed'),
  };

  return (
    <div className="page-container">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">{tasks.length} task{tasks.length !== 1 ? 's' : ''} · {tasks.filter(t => t.status === 'completed').length} completed</p>
        </div>
        <button id="create-task-btn" onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
          {(['all', 'todo', 'in_progress', 'completed'] as FilterStatus[]).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <select
          className="input w-auto text-xs py-1.5"
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
        >
          <option value="">All priorities</option>
          {PRIORITY_OPTS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <div className="ml-auto flex rounded-lg border border-slate-200 overflow-hidden bg-white">
          <button
            onClick={() => setView('list')}
            className={`p-2 transition-colors ${view === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('kanban')}
            className={`p-2 transition-colors ${view === 'kanban' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <CheckCircle2 className="empty-state-icon" />
          <p className="empty-state-title">You're clear for now.</p>
          <p className="empty-state-subtitle mb-4">Create a task or tell FocusFlow what you're trying to accomplish.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Create Task
          </button>
        </div>
      ) : view === 'list' ? (
        <div className="space-y-2">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          <KanbanColumn title="To Do" tasks={byStatus.todo} status="todo" onUpdate={onUpdate} onDelete={onDelete} />
          <KanbanColumn title="In Progress" tasks={byStatus.in_progress} status="in_progress" onUpdate={onUpdate} onDelete={onDelete} />
          <KanbanColumn title="Completed" tasks={byStatus.completed} status="completed" onUpdate={onUpdate} onDelete={onDelete} />
        </div>
      )}

      {showCreate && (
        <CreateTaskModal onClose={() => setShowCreate(false)} onSave={onCreate} />
      )}
    </div>
  );
}
