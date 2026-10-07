import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { habitsApi, Habit } from '../lib/api';
import toast from 'react-hot-toast';
import {
  Plus, Flame, Trophy, Trash2, X, Check, Edit2, Target,
  ChevronLeft, ChevronRight, Zap
} from 'lucide-react';
import { format, subDays, isToday, parseISO } from 'date-fns';

const PRESET_ICONS = ['💪', '📚', '🧘', '🏃', '💧', '🥗', '😴', '✍️', '🎯', '🧠', '🎨', '💻'];
const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6',
];

function HabitCard({
  habit,
  onToggle,
  onDelete,
}: {
  habit: Habit;
  onToggle: (habitId: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayLog = habit.logs.find(l => l.date === today);
  const isDone = todayLog?.completed ?? false;

  // Last 7 days history
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
    const log = habit.logs.find(l => l.date === d);
    return { date: d, done: log?.completed ?? false };
  });

  return (
    <div className="card p-5 flex flex-col gap-4 transition-all duration-200 hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: habit.color + '22', border: `2px solid ${habit.color}33` }}
          >
            {habit.icon}
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm leading-tight">{habit.title}</h3>
            {habit.description && (
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{habit.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => onDelete(habit.id)}
          className="text-slate-300 hover:text-red-400 transition-colors p-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-bold text-slate-700">{habit.streak}</span>
          <span className="text-xs text-slate-400">day streak</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-bold text-slate-700">{habit.total_completions}</span>
          <span className="text-xs text-slate-400">total</span>
        </div>
      </div>

      {/* 7-day history */}
      <div className="flex gap-1.5 items-center">
        {last7.map(({ date, done }) => {
          const isT = date === today;
          return (
            <div
              key={date}
              className="flex flex-col items-center gap-1"
              title={format(parseISO(date), 'MMM d')}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                style={{
                  backgroundColor: done ? habit.color : '#f1f5f9',
                  border: isT ? `2px solid ${habit.color}` : '2px solid transparent',
                }}
              >
                {done && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
              </div>
              <span className="text-[9px] text-slate-400">{format(parseISO(date), 'EEE')[0]}</span>
            </div>
          );
        })}
      </div>

      {/* Today's action */}
      <button
        onClick={() => onToggle(habit.id, !isDone)}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2"
        style={{
          backgroundColor: isDone ? habit.color : 'transparent',
          color: isDone ? '#fff' : habit.color,
          border: `2px solid ${habit.color}`,
        }}
      >
        {isDone ? (
          <><Check className="w-4 h-4" strokeWidth={3} /> Done Today!</>
        ) : (
          <><Zap className="w-4 h-4" /> Mark Complete</>
        )}
      </button>
    </div>
  );
}

function HabitModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: Partial<Habit>) => void }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [icon, setIcon] = useState('✅');
  const [color, setColor] = useState('#6366f1');
  const [frequency, setFrequency] = useState('daily');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({ title: title.trim(), description: desc, icon, color, frequency, target_days: 7 });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">New Habit</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Icon picker */}
          <div>
            <label className="label">Icon</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_ICONS.map(em => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setIcon(em)}
                  className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all ${icon === em ? 'ring-2 ring-indigo-500 bg-indigo-50' : 'hover:bg-slate-100'}`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="label">Color</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="label">Habit Name *</label>
            <input
              className="input"
              placeholder="e.g. Morning workout"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Description</label>
            <input
              className="input"
              placeholder="Optional description"
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Frequency</label>
            <select className="input" value={frequency} onChange={e => setFrequency(e.target.value)}>
              <option value="daily">Every Day</option>
              <option value="weekdays">Weekdays Only</option>
              <option value="weekends">Weekends Only</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Create Habit</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function HabitsPage() {
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: habits = [], isLoading } = useQuery({
    queryKey: ['habits'],
    queryFn: async () => {
      const res = await habitsApi.getAll();
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Habit>) => habitsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      toast.success('Habit created!');
    },
    onError: () => toast.error('Failed to create habit'),
  });

  const logMutation = useMutation({
    mutationFn: ({ habitId, completed }: { habitId: string; completed: boolean }) =>
      habitsApi.log(habitId, { date: format(new Date(), 'yyyy-MM-dd'), completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    },
    onError: () => toast.error('Failed to update habit'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => habitsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      toast.success('Habit deleted');
    },
  });

  const completedToday = habits.filter(h => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return h.logs.some(l => l.date === today && l.completed);
  }).length;

  const longestStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Target className="w-7 h-7 text-indigo-600" />
            Habit Tracker
          </h1>
          <p className="page-subtitle">Build consistency, one day at a time</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> New Habit
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-500" />
            <span className="stat-label">Done Today</span>
          </div>
          <div className="stat-value">{completedToday}<span className="text-lg text-slate-400">/{habits.length}</span></div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <span className="stat-label">Best Streak</span>
          </div>
          <div className="stat-value">{longestStreak}<span className="text-sm text-slate-400 font-normal ml-1">days</span></div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span className="stat-label">Total Habits</span>
          </div>
          <div className="stat-value">{habits.length}</div>
        </div>
      </div>

      {/* Habits grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-52 rounded-xl" />
          ))}
        </div>
      ) : habits.length === 0 ? (
        <div className="empty-state">
          <Target className="empty-state-icon" />
          <p className="empty-state-title">No habits yet</p>
          <p className="empty-state-subtitle">Create your first habit to start building consistency</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mt-4">
            <Plus className="w-4 h-4" /> Add First Habit
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {habits.map(habit => (
            <HabitCard
              key={habit.id}
              habit={habit}
              onToggle={(habitId, completed) => logMutation.mutate({ habitId, completed })}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <HabitModal
          onClose={() => setShowModal(false)}
          onCreate={(data) => createMutation.mutate(data)}
        />
      )}
    </div>
  );
}
