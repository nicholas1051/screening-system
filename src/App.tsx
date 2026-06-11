import React, { useState, useEffect } from 'react';
import { GraduationCap, ShieldCheck, BarChart3, Clock, Moon, Sun } from 'lucide-react';
import { supabase } from './lib/supabase';
import { getProfile, signOut } from './lib/db';
import type { Profile } from './lib/db';
import LoginPage from './components/LoginPage';
import TermsOfService from './components/TermsOfService';
import StudentDashboard from './components/StudentDashboard';
import OfficerDashboard from './components/OfficerDashboard';
import HodDashboard from './components/HodDashboard';
import ResetPasswordPage from './components/ResetPasswordPage';

type Page = 'login' | 'dashboard' | 'terms' | 'reset-password';

const roleConfig: Record<string, { label: string; icon: React.ElementType }> = {
  student: { label: 'Student', icon: GraduationCap },
  officer: { label: 'Clearance Officer', icon: ShieldCheck },
  hod: { label: 'HOD / Admin', icon: BarChart3 },
};

export default function App() {
  const [page, setPage] = useState<Page>('login');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  useEffect(() => {
    if (darkMode) { document.documentElement.classList.add('dark'); }
    else { document.documentElement.classList.remove('dark'); }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchProfile(session.user.id);
      else {
        // Check if we landed here from a password recovery email
        if (window.location.hash.includes('type=recovery')) {
          setPage('reset-password');
        }
        setLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPage('reset-password');
        setLoading(false);
      } else if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null); setPage('login'); setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data, error } = await getProfile(userId);
    if (data && !error) {
      setProfile(data as Profile);
      setPage('dashboard');
    }
    setLoading(false);
  }

  const handleLogin = (p: Profile) => {
    setProfile(p);
    setPage('dashboard');
  };

  const handleLogout = async () => {
    await signOut();
    setProfile(null);
    setPage('login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-800 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (page === 'login') {
    return <LoginPage onLogin={handleLogin} onTerms={() => setPage('terms')} />;
  }

  if (page === 'terms') {
    return <TermsOfService onBack={() => setPage('login')} />;
  }

  if (page === 'reset-password') {
    return <ResetPasswordPage onBackToLogin={() => setPage('login')} />;
  }

  const config = roleConfig[profile?.role || 'student'];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <nav className="bg-primary-800 shadow-lg shadow-primary-200/30 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white logo-bg p-0.5 shadow-lg shadow-black/10 group shrink-0">
                <img src="/uniabuja-logo.webp" alt="UniAbuja" className="w-full h-full rounded-full object-cover transition-transform duration-300 group-hover:scale-110" />
              </div>
              <div>
                <span className="font-bold text-lg text-white leading-tight block">UniAbuja</span>
                <span className="text-[10px] font-medium text-emerald-200 uppercase tracking-[0.15em] block">Screening System</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-200/80 font-medium pr-3 border-r border-white/10">
                <Clock size={13} />
                <span>{currentTime.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className="text-emerald-300/40">|</span>
                <span>{currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-emerald-200/80 hover:text-white rounded-lg transition-colors" title={darkMode ? 'Light mode' : 'Dark mode'}>
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <div className="flex items-center gap-2 text-xs group">
                <div className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center text-xs font-bold transition-all duration-300 group-hover:bg-white/30 group-hover:scale-110">
                  {config.label.charAt(0)}
                </div>
                <span className="hidden lg:inline text-emerald-100 font-medium group-hover:text-white transition-colors duration-200">{config.label}</span>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main>
        {profile?.role === 'student' && <StudentDashboard onLogout={handleLogout} />}
        {profile?.role === 'officer' && <OfficerDashboard onLogout={handleLogout} />}
        {profile?.role === 'hod' && <HodDashboard onLogout={handleLogout} />}
      </main>
    </div>
  );
}
