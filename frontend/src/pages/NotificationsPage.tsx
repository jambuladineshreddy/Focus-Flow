import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { notificationsApi, tasksApi, Task } from '../lib/api';
import toast from 'react-hot-toast';
import {
  Bell, Mail, Send, CheckCircle2, XCircle, Zap,
  Clock, Calendar, Target, AlertTriangle, ChevronRight,
  ExternalLink, Info
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function StatusBadge({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
      <CheckCircle2 className="w-3.5 h-3.5" /> Connected
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100">
      <XCircle className="w-3.5 h-3.5" /> Not Configured
    </span>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? '');
  const [selectedTaskId, setSelectedTaskId] = useState('');

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['notification-status'],
    queryFn: async () => {
      const res = await notificationsApi.getStatus();
      return res.data;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', 'todo'],
    queryFn: async () => {
      const res = await tasksApi.getAll({ status: 'todo' });
      return res.data;
    },
  });

  const configured = status?.gmail_configured ?? false;

  const testMutation = useMutation({
    mutationFn: () => notificationsApi.sendTest(email),
    onSuccess: () => toast.success('Test email sent! Check your inbox 📬'),
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to send test email'),
  });

  const digestMutation = useMutation({
    mutationFn: () => notificationsApi.sendDailyDigest(email),
    onSuccess: () => toast.success('Daily digest sent! 📅'),
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to send digest'),
  });

  const reminderMutation = useMutation({
    mutationFn: () => notificationsApi.sendTaskReminder(email, selectedTaskId),
    onSuccess: () => toast.success('Task reminder sent! ⏰'),
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to send reminder'),
  });

  const actionCards = [
    {
      icon: Send,
      color: '#6366f1',
      bg: '#eef2ff',
      title: 'Send Test Email',
      desc: 'Verify your Gmail connection is working correctly.',
      action: () => testMutation.mutate(),
      loading: testMutation.isPending,
      label: 'Send Test',
    },
    {
      icon: Calendar,
      color: '#10b981',
      bg: '#ecfdf5',
      title: 'Daily Digest',
      desc: "Get today's task summary, overdue items, and goal progress.",
      action: () => digestMutation.mutate(),
      loading: digestMutation.isPending,
      label: 'Send Digest',
    },
  ];

  return (
    <div className="page-container max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title flex items-center gap-2">
          <Bell className="w-7 h-7 text-indigo-600" />
          Gmail Notifications
        </h1>
        <p className="page-subtitle">Stay on top of your tasks with email alerts sent directly to your Gmail</p>
      </div>

      {/* Gmail Status Card */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl">
              📧
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 text-sm">Gmail SMTP Status</h2>
              <p className="text-xs text-slate-400">
                {statusLoading ? 'Checking...' : status?.gmail_user ?? 'No account configured'}
              </p>
            </div>
          </div>
          {!statusLoading && <StatusBadge configured={configured} />}
        </div>

        {!configured && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
            <div className="flex gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-amber-700">Gmail credentials not configured</p>
            </div>
            <p className="text-xs text-amber-600 mb-3">
              Add these to your <code className="bg-amber-100 px-1 rounded">backend/.env</code> file:
            </p>
            <div className="bg-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-400 space-y-1">
              <div><span className="text-slate-400"># Step 1: Enable 2FA on your Google account</span></div>
              <div><span className="text-slate-400"># Step 2: Generate an App Password</span></div>
              <div>GMAIL_USER=<span className="text-yellow-300">your@gmail.com</span></div>
              <div>GMAIL_APP_PASSWORD=<span className="text-yellow-300">xxxx xxxx xxxx xxxx</span></div>
            </div>
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              <ExternalLink className="w-3 h-3" />
              Generate App Password on Google →
            </a>
          </div>
        )}

        {configured && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p className="text-sm text-emerald-700">
              Gmail connected as <strong>{status?.gmail_user}</strong>
            </p>
          </div>
        )}
      </div>

      {/* Recipient Email */}
      <div className="card p-5 mb-5">
        <label className="label flex items-center gap-2">
          <Mail className="w-4 h-4 text-slate-400" />
          Send notifications to
        </label>
        <input
          className="input"
          type="email"
          placeholder="recipient@gmail.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <p className="text-xs text-slate-400 mt-1.5">
          Defaults to your account email. Can be any address.
        </p>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {actionCards.map(({ icon: Icon, color, bg, title, desc, action, loading, label }) => (
          <div key={title} className="card p-5 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: bg }}
              >
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
              </div>
            </div>
            <button
              onClick={action}
              disabled={!email || loading || !configured}
              className="btn-primary w-full"
              style={configured ? { backgroundColor: color, borderColor: color } : {}}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </span>
              ) : (
                <><Send className="w-4 h-4" /> {label}</>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Task reminder */}
      <div className="card p-5 mb-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">Task Reminder</h3>
            <p className="text-xs text-slate-400 mt-0.5">Send a priority reminder for a specific task.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Select Task</label>
            <select
              className="input"
              value={selectedTaskId}
              onChange={e => setSelectedTaskId(e.target.value)}
            >
              <option value="">-- Pick a task --</option>
              {tasks.map((t: Task) => (
                <option key={t.id} value={t.id}>
                  [{t.priority?.toUpperCase()}] {t.title}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => reminderMutation.mutate()}
            disabled={!email || !selectedTaskId || reminderMutation.isPending || !configured}
            className="btn-primary w-full"
            style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}
          >
            {reminderMutation.isPending ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending...
              </span>
            ) : (
              <><Clock className="w-4 h-4" /> Send Reminder</>
            )}
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-500" />
          How Gmail Notifications Work
        </h3>
        <div className="space-y-3">
          {[
            { step: '1', title: 'Enable 2-Step Verification', desc: 'Go to your Google Account → Security → 2-Step Verification and turn it on.' },
            { step: '2', title: 'Generate an App Password', desc: 'In Google Account → Security → App Passwords, create one for "FocusFlow".' },
            { step: '3', title: 'Add to .env file', desc: 'Set GMAIL_USER and GMAIL_APP_PASSWORD in your backend/.env file, then restart the server.' },
            { step: '4', title: 'Send notifications', desc: 'Use the actions above to send test emails, daily digests, and task reminders.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {step}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">{title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
