import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tasksApi, Task } from '../lib/api';
import { Timer, Play, Pause, RotateCcw, SkipForward, Coffee, Brain, CheckCircle2, Settings, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

type Phase = 'focus' | 'short_break' | 'long_break';

interface Session {
  taskTitle: string;
  duration: number;
  completedAt: string;
  type: Phase;
}

const PHASE_CONFIG: Record<Phase, { label: string; color: string; gradient: string; icon: typeof Timer }> = {
  focus:       { label: 'Focus Time',   color: '#6366f1', gradient: 'from-indigo-500 to-purple-600', icon: Brain },
  short_break: { label: 'Short Break',  color: '#10b981', gradient: 'from-emerald-400 to-teal-500',  icon: Coffee },
  long_break:  { label: 'Long Break',   color: '#3b82f6', gradient: 'from-blue-400 to-indigo-500',   icon: Coffee },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function CircularProgress({
  progress,
  color,
  size = 240,
  children,
}: {
  progress: number;
  color: string;
  size?: number;
  children: React.ReactNode;
}) {
  const r = (size / 2) - 16;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#e2e8f0" strokeWidth="8"
        />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
  autoStartBreaks: boolean;
}

export default function PomodoroPage() {
  const [settings, setSettings] = useState<PomodoroSettings>({
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakInterval: 4,
    autoStartBreaks: false,
  });

  const [phase, setPhase] = useState<Phase>('focus');
  const [secondsLeft, setSecondsLeft] = useState(settings.focusMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sessions, setSessions] = useState<Session[]>(() => {
    try { return JSON.parse(localStorage.getItem('ff_pomodoro_sessions') || '[]'); }
    catch { return []; }
  });
  const [showSettings, setShowSettings] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalSeconds = useRef(settings.focusMinutes * 60);

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', 'todo'],
    queryFn: async () => {
      const res = await tasksApi.getAll({ status: 'todo' });
      return res.data;
    },
  });

  const phaseDuration = useCallback((p: Phase) => {
    if (p === 'focus') return settings.focusMinutes * 60;
    if (p === 'short_break') return settings.shortBreakMinutes * 60;
    return settings.longBreakMinutes * 60;
  }, [settings]);

  const completeSession = useCallback(() => {
    if (phase === 'focus') {
      const newCount = pomodoroCount + 1;
      setPomodoroCount(newCount);
      const session: Session = {
        taskTitle: selectedTask?.title ?? 'Untitled Focus',
        duration: settings.focusMinutes,
        completedAt: new Date().toISOString(),
        type: 'focus',
      };
      const updated = [session, ...sessions].slice(0, 20);
      setSessions(updated);
      localStorage.setItem('ff_pomodoro_sessions', JSON.stringify(updated));

      toast.success(`🍅 Pomodoro #${newCount} complete!`, { duration: 4000 });

      const nextPhase = newCount % settings.longBreakInterval === 0 ? 'long_break' : 'short_break';
      setPhase(nextPhase);
      const dur = nextPhase === 'long_break' ? settings.longBreakMinutes * 60 : settings.shortBreakMinutes * 60;
      totalSeconds.current = dur;
      setSecondsLeft(dur);
      if (settings.autoStartBreaks) setIsRunning(true);
      else setIsRunning(false);
    } else {
      toast(`☕ Break over — back to focus!`, { icon: '🎯' });
      setPhase('focus');
      totalSeconds.current = settings.focusMinutes * 60;
      setSecondsLeft(settings.focusMinutes * 60);
      setIsRunning(false);
    }
  }, [phase, pomodoroCount, selectedTask, sessions, settings]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            completeSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current!);
    }
    return () => clearInterval(intervalRef.current!);
  }, [isRunning, completeSession]);

  // Update title bar
  useEffect(() => {
    document.title = isRunning
      ? `${formatTime(secondsLeft)} — ${PHASE_CONFIG[phase].label} | FocusFlow`
      : 'Pomodoro | FocusFlow';
    return () => { document.title = 'FocusFlow AI'; };
  }, [secondsLeft, isRunning, phase]);

  const handleReset = () => {
    setIsRunning(false);
    const dur = phaseDuration(phase);
    totalSeconds.current = dur;
    setSecondsLeft(dur);
  };

  const handleSkip = () => {
    setIsRunning(false);
    completeSession();
  };

  const switchPhase = (p: Phase) => {
    setIsRunning(false);
    setPhase(p);
    const dur = phaseDuration(p);
    totalSeconds.current = dur;
    setSecondsLeft(dur);
  };

  const applySettings = (s: PomodoroSettings) => {
    setSettings(s);
    setIsRunning(false);
    setPhase('focus');
    totalSeconds.current = s.focusMinutes * 60;
    setSecondsLeft(s.focusMinutes * 60);
    setShowSettings(false);
  };

  const progress = ((totalSeconds.current - secondsLeft) / totalSeconds.current) * 100;
  const cfg = PHASE_CONFIG[phase];
  const Icon = cfg.icon;

  const todaysSessions = sessions.filter(s =>
    s.completedAt.startsWith(format(new Date(), 'yyyy-MM-dd'))
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Timer className="w-7 h-7 text-indigo-600" />
            Pomodoro Timer
          </h1>
          <p className="page-subtitle">Stay focused with timed work sessions</p>
        </div>
        <button onClick={() => setShowSettings(true)} className="btn-secondary">
          <Settings className="w-4 h-4" /> Settings
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timer main */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Phase tabs */}
          <div className="card p-1.5 flex gap-1">
            {(['focus', 'short_break', 'long_break'] as Phase[]).map(p => (
              <button
                key={p}
                onClick={() => switchPhase(p)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  phase === p
                    ? `bg-gradient-to-r ${PHASE_CONFIG[p].gradient} text-white shadow-sm`
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {PHASE_CONFIG[p].label}
              </button>
            ))}
          </div>

          {/* Timer circle */}
          <div className="card p-8 flex flex-col items-center gap-6">
            <CircularProgress progress={progress} color={cfg.color}>
              <div className="flex flex-col items-center gap-1">
                <Icon className="w-6 h-6" style={{ color: cfg.color }} />
                <span className="text-5xl font-bold text-slate-800 tabular-nums tracking-tight">
                  {formatTime(secondsLeft)}
                </span>
                <span className="text-sm font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
              </div>
            </CircularProgress>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all"
                title="Reset"
              >
                <RotateCcw className="w-4 h-4 text-slate-600" />
              </button>

              <button
                onClick={() => setIsRunning(r => !r)}
                className="w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg hover:shadow-xl active:scale-95"
                style={{ background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)` }}
              >
                {isRunning
                  ? <Pause className="w-6 h-6 text-white" />
                  : <Play className="w-6 h-6 text-white ml-1" />
                }
              </button>

              <button
                onClick={handleSkip}
                className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all"
                title="Skip"
              >
                <SkipForward className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            {/* Pomodoro dots */}
            <div className="flex items-center gap-2">
              {Array.from({ length: settings.longBreakInterval }, (_, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full transition-all"
                  style={{
                    backgroundColor: i < (pomodoroCount % settings.longBreakInterval)
                      ? cfg.color
                      : '#e2e8f0',
                  }}
                />
              ))}
              <span className="text-xs text-slate-400 ml-1">
                {pomodoroCount % settings.longBreakInterval}/{settings.longBreakInterval} until long break
              </span>
            </div>
          </div>

          {/* Task selector */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Working on...</h3>
            {selectedTask ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                <span className="text-sm font-medium text-slate-800 flex-1">{selectedTask.title}</span>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {tasks.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No pending tasks</p>
                ) : (
                  tasks.slice(0, 8).map((task: Task) => (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 border border-slate-100 hover:border-indigo-100 transition-all flex items-center gap-2.5"
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        task.priority === 'high' ? 'bg-red-400' :
                        task.priority === 'medium' ? 'bg-amber-400' : 'bg-slate-300'
                      }`} />
                      <span className="text-sm text-slate-700 truncate">{task.title}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-5">
          {/* Today's stats */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Today's Progress</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-indigo-50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-indigo-600">
                  {todaysSessions.filter(s => s.type === 'focus').length}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Pomodoros</div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-emerald-600">
                  {todaysSessions.filter(s => s.type === 'focus').reduce((a, s) => a + s.duration, 0)}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Minutes</div>
              </div>
            </div>

            {/* Total session count */}
            <div className="mt-3 flex items-center gap-2 bg-amber-50 rounded-xl p-3">
              <CheckCircle2 className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <div>
                <div className="text-sm font-bold text-amber-700">{pomodoroCount} total</div>
                <div className="text-xs text-slate-500">all time this session</div>
              </div>
            </div>
          </div>

          {/* Session log */}
          <div className="card p-5 flex-1">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent Sessions</h3>
            {sessions.length === 0 ? (
              <div className="empty-state py-8">
                <Timer className="empty-state-icon" />
                <p className="empty-state-subtitle">No sessions yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {sessions.map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5 py-2 border-b border-slate-50 last:border-0">
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: PHASE_CONFIG[s.type].color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{s.taskTitle}</p>
                      <p className="text-[10px] text-slate-400">
                        {format(new Date(s.completedAt), 'HH:mm')} · {s.duration}min
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={applySettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function SettingsModal({
  settings,
  onSave,
  onClose,
}: {
  settings: PomodoroSettings;
  onSave: (s: PomodoroSettings) => void;
  onClose: () => void;
}) {
  const [s, setS] = useState(settings);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            Timer Settings
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {[
            { key: 'focusMinutes',       label: 'Focus Duration',      min: 5,  max: 90  },
            { key: 'shortBreakMinutes',  label: 'Short Break',         min: 1,  max: 30  },
            { key: 'longBreakMinutes',   label: 'Long Break',          min: 5,  max: 60  },
            { key: 'longBreakInterval',  label: 'Pomodoros per Cycle', min: 2,  max: 8   },
          ].map(({ key, label, min, max }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-slate-700 flex-1">{label}</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setS(prev => ({ ...prev, [key]: Math.max(min, (prev as any)[key] - 1) }))}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm"
                >-</button>
                <span className="w-8 text-center text-sm font-semibold text-slate-800">
                  {(s as any)[key]}
                </span>
                <button
                  type="button"
                  onClick={() => setS(prev => ({ ...prev, [key]: Math.min(max, (prev as any)[key] + 1) }))}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm"
                >+</button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Auto-start Breaks</label>
            <button
              type="button"
              onClick={() => setS(prev => ({ ...prev, autoStartBreaks: !prev.autoStartBreaks }))}
              className={`w-10 h-5 rounded-full transition-all relative ${s.autoStartBreaks ? 'bg-indigo-600' : 'bg-slate-200'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-all ${s.autoStartBreaks ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => onSave(s)} className="btn-primary flex-1">Apply</button>
        </div>
      </div>
    </div>
  );
}
