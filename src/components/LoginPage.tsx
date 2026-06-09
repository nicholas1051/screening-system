import React, { useState, useEffect } from 'react';
import { GraduationCap, ShieldCheck, BarChart3, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { signIn, getProfile, lookupStudentEmailByRegNo, resetPassword } from '../lib/db';
import type { Profile } from '../lib/db';

type Role = 'student' | 'officer' | 'hod';

const roles: { key: Role; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'student', label: 'Student', icon: GraduationCap, desc: 'Upload & track your clearance documents' },
  { key: 'officer', label: 'Clearance Officer', icon: ShieldCheck, desc: 'Review & verify student credentials' },
  { key: 'hod', label: 'HOD / Admin', icon: BarChart3, desc: 'Oversee analytics & admission data' },
];

interface LoginPageProps {
  onLogin: (profile: Profile) => void;
  onTerms: () => void;
}

export default function LoginPage({ onLogin, onTerms }: LoginPageProps) {
  const [selectedRole, setSelectedRole] = useState<Role>('student');
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); } }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) { setToast('Please enter email and password'); return; }
    setSubmitting(true);

    let loginEmail = identifier;
    // Students log in with reg_no; staff use email
    if (selectedRole === 'student' && !identifier.includes('@')) {
      const { email, error: lookupError } = await lookupStudentEmailByRegNo(identifier);
      if (lookupError || !email) {
        setToast('Registration number not found. Contact admin.');
        setSubmitting(false);
        return;
      }
      loginEmail = email;
    }
    const { data, error } = await signIn(loginEmail, password);
    if (error || !data?.user) {
      setToast(error?.message || 'Invalid credentials');
      setSubmitting(false);
      return;
    }
    const { data: profile, error: profileError } = await getProfile(data.user.id);
    if (profileError || !profile) {
      setToast('Account not fully set up. Contact admin.');
      setSubmitting(false);
      return;
    }
    const p = profile as Profile;
    if (p.role !== selectedRole) {
      setToast(`This account is registered as ${p.role}, not ${selectedRole}`);
      setSubmitting(false);
      return;
    }
    if (!p.active) {
      setToast('Your account has been deactivated. Contact admin.');
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onLogin(p);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-slate-900 flex items-center justify-center p-4 overflow-hidden relative">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/3 right-1/4 w-[32rem] h-[32rem] bg-accent-500/8 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary-600/10 rounded-full blur-3xl" />

      <div className={`w-full max-w-5xl flex flex-col lg:flex-row items-center gap-8 lg:gap-16 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {/* Branding */}
        <div className="flex-1 text-center">
          <div className="inline-flex items-center justify-center w-36 h-36 bg-white p-1.5 rounded-full mb-6 animate-fade-in shadow-lg shadow-white/10 ring-2 ring-white/20">
            <img src="/uniabuja-logo.webp" alt="UniAbuja" className="w-full h-full rounded-full object-cover" />
          </div>
          <h1 className="text-5xl lg:text-6xl font-extrabold text-white leading-tight animate-fade-in-up tracking-tight">UniAbuja</h1>
          <p className="text-xl text-primary-100 mt-4 max-w-md animate-fade-in-up stagger-1 font-medium leading-relaxed">University of Abuja</p>
          <p className="text-primary-300 text-base mt-2 max-w-md animate-fade-in-up stagger-2">Online Departmental Student Screening System with Analytics Dashboard</p>
          <div className="hidden lg:block mt-10 animate-fade-in-up stagger-3" />
        </div>

        {/* Login Card */}
        <div className="w-full max-w-md animate-fade-in-up stagger-2">
          <div className="card-glass p-8">
            <div className="flex bg-white/10 backdrop-blur p-1 rounded-xl mb-6">
              {roles.map((role) => (
                <button key={role.key} onClick={() => { setSelectedRole(role.key); setShowPassword(false); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all duration-300 ${
                    selectedRole === role.key ? 'bg-white text-primary-800 shadow-lg shadow-black/10' : 'text-white/60 hover:text-white/90'
                  }`}
                >
                  <role.icon size={18} />
                  <span className="hidden sm:inline">{role.label}</span>
                </button>
              ))}
            </div>

            <p className="text-sm text-slate-300 mb-1">Sign in as <span className="font-semibold text-white">{roles.find(r => r.key === selectedRole)?.label}</span></p>
            <p className="text-xs text-slate-400 mb-6">{roles.find(r => r.key === selectedRole)?.desc}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="animate-fade-in-up">
                <label className="block text-sm font-medium text-white/80 mb-1.5">{selectedRole === 'student' ? 'Reg. No / Email' : 'Email Address'}</label>
                <input type={selectedRole === 'student' ? 'text' : 'email'} value={identifier} onChange={e => setIdentifier(e.target.value)}
                  placeholder={selectedRole === 'student' ? '202630123456AB or email' : `${selectedRole}@uniabuja.edu.ng`}
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-black/20 focus:bg-black/30 text-white placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
                  required autoComplete={selectedRole === 'student' ? 'username' : 'email'} />
              </div>
              <div className="animate-fade-in-up stagger-4">
                <label className="block text-sm font-medium text-white/80 mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-black/20 focus:bg-black/30 text-white placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 pr-10"
                    required autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white/70 transition-colors">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
                  <input type="checkbox" className="rounded border-slate-500 bg-black/30 text-accent-500 focus:ring-accent-400/30" /> Remember me
                </label>
                <button type="button" onClick={async () => {
                  if (!identifier.trim()) { setToast('Enter your email address first'); return; }
                  const { error } = await resetPassword(identifier.trim());
                  if (error) setToast(error.message);
                  else setToast('Password reset link sent to your email');
                }} className="text-sm text-accent-400 hover:text-accent-300 font-medium transition-colors">Forgot password?</button>
              </div>

              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-accent-500 hover:bg-accent-600 disabled:bg-accent-500/60 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-accent-500/25 hover:shadow-accent-500/40 active:scale-[0.97]">
                {submitting ? 'Signing in...' : 'Sign In'}
                <ChevronRight size={18} />
              </button>
            </form>

              <p className="text-xs text-slate-400 text-center mt-6 animate-fade-in">
                By signing in, you agree to the{' '}
                <button type="button" onClick={onTerms} className="text-accent-400 hover:text-accent-300 font-medium transition-colors">Terms of Service</button>
              </p>
          </div>

          <p className="text-primary-300/60 text-xs text-center mt-4 animate-fade-in">&copy; 2026 UniAbuja Screening System. All rights reserved.</p>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-5 py-3 rounded-xl shadow-xl z-50 animate-fade-in-up flex items-center gap-3 max-w-sm">
          <span className="text-sm">{toast}</span>
        </div>
      )}
    </div>
  );
}
