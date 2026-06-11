import { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import {
  Search, ChevronRight, FileText, Check, X, User, Download,
  LogOut, Clock, BarChart3, TrendingUp, AlertCircle, FileCheck, Bell, Maximize2, Minimize2, HelpCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getDocuments, getStudentDocuments, getNotifications, updateDocumentStatus, bulkApproveDocuments, logActivity, createNotification, updateStudentStatus } from '../lib/db';

interface QueueItem {
  id: number;
  student_id: string;
  name: string;
  reg: string;
  type: string;
  course?: string;
  status: 'pending' | 'queried' | 'cleared';
  claimed_by?: string;
  claimed_name?: string;
}

interface OfficerDashboardProps {
  onLogout?: () => void;
}

export default function OfficerDashboard({ onLogout }: OfficerDashboardProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [docList, setDocList] = useState<string[]>([]);
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [activeDoc, setActiveDoc] = useState(0);
  const [filter, setFilter] = useState<string>('all');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [notifRead, setNotifRead] = useState<string[]>([]);
  const [officerNotifs, setOfficerNotifs] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityLogEntries, setActivityLogEntries] = useState<{ action: string; time: string }[]>([]);
  const [docStatuses, setDocStatuses] = useState<string[]>([]);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const selectedIdRef = useRef<string | null>(null);
  const prevSelectedIdRef = useRef<string | null>(null);

  async function claimStudent(studentId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('clearance_queue').insert({
      officer_id: user.id, student_id: studentId,
    });
    if (!error) {
      setQueue(prev => prev.map(s => s.student_id === studentId ? { ...s, claimed_by: user.id, claimed_name: user.user_metadata?.name || 'An officer' } : s));
      setToast('Claimed student');
    } else if (error.code === '23505') {
      const { data: row } = await supabase.from('clearance_queue').select('officer_id').eq('student_id', studentId).maybeSingle();
      if (row?.officer_id === user.id) {
        setQueue(prev => prev.map(s => s.student_id === studentId ? { ...s, claimed_by: user.id, claimed_name: user.user_metadata?.name || 'An officer' } : s));
      } else {
        setToast('Already claimed by another officer');
      }
    }
  }

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); }
  }, [toast]);

  async function handleDocAction(idx: number, newStatus: 'verified' | 'issues' | 'pending') {
    const s = [...docStatuses]; s[idx] = newStatus; setDocStatuses(s);
    const { data: { user } } = await supabase.auth.getUser();
    if (user && selected && docList[idx]) {
      const { data: docRecords } = await supabase
        .from('student_documents')
        .select('id, document:documents!inner(name)')
        .eq('student_id', selected.student_id)
        .in('document.name', [docList[idx]]);
      if (docRecords && docRecords.length > 0) {
        const { error: updateErr } = await updateDocumentStatus(docRecords[0].id, newStatus, user.id, newStatus === 'issues' ? reviewNotes || undefined : undefined);
        if (updateErr) { setToast('Update failed: ' + updateErr.message); return; }
        await logActivity(user.id, newStatus === 'verified' ? 'Approved' : newStatus === 'issues' ? 'Queried' : 'Marked Pending', selected.name);
        // Notify the student
        if (newStatus === 'verified' || newStatus === 'issues') {
          const { data: student } = await supabase.from('students').select('user_id').eq('id', selected.student_id).single();
          if (student?.user_id) {
            const docName = docList[idx];
            if (newStatus === 'verified') {
              const { error: notifErr } = await createNotification(student.user_id, 'Document Approved', `${docName} has been approved.`, 'approval');
              if (notifErr) console.error('Notification error:', notifErr.message, notifErr.code, notifErr.details);
            } else {
              const { error: notifErr } = await createNotification(student.user_id, 'Document Queried', `${docName} has been queried. ${reviewNotes ? reviewNotes : ''}`, 'query');
              if (notifErr) console.error('Notification error:', notifErr.message, notifErr.code, notifErr.details);
            }
          }
        }
        // Notify all HODs
        const { data: hods } = await supabase.from('profiles').select('id').eq('role', 'hod');
        if (hods) {
          const studentName = selected.name;
          const docName = docList[idx];
          const actionLabel = newStatus === 'verified' ? 'approved' : newStatus === 'issues' ? 'queried' : 'marked pending';
          for (const hod of hods) {
            await createNotification(hod.id, `Document ${actionLabel}`, `${docName} ${actionLabel} for ${studentName}.`, 'info');
          }
        }
        // Update student-level status based on all document statuses
        const currentStatuses = [...docStatuses]; currentStatuses[idx] = newStatus;
        if (currentStatuses.every(s => s === 'verified')) {
          await updateStudentStatus(selected.student_id, 'cleared');
        } else if (currentStatuses.some(s => s === 'issues')) {
          await updateStudentStatus(selected.student_id, 'queried');
        } else {
          await updateStudentStatus(selected.student_id, 'pending');
        }
        setReviewNotes('');
      }
    }
    setToast(`${newStatus === 'verified' ? 'Approved' : newStatus === 'issues' ? 'Queried' : 'Marked as pending'}: ${docList[idx]}`);
  }

  async function handleBulkApprove() {
    const pendingCount = docStatuses.filter(s => s !== 'verified').length;
    if (pendingCount === 0) { setToast('No pending documents to approve'); return; }
    setToast(`Approving ${pendingCount} document${pendingCount > 1 ? 's' : ''}...`);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !selected) return;
    const { error } = await bulkApproveDocuments(selected.student_id, user.id);
    if (error) { setToast('Bulk approve failed: ' + error.message); return; }
    await logActivity(user.id, `Bulk Approved ${pendingCount} documents`, selected.name);
    const { data: student } = await supabase.from('students').select('user_id').eq('id', selected.student_id).single();
    if (student?.user_id) {
      await createNotification(student.user_id, `${pendingCount} Documents Approved`, `${pendingCount} document${pendingCount > 1 ? 's have' : ' has'} been approved.`, 'milestone');
    }
    const { data: hods } = await supabase.from('profiles').select('id').eq('role', 'hod');
    if (hods) {
      for (const hod of hods) {
        await createNotification(hod.id, `Bulk Approval`, `${pendingCount} documents approved for ${selected.name}.`, 'info');
      }
    }
    setDocStatuses(docStatuses.map(s => s !== 'verified' ? 'verified' : s));
    await updateStudentStatus(selected.student_id, 'cleared');
    setToast(`Approved ${pendingCount} document${pendingCount > 1 ? 's' : ''}`);
  }

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Load queue: all students with claim info (separate queries to avoid RLS join issues)
      const [studentsRes, queueRes] = await Promise.all([
        supabase.from('students').select('*').order('created_at'),
        supabase.from('clearance_queue').select('*, officer:profiles(name)'),
      ]);
      const allStudents = studentsRes.data || [];
      const queueRows = queueRes.data || [];
      if (allStudents.length > 0) {
        // Build a map of student_id -> claiming officer info
        const claimMap: Record<string, { officer_id: string; officer_name: string }> = {};
        for (const row of queueRows) {
          if (row.student_id && !claimMap[row.student_id]) {
            claimMap[row.student_id] = { officer_id: row.officer_id, officer_name: row.officer?.name || 'Unknown' };
          }
        }
        const mapped = allStudents.map((s: any, i: number) => {
          const claim = claimMap[s.id];
          return {
            id: i + 1,
            student_id: s.id,
            name: s.name,
            reg: s.reg_no,
            type: s.admission_type || 'UTME',
            course: s.course,
            status: (s.status === 'cleared' ? 'cleared' : s.status === 'queried' ? 'queried' : 'pending') as 'pending' | 'queried' | 'cleared',
            claimed_by: claim?.officer_id || undefined,
            claimed_name: claim?.officer_name || undefined,
          };
        });
        setQueue(mapped);
        if (selectedIdRef.current) {
          const found = mapped.find(s => s.student_id === selectedIdRef.current);
          if (found) { setSelected(found); } else { setSelected(mapped[0]); selectedIdRef.current = mapped[0]?.student_id || null; }
        } else {
          setSelected(mapped[0]);
          selectedIdRef.current = mapped[0]?.student_id || null;
        }
      }

      // Load notifications
      const { data: notifs } = await getNotifications(user.id);
      if (notifs && notifs.length > 0) {
        setOfficerNotifs(notifs.map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          time: timeAgo(n.created_at),
          type: n.type,
        })));
      }

      // Load activity logs
      const { data: logs } = await supabase
        .rpc('get_activity_logs', { p_limit: 50 });
      if (logs) {
        setActivityLogEntries(logs.map((l: any) => ({
          action: l.action,
          time: timeAgo(l.created_at),
        })));
      }
      setLoading(false);
    }
    loadData();
    // Poll for status changes every 10 seconds
    const interval = setInterval(loadData, 10000);
    // Real-time subscription for new uploads
    let channel: ReturnType<typeof supabase.channel>;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return;
      channel = supabase
        .channel('officer-activity-changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, async (payload) => {
          const entry = payload.new as any;
          if (entry.action && entry.action.toLowerCase().includes('uploaded')) {
            setToast(`${entry.action} — ${entry.target_student || 'A student'}`);
            loadData();
          }
        })
        .subscribe();
    });
    return () => { clearInterval(interval); if (channel) supabase.removeChannel(channel); };
  }, []);

  // Load document statuses when selected student changes
  useEffect(() => {
    async function loadDocStatuses() {
      if (!selected) return;
      const { data: docs } = await getDocuments();
      if (!docs || docs.length === 0) return;
      const names = docs.map((d: any) => d.name);

      const { data: studentDocs } = await getStudentDocuments(selected.student_id);
      // Only show documents this student actually has assigned (UTME gets 14, DE gets 16)
      const studentDocNames = new Set(studentDocs?.map((sd: any) => sd.document?.name) || []);
      const filteredNames = studentDocNames.size > 0 ? names.filter(n => studentDocNames.has(n)) : names;
      setDocList(filteredNames);
      setDocStatuses(Array(filteredNames.length).fill('pending'));
      if (prevSelectedIdRef.current !== selected.student_id) {
        setActiveDoc(0);
        prevSelectedIdRef.current = selected.student_id;
      }
      const urls: Record<string, string> = {};

      // Also load the student's passport_url for the passport document
      const { data: student } = await supabase.from('students').select('passport_url').eq('id', selected.student_id).single();

      if (studentDocs && studentDocs.length > 0) {
        const statuses = Array(filteredNames.length).fill('pending');
        studentDocs.forEach((sd: any) => {
          const idx = filteredNames.indexOf(sd.document?.name);
          if (idx !== -1) {
            statuses[idx] = sd.status === 'verified' ? 'verified' : sd.status === 'issues' ? 'issues' : 'pending';
            if (sd.file_url) urls[sd.document?.name || idx] = sd.file_url;
          }
        });
        // If passport has a separate passport_url but no file_url in student_documents, use it
        if (student?.passport_url) {
          const passportIdx = filteredNames.indexOf('Passport Photograph');
          if (passportIdx !== -1 && !urls['Passport Photograph']) {
            urls['Passport Photograph'] = student.passport_url;
          }
        }
        setDocStatuses(statuses);
        setFileUrls(urls);
      }
    }
    loadDocStatuses();
  }, [selected]);

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} mins ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  const openViewer = (idx: number) => {
    setActiveDoc(idx);
    setViewerOpen(true);
  };

  const exportStudentPDF = (student: QueueItem) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 190;
    let y = 20;

    doc.setFillColor(6, 95, 70);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('UniAbuja', pageW / 2, 18, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Screening System - Student Clearance Report', pageW / 2, 27, { align: 'center' });

    y = 48;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Student Details', 10, y);
    y += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${student.name}`, 10, y); y += 7;
    doc.text(`Reg Number: ${student.reg}`, 10, y); y += 7;
    doc.text(`Admission Type: ${student.type}`, 10, y); y += 7;
    doc.text(`Course: ${student.course || 'Computer Science'}`, 10, y); y += 7;
    doc.text(`Status: ${student.status.toUpperCase()}`, 10, y); y += 7;
    doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 10, y);

    y += 15;
    doc.setDrawColor(6, 95, 70);
    doc.setLineWidth(0.5);
    doc.line(10, y, 200, y); y += 8;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Document Review Status', 10, y); y += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    const rows = docList.map((d, i) => [String(i + 1), d, docStatuses[i] === 'verified' ? 'Approved' : docStatuses[i] === 'issues' ? 'Queried' : 'Pending']);

    doc.setFillColor(6, 95, 70);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.rect(10, y - 5, 120, 8, 'F');
    doc.text('Document', 14, y);
    doc.rect(130, y - 5, 60, 8, 'F');
    doc.text('Status', 134, y);
    y += 9;

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    rows.forEach((row, i) => {
      if (i % 2 === 0) { doc.setFillColor(240, 240, 245); doc.rect(10, y - 4, 180, 7, 'F'); }
      doc.text(row[1], 14, y);
      doc.setTextColor(row[2] === 'Approved' ? 6 : row[2] === 'Queried' ? 180 : 100, row[2] === 'Approved' ? 150 : row[2] === 'Queried' ? 40 : 100, row[2] === 'Approved' ? 70 : row[2] === 'Queried' ? 40 : 100);
      doc.setFont('helvetica', row[2] === 'Approved' ? 'bold' : 'normal');
      doc.text(row[2], 134, y);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'normal');
      y += 7;
    });

    y += 15;
    doc.setDrawColor(200, 200, 210);
    doc.line(10, y, 200, y); y += 8;
    doc.setFontSize(9);
    doc.setTextColor(100, 110, 130);
    doc.text(`Report generated by Clearance Officer on ${new Date().toLocaleString('en-GB')}`, 10, y);
    y += 5;
    doc.text('This is a computer-generated document from the UniAbuja Screening System.', 10, y);

    doc.save(`${student.name.replace(/[,\s]+/g, '_')}_Clearance_Report.pdf`);
    setToast(`Exported: ${student.name}`);
  };

  const exportAnalyticsPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 190;
    let y = 20;
    const cleared = queue.filter(s => s.status === 'cleared').length;
    const pending = queue.filter(s => s.status === 'pending').length;
    const queried = queue.filter(s => s.status === 'queried').length;
    const rate = queue.length > 0 ? (cleared / queue.length * 100).toFixed(1) : '0.0';

    doc.setFillColor(6, 95, 70);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('UniAbuja', pageW / 2, 18, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Screening System - Analytics Report', pageW / 2, 27, { align: 'center' });

    y = 48;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Overview Summary', 10, y); y += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Students in Queue: ${queue.length}`, 10, y); y += 7;
    doc.setTextColor(6, 150, 70);
    doc.setFont('helvetica', 'bold');
    doc.text(`Cleared: ${cleared}`, 10, y); y += 7;
    doc.setTextColor(180, 140, 0);
    doc.text(`Pending: ${pending}`, 10, y); y += 7;
    doc.setTextColor(180, 40, 40);
    doc.text(`Queried: ${queried}`, 10, y); y += 7;
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(`Clearance Rate: ${rate}%`, 10, y); y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`Report Date: ${new Date().toLocaleDateString('en-GB')}`, 10, y);

    y += 15;
    doc.setDrawColor(6, 95, 70);
    doc.setLineWidth(0.5);
    doc.line(10, y, 200, y); y += 8;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Queue Overview', 10, y); y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    doc.setFillColor(6, 95, 70);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.rect(10, y - 5, 10, 8, 'F');
    doc.text('#', 12, y);
    doc.rect(20, y - 5, 80, 8, 'F');
    doc.text('Name', 22, y);
    doc.rect(100, y - 5, 50, 8, 'F');
    doc.text('Reg Number', 102, y);
    doc.rect(150, y - 5, 40, 8, 'F');
    doc.text('Status', 152, y);
    y += 9;

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    queue.forEach((s, i) => {
      if (i % 2 === 0) { doc.setFillColor(240, 240, 245); doc.rect(10, y - 4, 180, 7, 'F'); }
      doc.text(String(i + 1), 12, y);
      doc.text(s.name, 22, y);
      doc.text(s.reg, 102, y);
      doc.setTextColor(s.status === 'cleared' ? 6 : s.status === 'queried' ? 180 : 100, s.status === 'cleared' ? 150 : s.status === 'queried' ? 40 : 100, s.status === 'cleared' ? 70 : s.status === 'queried' ? 40 : 100);
      doc.setFont('helvetica', s.status === 'cleared' ? 'bold' : 'normal');
      doc.text(s.status.toUpperCase(), 152, y);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'normal');
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

    doc.save('Clearance_Analytics_Report.pdf');
    setToast('Analytics report exported');
  };

  const filtered = queue.filter(s => {
    const matchSearch = s.reg.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || s.status === filter;
    return matchSearch && matchFilter;
  });

  return loading ? (
    <div className="flex h-screen bg-slate-50 overflow-hidden animate-pulse">
      <div className="w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-100 space-y-4">
          <div className="h-6 w-32 bg-slate-200 rounded-lg" />
          <div className="h-10 w-full bg-slate-200 rounded-xl" />
          <div className="flex gap-2"><div className="h-7 w-12 bg-slate-200 rounded-lg" /><div className="h-7 w-16 bg-slate-200 rounded-lg" /><div className="h-7 w-14 bg-slate-200 rounded-lg" /><div className="h-7 w-14 bg-slate-200 rounded-lg" /></div>
        </div>
        <div className="flex-1 p-5 space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="flex items-center gap-3 p-4"><div className="w-9 h-9 bg-slate-200 rounded-xl" /><div className="flex-1 space-y-1.5"><div className="h-4 w-32 bg-slate-200 rounded" /><div className="h-3 w-24 bg-slate-200 rounded" /></div></div>)}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-slate-200 rounded-full" />
          <div className="h-4 w-48 bg-slate-200 rounded-lg" />
        </div>
      </div>
    </div>
  ) : (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar Queue - slide-out drawer on mobile */}
      <div className={`fixed md:relative inset-y-0 left-0 z-40 w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        {/* Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800 text-lg">Clearance Queue</h2>
            <div className="flex items-center gap-2">
              <span className="badge-info text-xs">{queue.length} students</span>
              <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">✕</button>
            </div>
          </div>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-primary-500" size={18} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or reg number..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400 transition-all group-focus-within:shadow-sm"
            />
          </div>
          {/* Filters */}
          <div className="flex gap-1.5 mt-3">
            {[
              { key: 'all', label: 'All' },
              { key: 'pending', label: 'Pending' },
              { key: 'queried', label: 'Queried' },
              { key: 'cleared', label: 'Cleared' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 active:scale-95 ${
                  filter === f.key
                    ? 'bg-primary-800 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Queue List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
              <Search size={40} className="mb-3 opacity-50" />
              <p className="text-sm font-medium">No students found</p>
            </div>
          ) : (
            filtered.map((student) => (
              <div
                key={student.id}
                onClick={async () => {
                    if (student.claimed_by && student.claimed_by !== currentUserId) {
                      setToast('Already claimed by ' + (student.claimed_name || 'another officer'));
                      return;
                    }
                    if (!student.claimed_by) await claimStudent(student.student_id);
                    selectedIdRef.current = student.student_id;
                    setSelected(student);
                  }}
                className={`p-4 border-b border-slate-50 cursor-pointer transition-all duration-200 group ${
                  selected?.id === student.id
                    ? 'bg-primary-50 border-l-4 border-l-primary-600 shadow-sm dark:bg-primary-900/40 dark:border-l-primary-400'
                    : 'hover:bg-slate-50 border-l-4 border-l-transparent hover:border-l-primary-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-200 group-hover:scale-110 group-hover:shadow-sm ${
                      student.status === 'cleared' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                      student.status === 'queried' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className={`font-semibold text-sm transition-colors duration-200 ${selected?.id === student.id ? 'text-primary-900 dark:text-white' : 'text-slate-800 group-hover:text-primary-700'}`}>{student.name}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{student.reg} &bull; {student.type}</p>
                      {student.claimed_name && (
                        <span className="inline-block mt-1 text-[10px] bg-amber-50 text-amber-700 font-medium px-2 py-0.5 rounded-full border border-amber-200/50 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700/50">
                          {student.claimed_by === currentUserId ? 'You' : student.claimed_name} is reviewing
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {student.status === 'cleared' && <span className="badge-success text-[10px]">Cleared</span>}
                    {student.status === 'queried' && <span className="badge-danger text-[10px]">Queried</span>}
                    {student.status === 'pending' && <span className="badge-neutral text-[10px]">Pending</span>}
                    <ChevronRight size={16} className="text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary-500" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main Review Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Always-visible header bar */}
        <div className="bg-white px-4 md:px-6 py-3 border-b border-slate-200 flex items-center shrink-0">
          <div className="flex items-center gap-2 md:gap-6 flex-1">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors" title="Open queue">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            {selected ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-primary-100 text-primary-700 flex items-center justify-center text-lg font-bold">
                  {selected.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-800">{selected.name}</h2>
                    {docStatuses.length > 0 && docStatuses.every(s => s === 'verified') && (
                      <span className="badge-success text-[10px]">All Approved</span>
                    )}
                  </div>
                  <div className="flex gap-4 text-sm text-slate-500 mt-0.5">
                    <span>Reg: <strong className="text-slate-700">{selected.reg}</strong></span>
                    <span>Type: <strong className="text-slate-700">{selected.type}</strong></span>
                    <span>Course: <strong className="text-slate-700">{selected.course || 'Computer Science'}</strong></span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-slate-400 text-sm">No student selected</p>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {selected && (
              <>
                <button onClick={() => setShowAnalytics(true)} className="btn-primary flex items-center gap-1.5 text-xs py-2 px-3">
                  <BarChart3 size={15} /> <span className="hidden sm:inline">Analytics</span>
                </button>
                <button onClick={() => exportStudentPDF(selected)} className="btn-outline flex items-center gap-1.5 text-xs py-2 px-3">
                  <Download size={15} /> <span className="hidden sm:inline">Export</span>
                </button>
              </>
            )}
            <button onClick={() => setShowNotifs(true)} className="relative p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors" title="Notifications">
              {officerNotifs.filter(n => !notifRead.includes(n.id)).length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                  {officerNotifs.filter(n => !notifRead.includes(n.id)).length}
                </span>
              )}
              <Bell size={20} />
            </button>
            <button onClick={() => setShowHelp(true)} className="btn-outline flex items-center gap-2 text-sm p-2.5 lg:px-4 lg:py-2.5" title="Help">
              <HelpCircle size={16} />
              <span className="hidden lg:inline">Help</span>
            </button>
            <button onClick={onLogout} className="flex items-center gap-2 text-sm text-slate-500 hover:text-rose-600 transition-colors font-medium p-2.5 lg:px-0" title="Log Out">
              <LogOut size={18} /> <span className="hidden lg:inline">Log Out</span>
            </button>
          </div>
        </div>

        {selected ? (
          <>
            {/* Content Split */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Left - Documents */}
              <div className="flex-1 bg-white lg:border-r border-slate-200 p-4 overflow-y-auto shrink-0">
                <h3 className="font-semibold text-slate-700 text-xs uppercase tracking-wider mb-4">Uploaded Documents</h3>
                <div className="space-y-2">
                    {docList.map((doc, idx) => (
                    <button
                      key={idx}
                      onClick={() => openViewer(idx)}
                      className={`w-full p-3 rounded-xl text-left transition-all duration-200 group/docs ${
                        activeDoc === idx
                          ? 'bg-primary-50 border border-primary-200 shadow-sm ring-1 ring-primary-100 dark:bg-primary-900/40 dark:border-primary-700 dark:ring-primary-800'
                          : 'bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-600 dark:hover:bg-slate-700 dark:hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText size={18} className={`transition-all duration-200 group-hover/docs:scale-110 group-hover/docs:-rotate-6 ${
                          activeDoc === idx ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 group-hover/docs:text-primary-500 dark:text-slate-500 dark:group-hover/docs:text-primary-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium transition-colors duration-200 ${activeDoc === idx ? 'text-primary-800 dark:text-primary-200' : 'text-slate-700 group-hover/docs:text-slate-800 dark:text-slate-300 dark:group-hover/docs:text-white'}`}>{doc}</p>
                          <p className={`text-[10px] mt-0.5 ${activeDoc === idx ? 'text-primary-500 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500'}`}>
                            {docStatuses[idx] === 'verified' ? 'Approved' : docStatuses[idx] === 'issues' ? 'Queried' : 'Pending review'}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right - Actions Panel */}
              <div className="w-full lg:w-80 bg-white lg:border-l border-slate-200 p-5 overflow-y-auto shrink-0">
                <h3 className="font-semibold text-slate-700 text-xs uppercase tracking-wider mb-4">Verification Actions</h3>

                {/* Document Status */}
                <div className="card p-4 mb-5">
                  <h4 className="font-medium text-sm text-slate-700 mb-3">Document Status</h4>
                  <div className="space-y-2">
                  {docList.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{doc}</span>
                        <span className={`badge text-[10px] ${
                          docStatuses[idx] === 'verified' ? 'badge-success' : docStatuses[idx] === 'issues' ? 'badge-danger' : 'badge-neutral'
                        }`}>
                          {docStatuses[idx] === 'verified' ? 'Verified' : docStatuses[idx] === 'issues' ? 'Issues Found' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="mb-5">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Review Notes</label>
                  <textarea
                    rows={3}
                    value={reviewNotes}
                    onChange={e => setReviewNotes(e.target.value)}
                    placeholder="Add verification notes or rejection reason..."
                    className="input-field resize-none text-sm"
                  />
                </div>

                {(() => { const pc = docStatuses.filter(s => s !== 'verified').length; return pc > 0 ? (
                  <button onClick={handleBulkApprove} className="btn-success w-full flex items-center justify-center gap-2 mb-4 text-sm group/ba">
                    <Check size={16} className="transition-transform duration-200 group-hover/ba:scale-125" /> Approve All ({pc} pending)
                  </button>
                ) : null; })()}

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button onClick={() => handleDocAction(activeDoc, 'verified')} className="btn-success w-full flex items-center justify-center gap-2 group/btn">
                    <Check size={18} className="transition-transform duration-200 group-hover/btn:scale-125" /> Approve Document
                  </button>
                  <button onClick={() => handleDocAction(activeDoc, 'issues')} className="btn-danger w-full flex items-center justify-center gap-2 group/btn">
                    <X size={18} className="transition-transform duration-200 group-hover/btn:scale-125" /> Query Document
                  </button>
                  <button onClick={() => handleDocAction(activeDoc, 'pending')} className="btn-outline w-full flex items-center justify-center gap-2 text-sm group/btn">
                    <Clock size={16} className="transition-all duration-200 group-hover/btn:rotate-12" /> Mark as Pending
                  </button>
                </div>

                {/* Activity Log */}
                <div className="mt-8">
                  <h4 className="font-semibold text-slate-700 text-xs uppercase tracking-wider mb-3">Activity Log</h4>
                  <div className="space-y-1">
                    {activityLogEntries.length === 0 ? (
                      <p className="text-xs text-slate-400 p-2">No activity recorded yet</p>
                    ) : (
                      activityLogEntries.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-sm p-2 rounded-xl hover:bg-slate-50 transition-colors duration-200 group/log">
                        <div className="w-2 h-2 bg-primary-400 rounded-full mt-1.5 shrink-0 transition-all duration-200 group-hover/log:scale-150 group-hover/log:bg-primary-600" />
                        <div>
                          <p className="text-slate-700 group-hover/log:text-slate-800 transition-colors duration-200">{log.action}</p>
                          <p className="text-xs text-slate-400">{log.time}</p>
                        </div>
                      </div>
                    ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Document Viewer Modal */}
            {viewerOpen && (
              <div className={`fixed inset-0 z-50 flex items-center justify-center ${fullscreen ? '' : 'p-4'}`} onClick={() => { setViewerOpen(false); setFullscreen(false); }}>
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                  <div className={`relative bg-white shadow-2xl flex flex-col overflow-hidden animate-scale-in ${
                  fullscreen
                    ? 'w-full h-full rounded-none'
                    : 'w-[70vw] max-w-5xl max-h-[85vh] rounded-2xl'
                }`} onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">{docList[activeDoc]}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{selected.name} &bull; {selected.reg}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {fileUrls[docList[activeDoc]] && (
                        <a href={fileUrls[docList[activeDoc]]} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary-600 hover:text-primary-700 font-medium">Open in new tab</a>
                      )}
                      <button onClick={() => setFullscreen(!fullscreen)} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all" title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                        {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                      </button>
                      <button onClick={() => { setViewerOpen(false); setFullscreen(false); }} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all" title="Close">
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center p-8 overflow-auto">
                    <div className="bg-white w-full max-w-2xl rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center p-8 min-h-[300px]">
                      {fileUrls[docList[activeDoc]] ? (
                        /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrls[docList[activeDoc]]) ? (
                          <img src={fileUrls[docList[activeDoc]]} alt={docList[activeDoc]} className="max-w-full max-h-[60vh] object-contain rounded-xl" />
                        ) : (
                          <iframe src={fileUrls[docList[activeDoc]]} className="w-full h-[60vh] rounded-xl border border-slate-200" title={docList[activeDoc]} />
                        )
                      ) : (
                        <>
                          <div className="p-6 rounded-2xl bg-slate-50 mb-5">
                            <FileText size={96} className="text-slate-300" />
                          </div>
                          <p className="text-slate-500 font-medium text-lg mb-1">Document Preview</p>
                          <p className="text-xs text-slate-400 text-center max-w-xs">
                            <span className="font-medium text-slate-600">{docList[activeDoc]}</span><br />
                            No file uploaded yet
                          </p>
                        </>
                      )}
                      <div className="flex items-center gap-2 mt-5 text-xs text-slate-400">
                        <span className={`px-2 py-1 rounded-lg ${docStatuses[activeDoc] === 'verified' ? 'bg-emerald-100 text-emerald-700' : docStatuses[activeDoc] === 'issues' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                          {docStatuses[activeDoc] === 'verified' ? 'Approved' : docStatuses[activeDoc] === 'issues' ? 'Queried' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 shrink-0">
                    <button onClick={() => { const url = fileUrls[docList[activeDoc]]; if (url) { window.open(url, '_blank'); } else { setToast('Document file not available for download'); } }} className="btn-outline flex items-center gap-1.5 text-sm">
                      <Download size={15} /> Download
                    </button>
                    <div className="flex-1" />
                    <button onClick={() => { setViewerOpen(false); setFullscreen(false); }} className="btn-outline text-sm">
                      Close
                    </button>
                    <button onClick={() => { handleDocAction(activeDoc, 'issues'); setViewerOpen(false); setFullscreen(false); }} className="btn-danger flex items-center gap-1.5 text-sm">
                      <X size={16} /> Query
                    </button>
                    <button onClick={() => { handleDocAction(activeDoc, 'verified'); setViewerOpen(false); setFullscreen(false); }} className="btn-success flex items-center gap-1.5 text-sm">
                      <Check size={16} /> Approve
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col text-slate-400 animate-fade-in">
            <div className="p-6 rounded-full bg-slate-100 mb-4">
              <User size={64} className="text-slate-300" />
            </div>
            <p className="text-lg font-medium text-slate-500">Select a student from the queue</p>
            <p className="text-sm mt-1 text-slate-400">to begin reviewing their documents</p>
          </div>
        )}
      </div>

      {/* Analytics Modal */}
      {showAnalytics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAnalytics(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary-100 text-primary-700">
                  <BarChart3 size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Screening Analytics</h3>
                  <p className="text-xs text-slate-500">Clearance officer performance overview</p>
                </div>
              </div>
              <button onClick={() => setShowAnalytics(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all">✕</button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                    <User size={14} /> Total Students
                  </div>
                  <span className="text-3xl font-bold text-slate-800">{queue.length}</span>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200/80">
                  <div className="flex items-center gap-2 text-xs text-emerald-600 mb-2">
                    <FileCheck size={14} /> Cleared
                  </div>
                  <span className="text-3xl font-bold text-emerald-700">{queue.filter(s => s.status === 'cleared').length}</span>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200/80">
                  <div className="flex items-center gap-2 text-xs text-amber-600 mb-2">
                    <Clock size={14} /> Pending
                  </div>
                  <span className="text-3xl font-bold text-amber-700">{queue.filter(s => s.status === 'pending').length}</span>
                </div>
                <div className="bg-rose-50 rounded-xl p-4 border border-rose-200/80">
                  <div className="flex items-center gap-2 text-xs text-rose-600 mb-2">
                    <AlertCircle size={14} /> Queried
                  </div>
                  <span className="text-3xl font-bold text-rose-700">{queue.filter(s => s.status === 'queried').length}</span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <TrendingUp size={16} className="text-primary-600" /> Clearance Rate
                </h4>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-bold text-slate-800">{(queue.length > 0 ? (queue.filter(s => s.status === 'cleared').length / queue.length * 100) : 0).toFixed(0)}%</span>
                  <span className="text-sm text-slate-500 mb-1">of students processed</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-600 to-emerald-400 rounded-full transition-all duration-700" style={{ width: `${queue.length > 0 ? (queue.filter(s => s.status === 'cleared').length / queue.length * 100) : 0}%` }} />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Queue Overview</h4>
                <div className="space-y-3 max-h-56 overflow-y-auto">
                  {queue.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">{s.name}</p>
                          <p className="text-[10px] text-slate-400">{s.reg} · {s.type}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        s.status === 'cleared' ? 'bg-emerald-100 text-emerald-700' :
                        s.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>{s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
              <button onClick={() => { setShowAnalytics(false); exportAnalyticsPDF(); }} className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5">
                <Download size={14} /> Export Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16" onClick={() => setShowHelp(false)}>
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
                <h4 className="font-semibold text-slate-800 mb-1">Reviewing Documents</h4>
                <p>Select a student from the queue, then click each document to preview it. Use the action buttons to <strong>Approve</strong>, <strong>Query</strong> (with a reason), or <strong>Mark as Pending</strong>.</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Document Statuses</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li><span className="text-emerald-600 font-medium">Verified</span> — Document meets requirements.</li>
                  <li><span className="text-rose-600 font-medium">Issues Found</span> — Document has problems. Add a note explaining why.</li>
                  <li><span className="text-amber-600 font-medium">Pending</span> — Awaiting review or student re-upload.</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Exporting Reports</h4>
                <p>Use the <strong>Export</strong> button to download a student-specific clearance report. Use <strong>Analytics &gt; Export Report</strong> for a full overview.</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Need More Help?</h4>
                <p>Contact the HOD or system administrator for further assistance.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {showNotifs && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16" onClick={() => setShowNotifs(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[70vh] flex flex-col overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Bell size={18} className="text-primary-600" />
                <h3 className="font-bold text-slate-800">Notifications</h3>
                {officerNotifs.filter(n => !notifRead.includes(n.id)).length > 0 && (
                  <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {officerNotifs.filter(n => !notifRead.includes(n.id)).length} new
                  </span>
                )}
              </div>
              <button onClick={() => setShowNotifs(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-all">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {officerNotifs.map((n) => {
                const isRead = notifRead.includes(n.id);
                return (
                  <div key={n.id} className={`px-5 py-3.5 border-b border-slate-50 last:border-0 transition-colors duration-150 hover:bg-slate-50 cursor-pointer ${!isRead ? 'bg-primary-50/40' : ''}`}
                    onClick={() => { if (!isRead) setNotifRead([...notifRead, n.id]); }}
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
                          n.type === 'queue' ? 'bg-blue-100 text-blue-700' :
                          n.type === 'response' ? 'bg-emerald-100 text-emerald-700' :
                          n.type === 'announcement' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>{n.type}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-between items-center shrink-0 bg-slate-50/50">
              <span className="text-[11px] text-slate-400">{officerNotifs.filter(n => !notifRead.includes(n.id)).length} unread</span>
              <button onClick={() => setNotifRead(officerNotifs.map(n => n.id))} className="text-[11px] text-primary-600 hover:text-primary-700 font-medium">Mark all read</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 bg-slate-800 text-white px-5 py-3 rounded-xl shadow-xl z-50 animate-fade-in-up flex items-center gap-3 max-w-sm">
          <span className="text-sm">{toast}</span>
        </div>
      )}
    </div>
  );
}
