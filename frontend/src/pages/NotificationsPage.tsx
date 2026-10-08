import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, tasksApi, Task, NotificationSettingsData } from '../lib/api';
import toast from 'react-hot-toast';
import {
  Bell, Mail, Send, CheckCircle2, XCircle,
  Clock, Calendar, AlertTriangle,
  ExternalLink, Info, Key, ShieldCheck, Eye, EyeOff,
  Save, RefreshCw, Sparkles, ArrowRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [notificationEmail, setNotificationEmail] = useState('');
  const [smtpEmail, setSmtpEmail] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dailyDigest, setDailyDigest] = useState(true);
  const [taskReminders, setTaskReminders] = useState(true);
  const [goalAlerts, setGoalAlerts] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState('');

  // Fetch full settings from backend
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: async () => {
      const res = await notificationsApi.getSettings();
      return res.data;
    },
  });

  // Fetch todo tasks for manual reminder trigger
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', 'todo'],
    queryFn: async () => {
      const res = await tasksApi.getAll({ status: 'todo' });
      return res.data;
    },
  });

  // Sync settings when loaded
  useEffect(() => {
    if (settings) {
      setNotificationEmail(settings.notification_email || settings.account_email || user?.email || '');
      setSmtpEmail(settings.smtp_email || '');
      setDailyDigest(settings.daily_digest_enabled ?? true);
      setTaskReminders(settings.task_reminders_enabled ?? true);
      setGoalAlerts(settings.goal_alerts_enabled ?? true);
    } else if (user?.email) {
      setNotificationEmail(user.email);
    }
  }, [settings, user]);

  const isReady = settings?.is_ready_to_send ?? false;
  const senderMode = settings?.sender_mode ?? 'none';

  // Save Settings Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        notification_email: notificationEmail.trim(),
        smtp_email: smtpEmail.trim(),
        daily_digest_enabled: dailyDigest,
        task_reminders_enabled: taskReminders,
        goal_alerts_enabled: goalAlerts,
      };
      if (smtpPassword.trim()) {
        payload.smtp_password = smtpPassword.trim();
      }
      return await notificationsApi.updateSettings(payload);
    },
    onSuccess: () => {
      toast.success('Notification settings saved successfully! ✨');
      setSmtpPassword('');
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      queryClient.invalidateQueries({ queryKey: ['notification-status'] });
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.detail ?? 'Failed to save settings');
    },
  });

  // Verify SMTP Connection Mutation
  const verifyMutation = useMutation({
    mutationFn: async () => {
      return await notificationsApi.verifySmtp({
        smtp_email: smtpEmail.trim() || undefined,
        smtp_password: smtpPassword.trim() || undefined,
      });
    },
    onSuccess: (res) => {
      toast.success(res.data.message || 'SMTP Authentication successful! 🎉');
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.detail ?? 'SMTP authentication failed. Check credentials.');
    },
  });

  // Test Email Mutation
  const testMutation = useMutation({
    mutationFn: () => notificationsApi.sendTest(notificationEmail),
    onSuccess: () => toast.success('Test email queued! Check your inbox 📬'),
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to send test email'),
  });

  // Daily Digest Mutation
  const digestMutation = useMutation({
    mutationFn: () => notificationsApi.sendDailyDigest(notificationEmail),
    onSuccess: () => toast.success('Daily digest sent! 📅'),
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to send digest'),
  });

  // Task Reminder Mutation
  const reminderMutation = useMutation({
    mutationFn: () => notificationsApi.sendTaskReminder(notificationEmail, selectedTaskId),
    onSuccess: () => toast.success('Task reminder sent! ⏰'),
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to send reminder'),
  });

  return (
    <div className="page-container max-w-4xl py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2.5 text-2xl font-bold text-slate-900">
          <Bell className="w-7 h-7 text-indigo-600" />
          Email & Notifications Setup
        </h1>
        <p className="page-subtitle text-sm text-slate-500 mt-1">
          Configure where notifications are sent and connect your Gmail account directly from the app — no backend edits required.
        </p>
      </div>

      {/* System Status Banner */}
      <div className="card p-5 border shadow-sm rounded-2xl bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${
              isReady ? 'bg-emerald-50 border border-emerald-100 text-emerald-600' : 'bg-amber-50 border border-amber-100 text-amber-600'
            }`}>
              {isReady ? '📬' : '⚙️'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-800 text-base">Notification Engine Status</h2>
                {isReady ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {senderMode === 'user' ? 'Personal Gmail Connected' : 'Server SMTP Active'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5" /> Setup Required
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isReady
                  ? `Active sender: ${senderMode === 'user' ? settings?.smtp_email : settings?.system_email} → delivering to ${notificationEmail || settings?.account_email}`
                  : 'Enter your Gmail address & App Password below to start receiving notifications.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['notification-settings'] })}
            className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${settingsLoading ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Delivery Destination & Preferences */}
        <div className="card p-6 border shadow-sm rounded-2xl bg-white flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-base border-b pb-3">
              <Mail className="w-5 h-5 text-indigo-600" />
              Delivery Destination & Preferences
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Account Registered Email
              </label>
              <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-mono">
                {settings?.account_email || user?.email || 'Loading...'}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Notification Recipient Email
                </label>
                {user?.email && notificationEmail !== user.email && (
                  <button
                    type="button"
                    onClick={() => setNotificationEmail(user.email)}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Reset to account email
                  </button>
                )}
              </div>
              <input
                type="email"
                className="input w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="recipient@example.com"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1">
                Every user can specify their own delivery email or keep their account email.
              </p>
            </div>

            <div className="pt-2 border-t space-y-3">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Notification Types
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dailyDigest}
                  onChange={(e) => setDailyDigest(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-sm text-slate-700 font-medium">Daily morning productivity digest</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={taskReminders}
                  onChange={(e) => setTaskReminders(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-sm text-slate-700 font-medium">Task deadline & high priority reminders</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={goalAlerts}
                  onChange={(e) => setGoalAlerts(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-sm text-slate-700 font-medium">Goal progress & milestone celebrations</span>
              </label>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="btn-primary w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold shadow-sm"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>

        {/* Card 2: Personal Gmail Sender Authentication */}
        <div className="card p-6 border shadow-sm rounded-2xl bg-white flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-slate-800 font-semibold text-base">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                Gmail Sender Authentication
              </div>
              {settings?.has_smtp_password && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
                  Password Stored
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500">
              Configure your personal Gmail credentials to send emails from your own address. No server files or backend configuration needed.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Your Gmail Address (Sender)
              </label>
              <input
                type="email"
                className="input w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="your.email@gmail.com"
                value={smtpEmail}
                onChange={(e) => setSmtpEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Google 16-Character App Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={settings?.has_smtp_password ? '●●●● ●●●● ●●●● ●●●● (Saved - Enter new to change)' : 'xxxx xxxx xxxx xxxx'}
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {settings?.has_smtp_password
                  ? 'App password is saved securely. Leave blank unless you want to update it.'
                  : 'Requires a Google App Password (not your regular Google account password).'}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending || (!smtpEmail && !settings?.smtp_email)}
                className="flex-1 py-2 px-3 border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <Key className="w-3.5 h-3.5" />
                {verifyMutation.isPending ? 'Verifying...' : 'Verify Connection'}
              </button>

              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                <Save className="w-3.5 h-3.5" />
                {saveMutation.isPending ? 'Saving...' : 'Save Credentials'}
              </button>
            </div>
          </div>

          {/* Quick Guide Card */}
          <div className="mt-4 pt-3 border-t">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-600 space-y-1.5">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-500" /> How to get a Google App Password:
              </div>
              <ol className="list-decimal list-inside space-y-0.5 text-slate-500 pl-1">
                <li>Go to Google Account → Security → 2-Step Verification (Turn ON).</li>
                <li>Search for "App Passwords" in your Google Account.</li>
                <li>Create an app password for "FocusFlow" and paste the 16 letters above.</li>
              </ol>
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-indigo-600 font-medium hover:underline pt-1"
              >
                Open Google App Passwords <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Immediate Actions */}
      <div className="card p-6 border shadow-sm rounded-2xl bg-white space-y-4">
        <div className="border-b pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-base">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            Test & Trigger Notifications
          </div>
          <span className="text-xs text-slate-500">
            Delivering to: <strong className="text-slate-800">{notificationEmail || user?.email}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Action 1: Send Test Email */}
          <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Send className="w-4 h-4 text-indigo-600" />
                <h3 className="font-semibold text-sm text-slate-800">Send Test Email</h3>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Verify that your configured Gmail sender can deliver messages to your inbox.
              </p>
            </div>
            <button
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !isReady}
              className="btn-primary w-full py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
            >
              {testMutation.isPending ? 'Sending...' : 'Send Test Email'}
            </button>
          </div>

          {/* Action 2: Send Daily Digest */}
          <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <h3 className="font-semibold text-sm text-slate-800">Daily Digest</h3>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Receive an instant snapshot of today's tasks, overdue items, and goal progress.
              </p>
            </div>
            <button
              onClick={() => digestMutation.mutate()}
              disabled={digestMutation.isPending || !isReady}
              className="w-full py-2 px-3 text-xs font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-1.5 transition"
            >
              {digestMutation.isPending ? 'Sending...' : 'Send Daily Digest'}
            </button>
          </div>

          {/* Action 3: Send Task Reminder */}
          <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <h3 className="font-semibold text-sm text-slate-800">Task Reminder</h3>
              </div>
              <p className="text-xs text-slate-500 mb-2">
                Send an immediate priority reminder for a selected task.
              </p>
              <select
                className="input w-full p-1.5 mb-3 text-xs rounded-lg border border-slate-200 bg-white"
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
              >
                <option value="">-- Choose a task --</option>
                {tasks.map((t: Task) => (
                  <option key={t.id} value={t.id}>
                    [{t.priority.toUpperCase()}] {t.title}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => reminderMutation.mutate()}
              disabled={reminderMutation.isPending || !selectedTaskId || !isReady}
              className="w-full py-2 px-3 text-xs font-semibold rounded-lg text-white bg-amber-600 hover:bg-amber-700 flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              {reminderMutation.isPending ? 'Sending...' : 'Send Task Alert'}
            </button>
          </div>
        </div>

        {!isReady && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
            <span>
              Actions are locked until Gmail sender credentials are configured above. Any user can connect their own Gmail account!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
