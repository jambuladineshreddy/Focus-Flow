import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../lib/api';
import { User, Save, LogOut, Clock, Globe, Palette } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#10b981', '#3b82f6', '#14b8a6',
];

export default function SettingsPage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    timezone: user?.timezone || 'UTC',
    working_hours_start: user?.working_hours_start ?? 9,
    working_hours_end: user?.working_hours_end ?? 18,
    avatar_color: user?.avatar_color || '#6366f1',
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => authApi.updateMe(data),
    onSuccess: (res) => {
      updateUser(res.data);
      toast.success('Settings saved');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className="page-container max-w-2xl">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your account and productivity preferences</p>
      </div>

      <div className="space-y-6">
        {/* Profile */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <User className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800">Profile</h2>
          </div>

          <div className="flex items-center gap-4 mb-5">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
              style={{ backgroundColor: form.avatar_color }}
            >
              {initials}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">{user?.email}</p>
              <p className="text-xs text-slate-400 mt-0.5">Your account email</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input
                className="input"
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Avatar color */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <Palette className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800">Avatar Color</h2>
          </div>
          <div className="flex gap-3 flex-wrap">
            {AVATAR_COLORS.map(color => (
              <button
                key={color}
                onClick={() => setForm({ ...form, avatar_color: color })}
                className={`w-9 h-9 rounded-xl transition-transform ${
                  form.avatar_color === color ? 'ring-2 ring-offset-2 ring-indigo-400 scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Working hours */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <Clock className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800">Working Hours</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            FocusFlow AI uses these hours when planning your schedule to avoid over-scheduling.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start time</label>
              <select
                className="input"
                value={form.working_hours_start}
                onChange={e => setForm({ ...form, working_hours_start: Number(e.target.value) })}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">End time</label>
              <select
                className="input"
                value={form.working_hours_end}
                onChange={e => setForm({ ...form, working_hours_end: Number(e.target.value) })}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Timezone */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <Globe className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800">Timezone</h2>
          </div>
          <select
            className="input"
            value={form.timezone}
            onChange={e => setForm({ ...form, timezone: e.target.value })}
          >
            {[
              'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
              'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
              'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
            ].map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            id="save-settings-btn"
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
            className="btn-primary flex-1"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="btn-danger flex-1"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
