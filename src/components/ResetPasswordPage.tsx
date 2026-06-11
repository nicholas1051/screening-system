import React, { useState, useEffect } from 'react';
import { ChevronRight, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { changePassword } from '../lib/db';

interface ResetPasswordPageProps {
  onBackToLogin: () => void;
}

export default function ResetPasswordPage({ onBackToLogin }: ResetPasswordPageProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) { setToast('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setToast('Passwords do not match'); return; }
    setSubmitting(true);
    const { error } = await changePassword(newPassword);
    if (error) { setToast(error.message); setSubmitting(false); return; }
    setToast('Password updated. Redirecting to login...');
    setTimeout(() => onBackToLogin(), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-slate-900 flex items-center justify-center p-4 overflow-hidden relative">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/3 right-1/4 w-[32rem] h-[32rem] bg-accent-500/8 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }} />
      <div className={`w-full max-w-md transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="card-glass p-8">
          {!ready ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 border-4 border-accent-200 border-t-accent-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/70">Verifying reset token...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-xl font-bold text-white">Set New Password</h2>
                <p className="text-sm text-slate-300 mt-1">Enter your new password below.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">New Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-black/20 focus:bg-black/30 text-white placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 pr-10"
                    required autoFocus />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white/70 transition-colors">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-black/20 focus:bg-black/30 text-white placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
                  required />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-accent-500 hover:bg-accent-600 disabled:bg-accent-500/60 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-accent-500/25 hover:shadow-accent-500/40 active:scale-[0.97]">
                {submitting ? 'Updating...' : 'Update Password'}
                <ChevronRight size={18} />
              </button>
              <button type="button" onClick={onBackToLogin}
                className="w-full text-sm text-slate-400 hover:text-white/70 text-center transition-colors py-1">
                Back to Login
              </button>
            </form>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 bg-slate-800 text-white px-5 py-3 rounded-xl shadow-xl z-50 animate-fade-in-up flex items-center gap-3 max-w-sm">
          <span className="text-sm">{toast}</span>
        </div>
      )}
    </div>
  );
}
