import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../lib/api';
import { Zap, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', full_name: '' });
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let res;
      if (mode === 'login') {
        res = await authApi.login({ email: form.email, password: form.password });
      } else {
        res = await authApi.register(form);
      }
      login(res.data.access_token, res.data.user);
      navigate('/dashboard');
    } catch (err: any) {
      if (!err.response) {
        // Network error — backend likely not running
        toast.error('Cannot reach the server. Please make sure the backend is running.');
      } else {
        const detail = err.response?.data?.detail;
        let msg: string;
        if (typeof detail === 'string') {
          msg = detail;
        } else if (Array.isArray(detail) && detail.length > 0) {
          // FastAPI 422 validation errors — extract first human-readable message
          msg = detail[0]?.msg || detail[0]?.message || 'Validation error';
          // Capitalise first letter
          msg = msg.charAt(0).toUpperCase() + msg.slice(1);
        } else {
          msg = 'Something went wrong. Please try again.';
        }
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-slate-900 p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg">FocusFlow AI</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Your AI-powered<br />
            <span className="text-indigo-400">productivity partner</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed">
            Turn goals into plans, manage tasks intelligently, and stay on top of what matters most.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { label: 'Natural language task creation', icon: '✦' },
              { label: 'AI-powered daily planning', icon: '✦' },
              { label: 'Knowledge base with RAG search', icon: '✦' },
              { label: 'Smart calendar scheduling', icon: '✦' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-indigo-400 text-xs">{item.icon}</span>
                <span className="text-slate-300 text-sm">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-xs">
          Built for students, professionals, freelancers & job seekers.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">FocusFlow AI</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-slate-500 text-sm mb-8">
            {mode === 'login'
              ? 'Sign in to continue to FocusFlow AI'
              : 'Start managing your productivity with AI'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">Full name</label>
                <input
                  id="full_name"
                  type="text"
                  className="input"
                  placeholder="Your name"
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  required
                  minLength={2}
                />
              </div>
            )}

            <div>
              <label className="label">Email address</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="submit-btn"
              className="btn-primary w-full py-2.5"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : (
                mode === 'login' ? 'Sign in' : 'Create account'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-indigo-600 font-medium hover:text-indigo-700"
            >
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
