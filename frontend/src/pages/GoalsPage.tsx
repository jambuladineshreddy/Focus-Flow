import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsApi, type Goal, type Task } from '../lib/api';
import { Plus, Target, ChevronDown, ChevronRight, CheckCircle2, Circle, Loader2, X, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const PRIORITY_OPTS = ['low', 'medium', 'high'];
const CATEGORY_OPTS = ['study', 'work', 'career', 'personal', 'health', 'other'];
const STATUS_OPTS = ['active', 'completed', 'paused', 'cancelled'];

const CATEGORY_COLORS: Record<string, string> = {
  study: 'bg-blue-50 text-blue-600 border-blue-100',
  work: 'bg-purple-50 text-purple-600 border-purple-100',
  career: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  personal: 'bg-green-50 text-green-600 border-green-100',
  health: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  other: 'bg-slate-100 text-slate-500 border-slate-200',
};

function GoalCard({ goal, onUpdate, onDelete }: {
  goal: Goal;
  onUpdate: (id: string, data: Partial<Goal>) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const completedTasks = goal.tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${CATEGORY_COLORS[goal.category] || CATEGORY_COLORS.other}`}>
                {goal.category}
              </span>
              {goal.priority === 'high' && <span className="badge-high">HIGH</span>}
              {goal.status !== 'active' && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">{goal.status}</span>
              )}
            </div>
            <h3 className="font-semibold text-slate-900 text-base mb-1">{goal.title}</h3>
            {goal.description && (
              <p className="text-sm text-slate-500 line-clamp-2">{goal.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              value={goal.status}
              onChange={e => onUpdate(goal.id, { status: e.target.value as any })}
              className="text-xs border border-slate-200 rounded-md px-1.5 py-1 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => onDelete(goal.id)} className="text-slate-300 hover:text-red-400 transition-colors p-1">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500">
              {completedTasks} of {goal.tasks.length} tasks complete
            </span>
            <span className="text-xs font-semibold text-indigo-600">{goal.progress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${goal.progress}%` }} />
          </div>
        </div>

        {/* Deadline & tasks toggle */}
        <div className="flex items-center justify-between mt-3">
          {goal.deadline ? (
            <span className="text-xs text-slate-400">
              Due {format(parseISO(goal.deadline), 'MMM d, yyyy')}
            </span>
          ) : <span />}
          {goal.tasks.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {expanded ? 'Hide' : 'Show'} tasks
            </button>
          )}
        </div>
      </div>

      {/* Task list */}
      {expanded && goal.tasks.length > 0 && (
        <div className="border-t border-slate-100 divide-y divide-slate-50">
          {goal.tasks.map((task: Task) => (
            <div key={task.id} className="flex items-center gap-3 px-5 py-2.5">
              {task.status === 'completed'
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                : <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />
              }
              <span className={`text-sm flex-1 ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                {task.title}
              </span>
              {task.priority === 'high' && <span className="badge-high text-xs">HIGH</span>}
            </div>
          ))}
        </div>
      )}

      {expanded && goal.tasks.length === 0 && (
        <div className="border-t border-slate-100 px-5 py-4 text-center">
          <p className="text-xs text-slate-400">No tasks yet. Ask FocusFlow AI to create tasks for this goal.</p>
        </div>
      )}
    </div>
  );
}

function CreateGoalModal({ onClose, onSave }: { onClose: () => void; onSave: (data: Partial<Goal>) => void }) {
  const [form, setForm] = useState<Partial<Goal>>({ title: '', priority: 'medium', category: 'other' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Create Goal</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="label">Goal title *</label>
            <input autoFocus className="input" placeholder="What do you want to achieve?" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} placeholder="More details..." value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
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
                {CATEGORY_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Deadline</label>
            <input type="date" className="input" value={form.deadline ? form.deadline.slice(0, 10) : ''} onChange={e => setForm({ ...form, deadline: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => { if (form.title) { onSave(form); onClose(); } }} className="btn-primary" disabled={!form.title}>
            Create Goal
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const [filterStatus, setFilterStatus] = useState('active');
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ['goals', filterStatus],
    queryFn: () => goalsApi.getAll({ status: filterStatus || undefined }).then(r => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Goal> }) => goalsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
    onError: () => toast.error('Failed to update goal'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => goalsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); toast.success('Goal deleted'); },
    onError: () => toast.error('Failed to delete goal'),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Goal>) => goalsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.success('Goal created!'); },
    onError: () => toast.error('Failed to create goal'),
  });

  return (
    <div className="page-container">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Goals</h1>
          <p className="page-subtitle">Track your long-term objectives and progress</p>
        </div>
        <button id="create-goal-btn" onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> New Goal
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-5">
        {['active', 'completed', 'paused', ''].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === s ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
      ) : goals.length === 0 ? (
        <div className="empty-state">
          <Target className="empty-state-icon" />
          <p className="empty-state-title">Start with something you want to achieve.</p>
          <p className="empty-state-subtitle mb-4">Goals help you organize tasks and track long-term progress.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Create your first goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onUpdate={(id, data) => updateMutation.mutate({ id, data })}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateGoalModal onClose={() => setShowCreate(false)} onSave={d => createMutation.mutate(d)} />
      )}
    </div>
  );
}
