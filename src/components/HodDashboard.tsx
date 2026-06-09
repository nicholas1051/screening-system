import { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import Papa from 'papaparse';
import {
  Users, CheckCircle, Clock, AlertCircle, Download,
  TrendingUp, TrendingDown, FileText, ChevronDown, Calendar,
  Upload, Bell, Settings, Search, X, Check, ShieldCheck, Trash2, Plus, UserPlus, LogOut, HelpCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  getNotifications, getOfficers, getStudentStats, getStudentsWithDetails,
  getRejectionReasons, getActivityLogs, bulkCreateStudents,
  addOfficer, toggleOfficerActive, removeOfficer
} from '../lib/db';

const kpis = [
  { title: 'Total Admitted', key: 'total' as const, icon: Users, color: 'bg-blue-50 text-blue-600', trend: TrendingUp, trendColor: 'text-emerald-600' },
  { title: 'Fully Cleared', key: 'cleared' as const, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600', trend: TrendingUp, trendColor: 'text-emerald-600' },
  { title: 'Pending Review', key: 'pending' as const, icon: Clock, color: 'bg-amber-50 text-amber-600', trend: TrendingDown, trendColor: 'text-amber-600' },
  { title: 'Queried Files', key: 'queried' as const, icon: AlertCircle, color: 'bg-rose-50 text-rose-600', trend: TrendingDown, trendColor: 'text-rose-600' },
];

const kpiKeyLabel: Record<string, string> = {
  total: 'total registered',
  cleared: 'no data yet',
  pending: 'no data yet',
  queried: 'no data yet',
};

const defaultNotifications: { id: string; title: string; message: string; time: string; type: string; unread: boolean }[] = [];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

interface HodDashboardProps {
  onLogout?: () => void;
}

export default function HodDashboard({ onLogout }: HodDashboardProps) {
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [activitySortAsc, setActivitySortAsc] = useState(true);
  const [showOfficerModal, setShowOfficerModal] = useState(false);
  const [showAddOfficer, setShowAddOfficer] = useState(false);
  const [newOfficerName, setNewOfficerName] = useState('');
  const [newOfficerEmail, setNewOfficerEmail] = useState('');
  const [newOfficerRole, setNewOfficerRole] = useState('Clearance Officer');
  const [officers, setOfficers] = useState<any[]>([]);
  const [confirmRemoveIdx, setConfirmRemoveIdx] = useState<number | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [markedRead, setMarkedRead] = useState<string[]>([]);
  const [hodNotifs, setHodNotifs] = useState(defaultNotifications);
  const [sessionSetting, setSessionSetting] = useState('2025/2026');
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const sessionOptions = ['2023/2024', '2024/2025', '2025/2026'];
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [exportFormat, setExportFormat] = useState('PDF');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showStudentDetail, setShowStudentDetail] = useState(false);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [kpiValues, setKpiValues] = useState({ total: 0, cleared: 0, pending: 0, queried: 0 });
  const [rejectionReasons, setRejectionReasons] = useState<{ reason: string; count: number; percent: number }[]>([]);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<{ label: string; cleared: number; pending: number; queried: number }[]>([]);
  const [importing, setImporting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const masterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); }
  }, [toast]);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [notifsRes, officersRes, statsRes, studentsRes, reasonsRes, logsRes] = await Promise.all([
        getNotifications(user.id),
        getOfficers(),
        getStudentStats(sessionSetting),
        getStudentsWithDetails(sessionSetting),
        getRejectionReasons(),
        getActivityLogs(50),
      ]);
      if (notifsRes.data && notifsRes.data.length > 0) {
        setHodNotifs(notifsRes.data.map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          time: timeAgo(n.created_at),
          type: n.type,
          unread: !n.read,
        })));
      }
      if (officersRes.data && officersRes.data.length > 0) {
        setOfficers(officersRes.data.map((o: any) => ({
          id: o.id,
          name: o.name,
          role: o.role,
          students: o.student_count ?? 0,
          cleared: o.cleared_count ?? 0,
          active: o.active,
        })));
      }
      setKpiValues(statsRes);
      setStudentsList(studentsRes);
      setRejectionReasons(reasonsRes);
      setActivityData((logsRes.data || []).map((l: any) => ({
        user: l.profile?.name || 'Unknown',
        action: l.action.includes('clear') ? 'Cleared' : l.action.includes('query') ? 'Queried' : 'Approved',
        target: l.target_student,
        time: timeAgo(l.created_at),
        type: l.action.includes('clear') || l.action === 'Approved' ? 'approve' : 'query',
        })));
      // Load weekly trend data (last 7 days of activity)
      const { data: weekLogs } = await supabase
        .from('activity_logs')
        .select('action, created_at')
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());
      if (weekLogs) {
        const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const buckets: Record<string, { cleared: number; pending: number; queried: number }> = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86400000);
          const key = dayLabels[d.getDay()];
          buckets[key] = { cleared: 0, pending: 0, queried: 0 };
        }
        weekLogs.forEach((l: any) => {
          const d = new Date(l.created_at);
          const key = dayLabels[d.getDay()];
          if (buckets[key]) {
            if (l.action.includes('Approved') || l.action === 'approved') buckets[key].cleared++;
            else if (l.action.includes('clear')) buckets[key].cleared++;
            else if (l.action.includes('issue') || l.action.includes('query')) buckets[key].queried++;
            else buckets[key].pending++;
          }
        });
        setWeeklyTrend(Object.entries(buckets).map(([label, counts]) => ({ label, ...counts })));
      }
    }
    setLoading(false);
    loadData();
  }, [sessionSetting]);

  const exportReportPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = 20;

    doc.setFillColor(6, 95, 70);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('UniAbuja', 95, 18, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Screening System - HOD Executive Report', 95, 27, { align: 'center' });

    y = 48;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Departmental Summary', 10, y); y += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Department: Computer Science', 10, y); y += 7;
    doc.text(`Session: ${sessionSetting}`, 10, y); y += 7;
    doc.text(`Report Date: ${new Date().toLocaleDateString('en-GB')}`, 10, y); y += 7;

    y += 5;
    const total = kpiValues.total || 0;
    const cleared = kpiValues.cleared || 0;
    const pending = kpiValues.pending || 0;
    const queried = kpiValues.queried || 0;
    doc.text(`Total Admitted: ${total}`, 10, y); y += 7;
    doc.setTextColor(6, 150, 70);
    doc.text(`Fully Cleared: ${cleared} (${total ? Math.round((cleared / total) * 100) : 0}%)`, 10, y); y += 7;
    doc.setTextColor(180, 140, 0);
    doc.text(`Pending Review: ${pending} (${total ? Math.round((pending / total) * 100) : 0}%)`, 10, y); y += 7;
    doc.setTextColor(180, 40, 40);
    doc.text(`Queried Files: ${queried} (${total ? Math.round((queried / total) * 100) : 0}%)`, 10, y);

    y += 15;
    doc.setDrawColor(6, 95, 70);
    doc.setLineWidth(0.5);
    doc.line(10, y, 200, y); y += 8;

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Top Query Reasons', 10, y); y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    doc.setFillColor(6, 95, 70);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.rect(10, y - 5, 130, 8, 'F');
    doc.text('Reason', 14, y);
    doc.rect(140, y - 5, 30, 8, 'F');
    doc.text('Files', 144, y);
    doc.rect(170, y - 5, 30, 8, 'F');
    doc.text('%', 174, y);
    y += 9;
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    const reasons = rejectionReasons.length > 0 ? rejectionReasons : [];
    reasons.forEach((r, i) => {
      if (i % 2 === 0) { doc.setFillColor(240, 240, 245); doc.rect(10, y - 4, 190, 7, 'F'); }
      doc.text(r.reason, 14, y);
      doc.text(String(r.count), 144, y);
      doc.text(`${r.percent}%`, 174, y);
      y += 7;
    });

    y += 15;
    doc.setDrawColor(200, 200, 210);
    doc.line(10, y, 200, y); y += 8;
    doc.setFontSize(9);
    doc.setTextColor(100, 110, 130);
    doc.text(`Report generated on ${new Date().toLocaleString('en-GB')}`, 10, y);
    y += 5;
    doc.text('This is a computer-generated document from the UniAbuja Screening System.', 10, y);

    doc.save('HOD_Executive_Report.pdf');
    setToast('Executive report exported');
  };

  const generateMasterPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = 20;

    doc.setFillColor(6, 95, 70);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('UniAbuja', 95, 18, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Screening System - Master Clearance Report', 95, 27, { align: 'center' });

    y = 48;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Master Clearance Report', 10, y); y += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Department: Computer Science', 10, y); y += 7;
    doc.text(`Session: ${sessionSetting}`, 10, y); y += 7;
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, 10, y); y += 12;

    doc.setDrawColor(6, 95, 70);
    doc.setLineWidth(0.5);
    doc.line(10, y, 200, y); y += 8;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Student Clearance Summary', 10, y); y += 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    doc.setFillColor(6, 95, 70);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    const colW = [10, 60, 40, 40, 40];
    const colStarts = [10, 20, 80, 120, 160];
    const h = ['#', 'Name', 'Reg Number', 'Status', 'Type'];
    colStarts.forEach((s, i) => { doc.rect(s, y - 5, colW[i], 8, 'F'); doc.text(h[i], s + 3, y); });
    y += 9;

    const allStudents = studentsList.length > 0
      ? studentsList.map((s: any) => [
          s.name,
          s.reg_no || s.reg || '—',
          s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : 'Pending',
          s.admission_type || s.type || 'UTME',
        ])
      : [['No students loaded', '—', '—', '—']];

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    allStudents.forEach((s, i) => {
      if (i % 2 === 0) { doc.setFillColor(240, 240, 245); doc.rect(10, y - 4, 190, 7, 'F'); }
      doc.text(String(i + 1), colStarts[0] + 3, y);
      doc.text(s[0], colStarts[1] + 3, y);
      doc.text(s[1], colStarts[2] + 3, y);
      doc.setTextColor(s[2] === 'Cleared' ? 6 : s[2] === 'Queried' ? 180 : 100, s[2] === 'Cleared' ? 150 : s[2] === 'Queried' ? 40 : 100, s[2] === 'Cleared' ? 70 : s[2] === 'Queried' ? 40 : 100);
      doc.setFont('helvetica', s[2] === 'Cleared' ? 'bold' : 'normal');
      doc.text(s[2], colStarts[3] + 3, y);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'normal');
      doc.text(s[3], colStarts[4] + 3, y);
      y += 7;
    });

    y += 15;
    doc.setDrawColor(200, 200, 210);
    doc.line(10, y, 200, y); y += 8;
    doc.setFontSize(9);
    doc.setTextColor(100, 110, 130);
    doc.text(`Master report generated on ${new Date().toLocaleString('en-GB')}`, 10, y);
    y += 5;
    doc.text('This is a computer-generated document from the UniAbuja Screening System.', 10, y);

    doc.save('Master_Clearance_Report.pdf');
    setToast('Master report generated');
  };

  const filteredStudents = studentsList.filter((s: any) =>
    (s.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedActivity = showAllActivity ? activityData : activityData.slice(0, 5);
  const filteredActivity = displayedActivity.filter(a =>
    activityFilter === 'all' || a.type === activityFilter
  );
  const sortedActivity = [...filteredActivity].sort((a, b) => {
    const cmp = a.time.localeCompare(b.time);
    return activitySortAsc ? cmp : -cmp;
  });

  return loading ? (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6 animate-pulse">
      <div className="flex justify-between items-center mb-8">
        <div className="space-y-2"><div className="h-8 w-64 bg-slate-200 rounded-lg" /><div className="h-4 w-48 bg-slate-200 rounded-lg" /></div>
        <div className="flex gap-3"><div className="h-10 w-32 bg-slate-200 rounded-xl" /><div className="h-10 w-10 bg-slate-200 rounded-xl" /><div className="h-10 w-10 bg-slate-200 rounded-xl" /></div>
      </div>
      <div className="relative max-w-lg"><div className="h-12 w-full bg-slate-200 rounded-xl" /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1,2,3,4].map(i => <div key={i} className="card p-6"><div className="space-y-3"><div className="h-12 w-12 bg-slate-200 rounded-xl" /><div className="h-8 w-16 bg-slate-200 rounded" /><div className="h-4 w-24 bg-slate-200 rounded" /></div></div>)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6 space-y-4">
          <div className="h-6 w-48 bg-slate-200 rounded-lg" />
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="space-y-2"><div className="flex justify-between"><div className="h-4 w-24 bg-slate-200 rounded" /><div className="h-4 w-16 bg-slate-200 rounded" /></div><div className="h-3 bg-slate-200 rounded-full w-full" /></div>)}</div>
        </div>
        <div className="space-y-6">
          <div className="card p-6 space-y-3"><div className="h-6 w-32 bg-slate-200 rounded-lg" />{[1,2,3].map(i => <div key={i} className="space-y-2"><div className="flex justify-between"><div className="h-4 w-32 bg-slate-200 rounded" /><div className="h-4 w-12 bg-slate-200 rounded" /></div><div className="h-2 bg-slate-200 rounded-full w-full" /></div>)}</div>
          <div className="card p-6 space-y-2"><div className="h-6 w-28 bg-slate-200 rounded-lg mb-4" />{[1,2,3].map(i => <div key={i} className="h-10 w-full bg-slate-200 rounded-xl" />)}</div>
        </div>
      </div>
    </div>
  ) : (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
      {/* Hidden file inputs */}
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setImporting(true);
          try {
            const text = await file.text();
            const { data, errors: parseErrors } = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') });
            if (parseErrors.length) { setToast(`CSV parse error at row ${parseErrors[0].row || '?'}: ${parseErrors[0].message}`); setImporting(false); return; }
            const rows = data as any[];
            if (rows.length === 0) { setToast('CSV file is empty'); setImporting(false); return; }

            // Validate required columns
            const headerNames = Object.keys(rows[0]);
            const hasReg = headerNames.some(h => /reg/.test(h));
            const hasName = headerNames.some(h => /name/.test(h));
            if (!hasReg || !hasName) {
              setToast('CSV must include at least "reg_no" and "name" columns. Found: ' + headerNames.join(', '));
              setImporting(false); return;
            }

            const errors: string[] = [];
            const mapped = rows.map((r: any, i: number) => {
              const reg_no = r.reg_no || r.reg || r.registration_no || '';
              const name = r.name || r.full_name || '';
              if (!reg_no) errors.push(`Row ${i + 1}: missing registration number`);
              if (!name) errors.push(`Row ${i + 1}: missing name`);

              const rawType = (r.admission_type || r.type || r.admission || '').toUpperCase();
              const admission_type = rawType === 'DE' ? 'DE' as const : 'UTME' as const;
              if (rawType && rawType !== 'UTME' && rawType !== 'DE') {
                errors.push(`Row ${i + 1}: invalid admission type "${rawType}" (use UTME or DE)`);
              }

              const email = r.email || `${reg_no.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}@stu.uniabuja.edu.ng`;

              return {
                reg_no,
                name,
                email,
                admission_type,
                course: r.course || r.course_of_study || '',
                session: r.session || sessionSetting,
                jamb_no: r.jamb_no || r.jamb || '',
              };
            });

            if (errors.length > 0) {
              const preview = errors.slice(0, 5).join('; ');
              const suffix = errors.length > 5 ? ` (+${errors.length - 5} more)` : '';
              setToast(`Validation errors: ${preview}${suffix}`);
              setImporting(false); return;
            }

            const result = await bulkCreateStudents(mapped);
            setToast(`Imported ${result.imported}, skipped ${result.skipped}, errors ${result.errors}`);
            // Refresh data
            const [statsRes, studentsRes] = await Promise.all([getStudentStats(), getStudentsWithDetails()]);
            setKpiValues(statsRes);
            setStudentsList(studentsRes);
          } catch (err: any) {
            setToast('Import failed: ' + err.message);
          }
          setImporting(false);
          e.target.value = '';
        }}
      />
      <input
        ref={masterInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={() => setToast('Master report uploaded successfully')}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Executive Dashboard</h1>
            <span className="badge-info text-[10px]">Computer Science Dept.</span>
          </div>
          <p className="text-slate-500 mt-1">{sessionSetting} Academic Session &bull; Undergraduate Screening</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button onClick={() => setShowSessionPicker(!showSessionPicker)} className="btn-outline flex items-center gap-2 text-sm py-2 px-4">
              <Calendar size={16} />
              {sessionSetting}
              <ChevronDown size={14} />
            </button>
            {showSessionPicker && (
              <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
                {sessionOptions.map(s => (
                  <button key={s} onClick={() => { setSessionSetting(s); setShowSessionPicker(false); }}
                    className={`w-full px-4 py-2.5 text-sm text-left transition-colors ${sessionSetting === s ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
                    {s} Academic Session
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={exportReportPDF} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
            <Download size={16} /> Export Report
          </button>
          <button onClick={() => setShowNotifications(true)} className="relative p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors" title="Notifications">
            {hodNotifs.filter(n => !markedRead.includes(n.id)).length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                {hodNotifs.filter(n => !markedRead.includes(n.id)).length}
              </span>
            )}
            <Bell size={20} />
          </button>
          <button onClick={() => setShowHelp(true)} className="btn-outline flex items-center gap-2 text-sm py-2 px-4">
            <HelpCircle size={16} />
            Help
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors" title="Settings">
            <Settings size={20} />
          </button>
          <button onClick={onLogout} className="flex items-center gap-2 text-sm text-slate-500 hover:text-rose-600 transition-colors font-medium">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative group max-w-lg">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-primary-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search students by name..."
          className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400 transition-all shadow-sm"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Search Results */}
      {searchQuery && (
        <div className="card p-4 -mt-2 animate-fade-in">
          {filteredStudents.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-2">No students found matching "{searchQuery}"</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {filteredStudents.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedStudent(s); setShowStudentDetail(true); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary-50 transition-all text-left"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                    s.status === 'cleared' ? 'bg-emerald-100 text-emerald-700' :
                    s.status === 'queried' ? 'bg-rose-100 text-rose-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.reg_no || s.reg} &bull; {s.admission_type || s.type}</p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full shrink-0 ${
                    s.status === 'cleared' ? 'bg-emerald-100 text-emerald-700' :
                    s.status === 'queried' ? 'bg-rose-100 text-rose-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>{s.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="card p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-default">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-md ${kpi.color}`}>
                <kpi.icon size={24} />
              </div>
              <kpi.trend size={20} className={`${kpi.trendColor} transition-all duration-300 group-hover:scale-125 group-hover:-translate-y-0.5`} />
            </div>
            <h3 className="text-3xl font-bold text-slate-800 group-hover:text-primary-800 transition-colors duration-300">{kpiValues[kpi.key]}</h3>
            <p className="text-sm font-medium text-slate-500 mt-1">{kpi.title}</p>
            <p className="text-xs text-slate-400 mt-1 group-hover:text-slate-500 transition-colors duration-300">{kpiValues.total > 0 ? `${kpiValues[kpi.key]} (${Math.round((kpiValues[kpi.key] / kpiValues.total) * 100)}%)` : kpiKeyLabel[kpi.key]}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clearance Progress */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">Clearance Progress Overview</h3>
            <select className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-600">
              <option>By Department</option>
              <option>By Course</option>
              <option>By Entry Mode</option>
            </select>
          </div>

          <div className="space-y-6">
            <div className="group/progress">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold text-emerald-700">Fully Cleared</span>
                <span className="text-slate-500 text-xs">{kpiValues.cleared} / {kpiValues.total} ({kpiValues.total ? Math.round((kpiValues.cleared / kpiValues.total) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-3.5 rounded-full transition-all duration-700 relative overflow-hidden" style={{ width: `${kpiValues.total ? (kpiValues.cleared / kpiValues.total) * 100 : 0}%` }}>
                  <div className="absolute inset-0 bg-white/20 rounded-full animate-shimmer" />
                </div>
              </div>
            </div>
            <div className="group/progress">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold text-amber-700">Pending Review</span>
                <span className="text-slate-500 text-xs">{kpiValues.pending} / {kpiValues.total} ({kpiValues.total ? Math.round((kpiValues.pending / kpiValues.total) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-amber-400 to-amber-600 h-3.5 rounded-full transition-all duration-700 relative overflow-hidden" style={{ width: `${kpiValues.total ? (kpiValues.pending / kpiValues.total) * 100 : 0}%` }}>
                  <div className="absolute inset-0 bg-white/20 rounded-full animate-shimmer" />
                </div>
              </div>
            </div>
            <div className="group/progress">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold text-rose-700">Queried / Action Required</span>
                <span className="text-slate-500 text-xs">{kpiValues.queried} / {kpiValues.total} ({kpiValues.total ? Math.round((kpiValues.queried / kpiValues.total) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-rose-400 to-rose-600 h-3.5 rounded-full transition-all duration-700 relative overflow-hidden" style={{ width: `${kpiValues.total ? (kpiValues.queried / kpiValues.total) * 100 : 0}%` }}>
                  <div className="absolute inset-0 bg-white/20 rounded-full animate-shimmer" />
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Trend */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-slate-700 text-sm">Weekly Clearance Trend</h4>
              <div className="flex items-center gap-4 text-[10px]">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Cleared</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-400" /> Pending</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-400" /> Queried</span>
              </div>
            </div>
            <div className="flex items-end gap-3 h-40">
              {weeklyTrend.length > 0 ? weeklyTrend.map((day, idx) => {
                const maxVal = Math.max(...weeklyTrend.map(d => d.cleared + d.pending + d.queried), 1);
                const total = day.cleared + day.pending + day.queried;
                const hPct = (total / maxVal) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group/chart">
                    <div className="w-full flex flex-col-reverse rounded-lg relative transition-all duration-300 group-hover/chart:scale-y-110 group-hover/chart:origin-bottom" style={{ height: `${hPct}%` }}>
                      {day.cleared > 0 && <div className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-none rounded-b-lg transition-all duration-300 group-hover/chart:shadow-lg group-hover/chart:shadow-emerald-200" style={{ height: `${(day.cleared / total) * 100}%`, minHeight: '4px' }} />}
                      {day.pending > 0 && <div className="w-full bg-gradient-to-t from-amber-500 to-amber-400 transition-all duration-300 group-hover/chart:shadow-lg group-hover/chart:shadow-amber-200" style={{ height: `${(day.pending / total) * 100}%`, minHeight: '4px' }} />}
                      {day.queried > 0 && <div className="w-full bg-gradient-to-t from-rose-500 to-rose-400 rounded-t-lg rounded-b-none transition-all duration-300 group-hover/chart:shadow-lg group-hover/chart:shadow-rose-200" style={{ height: `${(day.queried / total) * 100}%`, minHeight: '4px' }} />}
                      {total === 0 && <div className="w-full bg-slate-200 rounded-lg" style={{ height: '4px' }} />}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-2 py-1 rounded-lg shadow-lg opacity-0 group-hover/chart:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                        <span className="text-emerald-300">{day.cleared}</span> / <span className="text-amber-300">{day.pending}</span> / <span className="text-rose-300">{day.queried}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium group-hover/chart:text-slate-600 transition-colors duration-200">{day.label}</span>
                  </div>
                );
              }) : (
                <div className="w-full flex items-center justify-center h-full text-slate-400 text-sm">No activity data this week</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Top Rejection Reasons */}
          <div className="card p-6">
            <h3 className="font-bold text-slate-800 mb-5">Top Query Reasons</h3>
            <div className="space-y-4">
              {rejectionReasons.map((item, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[10px] font-bold">{idx + 1}</span>
                      <span className="font-medium text-slate-700">{item.reason}</span>
                    </div>
                    <span className="text-xs font-semibold text-rose-600">{item.count} files</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${item.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card p-6">
            <h3 className="font-bold text-slate-800 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button onClick={() => csvInputRef.current?.click()} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-primary-50 hover:text-primary-700 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 text-left text-sm font-medium text-slate-700 group/action">
                <Upload size={18} className="text-primary-600 transition-transform duration-200 group-hover/action:scale-110 group-hover/action:-rotate-6" />
                Upload Admission List (CSV)
              </button>
              <button onClick={generateMasterPDF} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-primary-50 hover:text-primary-700 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 text-left text-sm font-medium text-slate-700 group/action">
                <FileText size={18} className="text-accent-600 transition-transform duration-200 group-hover/action:scale-110 group-hover/action:-rotate-6" />
                Generate Master Report
              </button>
              <button onClick={() => setShowOfficerModal(true)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-primary-50 hover:text-primary-700 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 text-left text-sm font-medium text-slate-700 group/action">
                <Users size={18} className="text-amber-600 transition-transform duration-200 group-hover/action:scale-110" />
                Manage Clearance Officers
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-800">Recent Activity</h3>
          <div className="flex items-center gap-3">
            {/* Filter */}
            <select
              value={activityFilter}
              onChange={e => setActivityFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600"
            >
              <option value="all">All Actions</option>
              <option value="approve">Approvals</option>
              <option value="query">Queries</option>
            </select>
            {/* Sort */}
            <button onClick={() => setActivitySortAsc(!activitySortAsc)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all text-xs flex items-center gap-1">
              {activitySortAsc ? '▲ Oldest' : '▼ Newest'}
            </button>
            {/* View All */}
            <button onClick={() => setShowAllActivity(!showAllActivity)} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              {showAllActivity ? 'Show Less' : `View All (${activityData.length})`}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <th className="pb-3 font-semibold">Officer</th>
                <th className="pb-3 font-semibold">Action</th>
                <th className="pb-3 font-semibold">Student</th>
                <th className="pb-3 font-semibold hidden md:table-cell">Time</th>
              </tr>
            </thead>
            <tbody>
              {sortedActivity.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-slate-400">No activity matches the selected filter</td></tr>
              ) : (
                sortedActivity.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-50 last:border-0 transition-colors duration-150 hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
                          {item.user.charAt(0)}
                        </div>
                        <span className="font-medium text-slate-700">{item.user}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`badge text-[10px] transition-all duration-200 ${item.type === 'approve' ? 'badge-success' : 'badge-danger'}`}>
                        {item.action}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{item.target}</td>
                    <td className="py-3 text-slate-400 hidden md:table-cell">{item.time}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Detail Modal */}
      {showStudentDetail && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowStudentDetail(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  selectedStudent.status === 'cleared' ? 'bg-emerald-100 text-emerald-700' :
                  selectedStudent.status === 'queried' ? 'bg-rose-100 text-rose-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{selectedStudent.name}</h3>
                  <p className="text-xs text-slate-400">{selectedStudent.reg_no || selectedStudent.reg} &bull; {selectedStudent.admission_type || selectedStudent.type}</p>
                </div>
              </div>
              <button onClick={() => setShowStudentDetail(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all">✕</button>
            </div>
            <div className="p-6 space-y-6">
              {/* Student Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Reg Number</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedStudent.reg_no || selectedStudent.reg}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Admission Type</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedStudent.admission_type || selectedStudent.type}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Course</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedStudent.course}</p>
                </div>
                <div className={`rounded-xl p-3 border ${
                  selectedStudent.status === 'cleared' ? 'bg-emerald-50 border-emerald-200/80' :
                  selectedStudent.status === 'queried' ? 'bg-rose-50 border-rose-200/80' :
                  'bg-amber-50 border-amber-200/80'
                }`}>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Status</p>
                  <p className={`text-sm font-bold ${
                    selectedStudent.status === 'cleared' ? 'text-emerald-700' :
                    selectedStudent.status === 'queried' ? 'text-rose-700' :
                    'text-amber-700'
                  }`}>{selectedStudent.status.toUpperCase()}</p>
                </div>
              </div>

              {/* Document Status */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Documents Status</h4>
                <div className="space-y-2">
                  {(selectedStudent.student_documents || selectedStudent.documents || []).map((doc: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-sm font-medium text-slate-700">{doc.document?.name || doc.name}</span>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        doc.status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                        doc.status === 'issues' ? 'bg-rose-100 text-rose-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {doc.status === 'verified' ? 'Approved' : doc.status === 'issues' ? 'Queried' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Queried Documents Details */}
              {(() => {
                const queriedDocs = (selectedStudent.student_documents || selectedStudent.documents || []).filter((d: any) => d.status === 'issues' || d.queried_reason);
                if (queriedDocs.length === 0) return null;
                return (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-500" /> Query Details
                    </h4>
                    <div className="space-y-2">
                      {queriedDocs.map((doc: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-rose-50 border border-rose-200/80">
                          <div className="w-5 h-5 rounded-full bg-rose-200 text-rose-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{idx + 1}</div>
                          <p className="text-sm text-rose-700">{doc.document?.name || doc.name}: {doc.queried_reason || 'Issues found'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Progress */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Clearance Progress</h4>
                <div className="flex items-center gap-1">
                  {(selectedStudent.student_documents || selectedStudent.documents || []).map((doc: any, idx: number) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className={`w-full h-2 rounded-full ${
                        doc.status === 'verified' ? 'bg-emerald-500' :
                        doc.status === 'issues' ? 'bg-rose-500' :
                        'bg-slate-200'
                      }`} />
                      <span className="text-[8px] text-slate-400 text-center leading-tight">{(doc.document?.name || doc.name || '').split(' ').slice(0, 2).join(' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
              <button onClick={() => setShowStudentDetail(false)} className="btn-primary text-xs py-2 px-4">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Officer Management Modal */}
      {showOfficerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowOfficerModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Manage Clearance Officers</h3>
                  <p className="text-xs text-slate-500">{officers.length} officers &bull; {officers.filter(o => o.active).length} active</p>
                </div>
              </div>
              <button onClick={() => setShowOfficerModal(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Add Officer Button */}
              <button onClick={() => setShowAddOfficer(!showAddOfficer)} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50/50 transition-all text-sm font-medium">
                <Plus size={18} /> Add New Officer
              </button>

              {/* Add Officer Form */}
              {showAddOfficer && (
                <div className="p-4 rounded-xl bg-primary-50/60 border border-primary-200 space-y-3 animate-fade-in">
                  <h4 className="text-sm font-semibold text-primary-800 flex items-center gap-2"><UserPlus size={16} /> New Officer Details</h4>
                  <input
                    type="text"
                    value={newOfficerName}
                    onChange={e => setNewOfficerName(e.target.value)}
                    placeholder="Full name (e.g. Dr. Abubakar)"
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
                  />
                  <input
                    type="email"
                    value={newOfficerEmail}
                    onChange={e => setNewOfficerEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
                  />
                  <select
                    value={newOfficerRole}
                    onChange={e => setNewOfficerRole(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
                  >
                    <option value="Clearance Officer">Clearance Officer</option>
                    <option value="Senior Clearance Officer">Senior Clearance Officer</option>
                    <option value="Junior Clearance Officer">Junior Clearance Officer</option>
                    <option value="Supervisor">Supervisor</option>
                  </select>
                  <div className="flex justify-end gap-2 pt-1">
                    <button onClick={() => { setShowAddOfficer(false); setNewOfficerName(''); setNewOfficerEmail(''); }} className="btn-outline text-xs py-2 px-3">Cancel</button>
                    <button onClick={async () => {
                      if (!newOfficerName.trim()) { setToast('Please enter an officer name'); return; }
                      if (!newOfficerEmail.trim()) { setToast('Please enter an officer email'); return; }
                      setImporting(true);
                      const { error } = await addOfficer(newOfficerName.trim(), newOfficerEmail.trim());
                      if (error) { setToast('Failed to add officer: ' + error.message); setImporting(false); return; }
                      const { data: officersData } = await getOfficers();
                      if (officersData) setOfficers(officersData.map((o: any) => ({ id: o.id, name: o.name, role: o.role, students: o.student_count ?? 0, cleared: o.cleared_count ?? 0, active: o.active })));
                      setNewOfficerName(''); setNewOfficerEmail(''); setNewOfficerRole('Clearance Officer'); setShowAddOfficer(false);
                      setImporting(false);
                      setToast(`${newOfficerName.trim()} added as ${newOfficerRole}`);
                    }} className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5">
                      <UserPlus size={14} /> {importing ? 'Adding...' : 'Add Officer'}
                    </button>
                  </div>
                </div>
              )}

              {/* Officer List */}
              {officers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No clearance officers assigned yet.</div>
              ) : (
                officers.map((o, i) => (
                  <div key={o.id || i} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200 hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${o.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                        {o.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{o.name}</p>
                        <p className="text-xs text-slate-400">{o.role} &bull; {o.students} students</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-emerald-700">{o.cleared}</p>
                        <p className="text-[10px] text-slate-400">cleared</p>
                      </div>
                      {/* Toggle Active/Inactive */}
                      <button
                        onClick={async () => {
                          const newActive = !o.active;
                          setOfficers(officers.map((off, idx) => idx === i ? { ...off, active: newActive } : off));
                          await toggleOfficerActive(officers[i].id || '', newActive);
                        }}
                        className={`relative w-10 h-5 rounded-full transition-all duration-200 ${o.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        title={o.active ? 'Click to pause access' : 'Click to restore access'}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${o.active ? 'left-[22px]' : 'left-0.5'}`} />
                      </button>
                      {/* Remove Button */}
                      <button
                        onClick={() => setConfirmRemoveIdx(confirmRemoveIdx === i ? null : i)}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Remove officer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* Confirmation Dialog */}
              {confirmRemoveIdx !== null && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 animate-fade-in flex items-center justify-between">
                  <p className="text-sm text-rose-700 font-medium">Remove <strong>{officers[confirmRemoveIdx]?.name}</strong> from the system?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmRemoveIdx(null)} className="btn-outline text-xs py-1.5 px-3">Keep</button>
                    <button onClick={async () => {
                      const officerId = officers[confirmRemoveIdx]?.id;
                      if (officerId) await removeOfficer(officerId);
                      setOfficers(officers.filter((_, idx) => idx !== confirmRemoveIdx));
                      setConfirmRemoveIdx(null);
                      setToast('Officer removed from system');
                    }} className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1">
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center shrink-0 bg-slate-50/50">
              <p className="text-xs text-slate-400">Total cleared: {officers.reduce((a, o) => a + o.cleared, 0)} across {officers.length} officers</p>
              <button onClick={() => { setShowOfficerModal(false); setConfirmRemoveIdx(null); setShowAddOfficer(false); }} className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5">
                <Check size={14} /> Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20" onClick={() => setShowHelp(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[70vh] flex flex-col overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <HelpCircle size={18} className="text-primary-600" />
                <h3 className="font-bold text-slate-800">Help & Support</h3>
              </div>
              <button onClick={() => setShowHelp(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-all">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm text-slate-600 leading-relaxed">
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Dashboard Overview</h4>
                <p>View key metrics — total admitted, cleared, pending, and queried students. Search for individual students using the search bar.</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Importing Students</h4>
                <p>Use <strong>Upload Admission List (CSV)</strong> to bulk-import students. The CSV must include columns: reg_no, name, email, admission_type, course, session.</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Managing Officers</h4>
                <p>Go to <strong>Manage Clearance Officers</strong> to add, activate/deactivate, or remove officers from the system.</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Reports</h4>
                <p><strong>Export Report</strong> generates an executive summary PDF. <strong>Generate Master Report</strong> creates a full clearance report. Use <strong>Export Report</strong> in Analytics for detailed breakdowns.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20" onClick={() => setShowNotifications(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[70vh] flex flex-col overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Bell size={18} className="text-primary-600" />
                <h3 className="font-bold text-slate-800">Notifications</h3>
                {hodNotifs.filter(n => !markedRead.includes(n.id)).length > 0 && (
                  <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {hodNotifs.filter(n => !markedRead.includes(n.id)).length} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {hodNotifs.filter(n => !markedRead.includes(n.id)).length > 0 && (
                  <button onClick={() => setMarkedRead(hodNotifs.map(n => n.id))} className="text-[11px] text-primary-600 hover:text-primary-700 font-medium">Mark all read</button>
                )}
                <button onClick={() => setShowNotifications(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-all">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {hodNotifs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No notifications</div>
              ) : (
                hodNotifs.map((n) => {
                  const isRead = markedRead.includes(n.id);
                  return (
                    <div key={n.id} className={`px-5 py-3.5 border-b border-slate-50 last:border-0 transition-colors duration-150 hover:bg-slate-50 cursor-pointer ${!isRead ? 'bg-primary-50/40' : ''}`}
                      onClick={() => { if (!isRead) setMarkedRead([...markedRead, n.id]); }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!isRead ? 'bg-primary-500' : 'bg-transparent'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm ${!isRead ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'}`}>{n.title}</p>
                            <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                          </div>
                          <p className={`text-xs mt-0.5 ${!isRead ? 'text-slate-600' : 'text-slate-400'}`}>{n.message}</p>
                          <span className={`inline-block mt-1.5 text-[9px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            n.type === 'response' ? 'bg-blue-100 text-blue-700' :
                            n.type === 'upload' ? 'bg-primary-100 text-primary-700' :
                            n.type === 'milestone' ? 'bg-emerald-100 text-emerald-700' :
                            n.type === 'activity' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>{n.type}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-between items-center shrink-0 bg-slate-50/50">
              <span className="text-[11px] text-slate-400">{hodNotifs.filter(n => !markedRead.includes(n.id)).length} unread</span>
              <button onClick={() => { setShowNotifications(false); setToast('All notifications cleared'); }} className="text-[11px] text-slate-500 hover:text-slate-700 font-medium">Clear all</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                  <Settings size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Settings</h3>
                  <p className="text-xs text-slate-400">Dashboard preferences</p>
                </div>
              </div>
              <button onClick={() => setShowSettings(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all">✕</button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Academic Session</h4>
                <div className="grid grid-cols-3 gap-2">
                  {['2023/2024', '2024/2025', '2025/2026'].map(s => (
                    <button key={s} onClick={() => setSessionSetting(s)} className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      sessionSetting === s ? 'bg-primary-800 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>{s}</button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Notifications</h4>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-slate-700">Push Notifications</p>
                    <p className="text-xs text-slate-400">Receive alerts for queries and milestones</p>
                  </div>
                  <button onClick={() => setNotifEnabled(!notifEnabled)} className={`relative w-11 h-6 rounded-full transition-all duration-200 ${notifEnabled ? 'bg-primary-600' : 'bg-slate-300'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${notifEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Export Defaults</h4>
                <div className="grid grid-cols-2 gap-2">
                  {['PDF', 'CSV'].map(f => (
                    <button key={f} onClick={() => setExportFormat(f)} className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      exportFormat === f ? 'bg-primary-800 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>{f}</button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">Reports will be generated in {exportFormat} format by default</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowSettings(false)} className="btn-outline text-sm">Cancel</button>
              <button onClick={() => { setShowSettings(false); setToast('Settings saved'); }} className="btn-primary text-sm">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-5 py-3 rounded-xl shadow-xl z-50 animate-fade-in-up flex items-center gap-3 max-w-sm">
          <span className="text-sm">{toast}</span>
        </div>
      )}
    </div>
  );
}
