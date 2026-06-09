import React, { useState, useRef, useEffect } from 'react';
import {
  Upload, CheckCircle, AlertCircle, FileText, Clock,
  X, Eye, LogOut, HelpCircle, FileBadge, Award, Image, Sparkles, Bell
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabase';
import { getStudentDocuments, getNotifications, uploadDocument, uploadFileToStorage, getPublicUrl, updateStudentPassport } from '../lib/db';

interface Document {
  id: number;
  name: string;
  status: 'approved' | 'pending' | 'queried';
  reason?: string;
  icon: React.ElementType;
}

const defaultStudentInfo = {
  name: 'Loading...',
  regNo: '',
  course: '',
  admissionType: '',
  session: '',
  jambNo: '',
};

const defaultDocs: Document[] = [];

const defaultNotifs: { id: string; title: string; message: string; time: string; type: string }[] = [];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

interface StudentDashboardProps {
  onLogout?: () => void;
}

export default function StudentDashboard({ onLogout }: StudentDashboardProps) {
  const [studentInfo, setStudentInfo] = useState(defaultStudentInfo);
  const [documents, setDocuments] = useState<Document[]>(defaultDocs);

  const [generating, setGenerating] = useState(false);
  const [passportImage, setPassportImage] = useState<string | null>(null);
  const passportDocId = useRef<number | null>(null);
  const [showQueryAlert, setShowQueryAlert] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [notifRead, setNotifRead] = useState<string[]>([]);
  const [studentNotifs, setStudentNotifs] = useState<{ id: string; title: string; message: string; time: string; type: string }[]>(defaultNotifs);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [fileUrls, setFileUrls] = useState<Record<number, string>>({});
  const uploadDocIdRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { return; }

      const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single();
      const { data: student } = await supabase.from('students').select('*').eq('user_id', user.id).single();
      if (student) {
        setStudentId(student.id);
        setStudentInfo({
          name: profile?.name || student.reg_no,
          regNo: student.reg_no,
          course: student.course,
          admissionType: student.admission_type,
          session: student.session,
          jambNo: student.jamb_no || '',
        });
        if (student.passport_url) {
          setPassportImage(student.passport_url);
        }
      }
      // Load documents from Supabase
      if (student) {
        const { data: docs } = await getStudentDocuments(student.id);
        if (docs && docs.length > 0) {
          const nameIcon: Record<string, React.ElementType> = {
            'Drug Test Result': FileText,
            'Admission Notification/Letter': FileText,
            'Primary School Certificate': FileText,
            'SSCE Result': FileText,
            'JAMB Result Slip / JAMB Score': FileText,
            'Post UTME Score': FileText,
            'Birth Certificate': FileText,
            'Indigene Letter': FileText,
            'Letter of Undertaking': FileText,
            'JAMB Reg Slip': FileText,
            'Acceptance Fee Receipt': FileText,
            'Screening Fee Receipt': FileText,
            'Scratch Card': FileText,
            'Passport Photograph': Image,
          };
          const urls: Record<number, string> = {};
          setDocuments(docs.map((d: any, idx: number) => {
            const docName = d.document?.name || `Document ${idx + 1}`;
            if (docName === 'Passport Photograph') passportDocId.current = d.document?.id || idx + 1;
            if (d.file_url) urls[d.document?.id || idx] = d.file_url;
            return {
              id: d.document?.id || idx + 1,
              name: docName,
              status: d.status === 'verified' ? 'approved' : d.status === 'issues' ? 'queried' : d.status,
              reason: d.queried_reason || undefined,
              icon: nameIcon[docName] || FileText,
            };
          }));
          setFileUrls(urls);
        }
      }
      // Load notifications
      const { data: notifs } = await getNotifications(user.id);
      if (notifs && notifs.length > 0) {
        setStudentNotifs(notifs.map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          time: timeAgo(n.created_at),
          type: n.type,
        })));
      }
      setLoading(false);
    }
    loadData();
  }, []);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); }
  }, [toast]);

  const handlePassportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !studentId) return;
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `passports/${studentId}/${Date.now()}.${ext}`;
    const { error } = await uploadFileToStorage('documents', path, file);
    if (error) { setToast('Upload failed'); return; }
    const publicUrl = getPublicUrl('documents', path);
    await updateStudentPassport(studentId, publicUrl);
    const reader = new FileReader();
    reader.onload = (ev) => setPassportImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    setToast('Passport uploaded successfully');
  };

  const pendingCount = documents.filter(d => d.status === 'pending').length;
  const queriedCount = documents.filter(d => d.status === 'queried').length;
  const approvedCount = documents.filter(d => d.status === 'approved').length;
  const isCleared = documents.length > 0 && approvedCount === documents.length && queriedCount === 0;
  const progress = documents.length > 0 ? Math.round((approvedCount / documents.length) * 100) : 0;

  const generatePDF = () => {
    setErrorMsg(null);
    if (documents.find(d => d.id === 10)?.status === 'approved' && !passportImage) {
      setErrorMsg('Please upload your passport photograph before generating Form 01.');
      return;
    }
    setGenerating(true);
    setTimeout(() => {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageW = 210;
      const margin = 18;
      const contentW = pageW - margin * 2;
      const pageH = 297;
      let y = margin;
      const primary = [6, 94, 70];
      const light = [236, 253, 245];
      const dark = [13, 18, 30];

      const rect = (x: number, y: number, w: number, h: number, color: number[]) => {
        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(x, y, w, h, 'F');
      };
      const text = (txt: string, x: number, y: number, size: number, color: number[], opts?: { align?: string, font?: string }) => {
        doc.setFont(opts?.font || 'helvetica', 'normal');
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        const align = (opts?.align as 'left' | 'center' | 'right') || 'left';
        if (align === 'center') { doc.text(txt, x, y, { align: 'center' }); }
        else if (align === 'right') { doc.text(txt, x, y, { align: 'right' }); }
        else { doc.text(txt, x, y); }
      };

      rect(0, 0, pageW, 32, primary);
      text('UNIABUJA', pageW / 2, 11, 14, [255, 255, 255], { align: 'center', font: 'bold' });
      text('University of Abuja — Departmental Student Screening System', pageW / 2, 22, 8, [200, 220, 200], { align: 'center' });
      text('CLEARANCE CERTIFICATE — FORM 01', pageW / 2, 30, 7, [166, 200, 166], { align: 'center' });

      y = 44;
      text('CERTIFICATE OF CLEARANCE', pageW / 2, y, 16, primary, { align: 'center', font: 'bold' });
      y += 9;
      text('This is to certify that the underlisted candidate has been duly screened', pageW / 2, y, 8, dark, { align: 'center' });
      y += 5;
      text('and all required documents have been verified and approved.', pageW / 2, y, 8, dark, { align: 'center' });
      y += 10;

      const infoH = passportImage ? 60 : 52;
      rect(margin, y, contentW, infoH, light);
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, y, contentW, infoH, 'S');

      const leftX = margin + 8;
      const rowH = 8;
      const fields = [
        { label: 'Full Name:', value: studentInfo.name },
        { label: 'Registration No:', value: studentInfo.regNo },
        { label: 'Course of Study:', value: studentInfo.course },
        { label: 'Admission Type:', value: studentInfo.admissionType },
        { label: 'Academic Session:', value: studentInfo.session },
        { label: 'JAMB Registration No:', value: studentInfo.jambNo },
      ];

      fields.forEach((f, i) => {
        const rowY = y + 6 + i * rowH;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(dark[0], dark[1], dark[2]);
        doc.text(f.label, leftX, rowY);
        doc.setFont('helvetica', 'normal');
        doc.text(':  ' + f.value, leftX + 40, rowY);
      });

      if (passportImage) {
        const photoX = margin + contentW - 38;
        const photoY = y + 5;
        const photoW = 30;
        const photoH = 36;
        doc.setDrawColor(primary[0], primary[1], primary[2]);
        doc.setLineWidth(0.6);
        doc.rect(photoX, photoY, photoW, photoH, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5);
        doc.setTextColor(primary[0], primary[1], primary[2]);
        doc.text('PASSPORT', photoX + photoW / 2, photoY + photoH + 3.5, { align: 'center' });
        try {
          const imgFormat = passportImage.startsWith('data:image/png') ? 'PNG' : 'JPEG';
          doc.addImage(passportImage, imgFormat, photoX + 1, photoY + 1, photoW - 2, photoH - 2);
        } catch (_e) {
          rect(photoX + 1, photoY + 1, photoW - 2, photoH - 2, [200, 200, 200]);
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(5);
          doc.setTextColor(100, 100, 100);
          doc.text('photo', photoX + photoW / 2, photoY + photoH / 2 + 1, { align: 'center' });
        }
      }

      y += infoH + 10;
      text('VERIFIED DOCUMENTS', pageW / 2, y, 11, primary, { align: 'center', font: 'bold' });
      y += 8;

      const approved = documents.filter(d => d.status === 'approved');
      const col1 = margin;
      const col2 = margin + contentW * 0.42;
      const col3 = margin + contentW * 0.76;
      const rowHTable = 6;
      const headerH = 7;

      rect(col1, y, contentW, headerH, primary);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text('S/N', col1 + 6, y + 4.8);
      doc.text('Document Name', col2, y + 4.8);
      doc.text('Status', col3, y + 4.8);
      y += headerH;

      approved.forEach((docItem, i) => {
        const rowBg = i % 2 === 0 ? [248, 250, 252] : [255, 255, 255];
        rect(col1, y, contentW, rowHTable, rowBg);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(dark[0], dark[1], dark[2]);
        doc.text(`${i + 1}`, col1 + 6, y + 4);
        doc.text(docItem.name, col2, y + 4);
        doc.setTextColor(6, 94, 70);
        doc.setFont('helvetica', 'bold');
        doc.text('APPROVED', col3, y + 4);
        y += rowHTable;
      });

      y += 6;
      const summaryH = 16;
      rect(margin, y, contentW, summaryH, light);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(dark[0], dark[1], dark[2]);
      doc.text(`Total Documents Submitted: ${documents.length}`, margin + 8, y + 6.5);
      doc.text(`Total Documents Verified: ${approvedCount}`, margin + 8, y + 13);

      y += summaryH + 16;
      const footerSpace = 18;
      if (y + footerSpace > pageH - 10) { y = pageH - 10 - footerSpace; }

      doc.setDrawColor(primary[0], primary[1], primary[2]);
      doc.setLineWidth(0.4);
      doc.line(margin + 8, y, margin + 55, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(dark[0], dark[1], dark[2]);
      doc.text('Head of Department Signature', margin + 8, y + 4.5);

      doc.setDrawColor(primary[0], primary[1], primary[2]);
      doc.line(pageW - margin - 8, y, pageW - margin - 55, y);
      doc.text('Departmental Stamp', pageW - margin - 8, y + 4.5, { align: 'right' });

      y += 14;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      doc.setTextColor(150, 150, 150);
      text('This certificate is auto-generated by the UniAbuja Screening System. No signature required for digital verification.', pageW / 2, y, 6, [150, 150, 150], { align: 'center' });
      y += 3.5;
      text(`Generated on: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageW / 2, y, 6, [150, 150, 150], { align: 'center' });
      y += 3.5;
      text('Ref: FRM-01-UNIABUJA-2024', pageW / 2, y, 6, [150, 150, 150], { align: 'center' });

      doc.save(`UniAbuja_Form01_${studentInfo.regNo.replace(/\//g, '-')}.pdf`);
      setGenerating(false);
    }, 800);
  };

  return loading ? (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6 animate-pulse">
      <div className="flex justify-between items-center mb-8">
        <div className="space-y-2"><div className="h-8 w-64 bg-slate-200 rounded-lg" /><div className="h-4 w-48 bg-slate-200 rounded-lg" /></div>
        <div className="flex gap-3"><div className="h-10 w-20 bg-slate-200 rounded-xl" /><div className="h-10 w-24 bg-slate-200 rounded-xl" /></div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="card p-5"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-slate-200 rounded-xl" /><div className="space-y-2"><div className="h-3 w-16 bg-slate-200 rounded" /><div className="h-6 w-8 bg-slate-200 rounded" /></div></div></div>)}
      </div>
      <div className="card p-6"><div className="h-6 w-48 bg-slate-200 rounded-lg mb-4" /><div className="h-4 bg-slate-200 rounded-full w-full" /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3,4,5,6].map(i => <div key={i} className="card p-5"><div className="flex items-start gap-4 mb-4"><div className="w-10 h-10 bg-slate-200 rounded-xl" /><div className="h-4 w-20 bg-slate-200 rounded-lg" /></div><div className="h-4 w-3/4 bg-slate-200 rounded-lg" /><div className="mt-4 h-9 w-full bg-slate-200 rounded-xl" /></div>)}
      </div>
    </div>
  ) : (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Welcome back, {studentInfo.name.split(' ').pop()}</h1>
          <p className="text-slate-500 mt-1">
            Reg No: <span className="font-semibold text-slate-700">{studentInfo.regNo}</span>
            &nbsp;&bull;&nbsp; {studentInfo.course} ({studentInfo.admissionType})
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowNotifs(true)} className="relative p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors" title="Notifications">
            {studentNotifs.filter(n => !notifRead.includes(n.id)).length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                {studentNotifs.filter(n => !notifRead.includes(n.id)).length}
              </span>
            )}
            <Bell size={20} />
          </button>
          <button onClick={() => setShowHelp(true)} className="btn-outline flex items-center gap-2 text-sm">
            <HelpCircle size={16} />
            Help
          </button>
          <button onClick={onLogout} className="flex items-center gap-2 text-sm text-slate-500 hover:text-rose-600 transition-colors font-medium">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: documents.length, icon: FileText, color: 'bg-blue-50 text-blue-600', border: 'border-t-blue-400', textColor: 'text-slate-800', anim: 'stagger-1' },
          { label: 'Approved', value: approvedCount, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600', border: 'border-t-emerald-400', textColor: 'text-emerald-600', anim: 'stagger-2' },
          { label: 'Pending', value: pendingCount, icon: Clock, color: 'bg-amber-50 text-amber-600', border: 'border-t-amber-400', textColor: 'text-amber-600', anim: 'stagger-3' },
          { label: 'Queried', value: queriedCount, icon: AlertCircle, color: 'bg-rose-50 text-rose-600', border: 'border-t-rose-400', textColor: 'text-rose-600', anim: 'stagger-4' },
        ].map((stat, idx) => (
          <div key={idx} className={`card p-5 flex items-center gap-4 animate-fade-in-up ${stat.anim} hover:shadow-lg hover:-translate-y-1 ${stat.border} border-t-2 group cursor-default`}>
            <div className={`p-3 rounded-xl shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className={`text-2xl font-bold transition-colors duration-300 ${stat.textColor}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Progress Section */}
      <div className="card p-6 animate-fade-in-up stagger-3 hover:shadow-md hover:border-slate-200 transition-all duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Clearance Progress</h2>
            <p className="text-sm text-slate-500">{approvedCount} of {documents.length} documents approved</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-3xl font-extrabold text-primary-800 tabular-nums">{progress}%</span>
            <div className="w-36">
              <div className="bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 h-3 rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${progress}%` }}>
                  <div className="absolute inset-0 bg-white/20 rounded-full animate-shimmer" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-0.5 h-1.5">
          {documents.map((d, i) => (
            <div
              key={i}
              className={`flex-1 rounded-full transition-all duration-500 ${
                d.status === 'approved' ? 'bg-emerald-400' :
                d.status === 'queried' ? 'bg-rose-400' : 'bg-slate-200'
              } ${`transition-delay-${i * 50}`}`}
              style={{ transitionDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex items-start gap-4 animate-scale-in">
          <div className="p-2 bg-rose-100 rounded-lg shrink-0">
            <AlertCircle className="text-rose-600" size={20} />
          </div>
          <div className="flex-1">
            <p className="text-rose-700 text-sm font-medium">{errorMsg}</p>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 transition-colors shrink-0">
            <X size={20} />
          </button>
        </div>
      )}

      {/* Query Alert */}
      {queriedCount > 0 && showQueryAlert && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex items-start gap-4 animate-scale-in">
          <div className="p-2 bg-rose-100 rounded-lg shrink-0">
            <AlertCircle className="text-rose-600" size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-rose-800">Action Required</h3>
            <p className="text-rose-600 text-sm mt-0.5">
              {queriedCount} document{queriedCount > 1 ? 's' : ''} need{queriedCount === 1 ? 's' : ''} your attention. Review the feedback and re-upload corrected files.
            </p>
          </div>
          <button onClick={() => setShowQueryAlert(false)} className="text-rose-500 hover:text-rose-700 transition-colors shrink-0">
            <X size={20} />
          </button>
        </div>
      )}

      {/* Cleared! Form 01 Section */}
      {isCleared && (
        <div className="bg-gradient-to-r from-emerald-50 via-emerald-50/80 to-emerald-100/50 border-2 border-emerald-200 rounded-2xl p-6 lg:p-8 animate-scale-in relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-200/30 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          <div className="flex flex-col lg:flex-row items-center gap-6 relative z-10">
            <div className="p-4 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl shadow-lg shadow-emerald-200/50 shrink-0 animate-glow">
              <Award className="text-white" size={40} />
            </div>
            <div className="flex-1 text-center lg:text-left">
              <h2 className="text-2xl font-bold text-emerald-900 flex items-center justify-center lg:justify-start gap-2">
                Clearance Complete
                <Sparkles size={20} className="text-accent-500" />
              </h2>
              <p className="text-emerald-700 mt-1">
                All {documents.length} documents have been verified and approved. You can now download your official Form 01 clearance certificate.
              </p>
            </div>
            <button
              onClick={generatePDF}
              disabled={generating}
              className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:from-emerald-400 disabled:to-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-200/50 hover:shadow-xl hover:shadow-emerald-200/70 transition-all active:scale-[0.97] text-lg shrink-0"
            >
              {generating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileBadge size={24} />
                  Download Form 01
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Document Grid */}
      <div>
        <h2 className="font-bold text-slate-800 text-lg mb-4 animate-fade-in-up">Required Documents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc, idx) => (
              <div
                key={doc.id}
                className={`bg-white rounded-2xl border border-slate-100 p-5 transition-all duration-300 animate-fade-in-up ${`stagger-${Math.min(idx + 1, 10)}`} group ${
                  doc.status === 'approved' ? 'border-l-4 border-l-emerald-400 shadow-sm shadow-emerald-200/40 hover:shadow-lg hover:shadow-emerald-200/50 hover:-translate-y-1' :
                  doc.status === 'queried' ? 'border-l-4 border-l-rose-400 ring-1 ring-rose-200 shadow-sm shadow-rose-200/30 hover:shadow-lg hover:shadow-rose-200/40 hover:-translate-y-1' :
                  'border-l-4 border-l-amber-400 shadow-sm shadow-slate-200/50 hover:shadow-lg hover:shadow-slate-300/50 hover:-translate-y-1'
                } ${isCleared ? 'opacity-80 hover:opacity-100' : ''}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-2.5 rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 group-hover:shadow-md ${
                    doc.status === 'approved' ? 'bg-emerald-50 group-hover:bg-emerald-100' :
                    doc.status === 'queried' ? 'bg-rose-50 group-hover:bg-rose-100' : 'bg-slate-50 group-hover:bg-slate-100'
                  }`}>
                    <doc.icon className={`transition-all duration-300 group-hover:scale-110 ${
                      doc.status === 'approved' ? 'text-emerald-600' :
                      doc.status === 'queried' ? 'text-rose-600' : 'text-slate-500'
                    }`} size={22} />
                  </div>
                  {doc.status === 'approved' && <span className="badge-success group-hover:shadow-sm transition-all">Approved</span>}
                  {doc.status === 'pending' && <span className="badge-neutral group-hover:shadow-sm transition-all">Pending</span>}
                  {doc.status === 'queried' && <span className="badge-danger group-hover:shadow-sm transition-all">Queried</span>}
                </div>

              <h3 className="font-semibold text-slate-800 text-sm leading-snug">{doc.name}</h3>

              {doc.status === 'queried' && doc.reason && (
                <div className="mt-3 text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-100">
                  <p className="font-medium mb-0.5">Feedback:</p>
                  <p>{doc.reason}</p>
                </div>
              )}

              {doc.id === passportDocId.current && (
                <div className="mt-3">
                  {passportImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative w-full group">
                        <img
                          src={passportImage}
                          alt="Passport"
                          className="w-full h-32 object-cover rounded-xl border border-slate-200 transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 rounded-xl transition-colors duration-300" />
                      </div>
                      <div className="flex gap-2 w-full">
                        <div className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium">
                          <CheckCircle size={16} /> Uploaded
                        </div>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-100 transition-colors"
                        >
                          <Upload size={18} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-800 hover:bg-primary-900 text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md active:scale-[0.97] group/btn"
                    >
                      <Upload size={16} className="transition-transform duration-300 group-hover/btn:rotate-12" /> Upload Passport
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePassportUpload}
                    className="hidden"
                  />
                  <input
                    ref={fileUploadRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      const docId = uploadDocIdRef.current;
                      if (!file || !studentId || !docId) return;
                      const ext = file.name.split('.').pop() || 'pdf';
                      const path = `documents/${studentId}/${docId}/${Date.now()}.${ext}`;
                      const { error } = await uploadFileToStorage('documents', path, file);
                      if (error) { setToast('Upload failed'); return; }
                      const publicUrl = getPublicUrl('documents', path);
                      await uploadDocument(studentId, docId, publicUrl);
                      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: 'pending' } : d));
                      setToast(`Uploaded: ${documents.find(d => d.id === docId)?.name || 'Document'}`);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </div>
              )}

              {doc.id !== passportDocId.current && (
              <div className="mt-5">
                {doc.status === 'approved' ? (
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium border border-emerald-200/50">
                      <CheckCircle size={16} /> Accepted
                    </div>
                    <button onClick={() => { const url = fileUrls[doc.id]; if (url) window.open(url, '_blank'); else setToast('No file uploaded yet'); }} className="btn-ghost group" title="View document">
                      <Eye size={18} className="transition-all duration-200 group-hover:scale-110" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { uploadDocIdRef.current = doc.id; fileUploadRef.current?.click(); }} className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97] group/btn ${
                    doc.status === 'queried'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm hover:shadow-md'
                      : 'bg-primary-800 hover:bg-primary-900 text-white shadow-sm hover:shadow-md'
                  }`}>
                    <Upload size={16} className="transition-transform duration-300 group-hover/btn:rotate-12" />
                    {doc.status === 'queried' ? 'Re-upload' : 'Upload'}
                  </button>
                )}
              </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24" onClick={() => setShowHelp(false)}>
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
                <h4 className="font-semibold text-slate-800 mb-1">Uploading Documents</h4>
                <p>Click the <strong>Upload</strong> or <strong>Re-upload</strong> button on any pending or queried document to submit your file. Accepted formats: PDF, JPG, PNG.</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Document Statuses</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li><span className="text-emerald-600 font-medium">Approved</span> — Your document has been verified.</li>
                  <li><span className="text-amber-600 font-medium">Pending</span> — Awaiting review by screening officers.</li>
                  <li><span className="text-rose-600 font-medium">Queried</span> — There is an issue. Read the feedback and re-upload.</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Passport Photograph</h4>
                <p>Upload a clear, recent passport photograph. This will appear on your Form 01 clearance certificate.</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Form 01 Certificate</h4>
                <p>Once all documents are approved, the <strong>Download Form 01</strong> button will appear. You can download your official clearance certificate as a PDF.</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Need More Help?</h4>
                <p>Contact the departmental screening office or your HOD for further assistance.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {showNotifs && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24" onClick={() => setShowNotifs(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[70vh] flex flex-col overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Bell size={18} className="text-primary-600" />
                <h3 className="font-bold text-slate-800">Notifications</h3>
                {studentNotifs.filter(n => !notifRead.includes(n.id)).length > 0 && (
                  <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {studentNotifs.filter(n => !notifRead.includes(n.id)).length} new
                  </span>
                )}
              </div>
              <button onClick={() => setShowNotifs(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-all">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {studentNotifs.map((n) => {
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
                          n.type === 'approval' ? 'bg-emerald-100 text-emerald-700' :
                          n.type === 'query' ? 'bg-rose-100 text-rose-700' :
                          n.type === 'milestone' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>{n.type}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-between items-center shrink-0 bg-slate-50/50">
              <span className="text-[11px] text-slate-400">{studentNotifs.filter(n => !notifRead.includes(n.id)).length} unread</span>
              <button onClick={() => setNotifRead(studentNotifs.map(n => n.id))} className="text-[11px] text-primary-600 hover:text-primary-700 font-medium">Mark all read</button>
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
