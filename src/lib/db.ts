import { supabase } from './supabase';

// ─── Types ─────────────────────────────────────────
export type UserRole = 'student' | 'officer' | 'hod';
export type DocStatus = 'pending' | 'verified' | 'issues';
export type StudentStatus = 'pending' | 'queried' | 'cleared';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  avatar_url?: string;
}

export interface Student {
  id: string;
  user_id?: string;
  reg_no: string;
  admission_type: 'UTME' | 'DE';
  course: string;
  session: string;
  jamb_no?: string;
  status: StudentStatus;
  passport_url?: string;
}

export interface Document {
  id: number;
  name: string;
  required: boolean;
  sort_order: number;
}

export interface StudentDocument {
  id: string;
  student_id: string;
  document_id: number;
  status: DocStatus;
  queried_reason?: string;
  file_url?: string;
  document?: Document;
}

export interface QueueItem {
  id: string;
  officer_id: string;
  student_id: string;
  student?: Student;
  profile?: Profile;
}

export interface ActivityLog {
  id: string;
  officer_id?: string;
  action: string;
  target_student: string;
  created_at: string;
  profile?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface Officer {
  name: string;
  role: string;
  students: number;
  cleared: number;
  active: boolean;
}

// ─── Auth ───────────────────────────────────────────
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signUp(email: string, password: string, name: string, role: UserRole) {
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  if (authError || !authData.user) return { error: authError };
  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    name,
    email,
    role,
  });
  return { data: authData, error: profileError };
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}

export async function getProfile(userId: string) {
  return supabase.from('profiles').select('*').eq('id', userId).single();
}

export async function lookupStudentEmailByRegNo(regNo: string) {
  const { data, error } = await supabase.rpc('get_email_by_reg_no', { reg: regNo });
  return { email: data as string | null, error };
}

// ─── Students ───────────────────────────────────────
export async function getStudentProfile(userId: string) {
  return supabase.from('students').select('*').eq('user_id', userId).single();
}

export async function getStudentByReg(regNo: string) {
  return supabase.from('students').select('*').eq('reg_no', regNo).single();
}

export async function getAllStudents() {
  return supabase.from('students').select('*').order('reg_no');
}

export async function searchStudents(query: string) {
  return supabase.from('students').select('*').ilike('name', `%${query}%`).order('name');
}

export async function getStudentName(studentId: string) {
  const { data } = await supabase
    .from('students')
    .select('reg_no')
    .eq('id', studentId)
    .single();
  return data?.reg_no || 'Unknown';
}

export async function updateStudentStatus(studentId: string, status: StudentStatus) {
  return supabase.from('students').update({ status }).eq('id', studentId);
}

export async function bulkCreateStudents(students: {
  reg_no: string;
  name: string;
  email: string;
  admission_type: 'UTME' | 'DE';
  course: string;
  session: string;
  jamb_no?: string;
}[]) {
  const results = { imported: 0, skipped: 0, errors: 0 };
  for (const s of students) {
    const { data: existing } = await supabase.from('students').select('id').eq('reg_no', s.reg_no).maybeSingle();
    if (existing) { results.skipped++; continue; }
    const { data: auth, error: authErr } = await supabase.auth.admin.createUser({
      email: s.email,
      password: `stu${Date.now()}`,
      email_confirm: true,
      user_metadata: { password_change_required: true },
    });
    if (authErr || !auth?.user) { results.errors++; continue; }
    const { error: insertErr } = await supabase.from('students').insert({
      user_id: auth.user.id,
      reg_no: s.reg_no,
      name: s.name,
      admission_type: s.admission_type,
      course: s.course,
      session: s.session,
      jamb_no: s.jamb_no || null,
      status: 'pending',
    });
    if (insertErr) { results.errors++; continue; }
    results.imported++;
  }
  return results;
}

export async function getStudentStats(session?: string) {
  let query = supabase.from('students').select('status');
  if (session) query = query.eq('session', session);
  const { data: all } = await query;
  if (!all) return { total: 0, cleared: 0, pending: 0, queried: 0 };
  return {
    total: all.length,
    cleared: all.filter(s => s.status === 'cleared').length,
    pending: all.filter(s => s.status === 'pending').length,
    queried: all.filter(s => s.status === 'queried').length,
  };
}

export async function getStudentsWithDetails(session?: string) {
  let query = supabase
    .from('students')
    .select('*, student_documents(*, document:documents(*))')
    .order('name');
  if (session) query = query.eq('session', session);
  const { data } = await query;
  return data || [];
}

export async function getRejectionReasons() {
  const { data } = await supabase
    .from('student_documents')
    .select('queried_reason, document:documents(name)')
    .not('queried_reason', 'is', null);
  if (!data) return [];
  const counts: Record<string, number> = {};
  data.forEach((d: any) => {
    const reason = d.queried_reason || d.document?.name || 'Unknown';
    counts[reason] = (counts[reason] || 0) + 1;
  });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return Object.entries(counts)
    .map(([reason, count]) => ({ reason, count, percent: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// ─── Documents ──────────────────────────────────────
export async function getDocuments() {
  return supabase.from('documents').select('*').order('sort_order');
}

export async function getStudentDocuments(studentId: string) {
  return supabase.from('student_documents')
    .select('*, document:documents(*)')
    .eq('student_id', studentId);
}

export async function updateDocumentStatus(
  docId: string,
  status: DocStatus,
  reviewedBy: string,
  queriedReason?: string
) {
  return supabase.from('student_documents').update({
    status,
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
    queried_reason: queriedReason || null,
  }).eq('id', docId);
}

export async function uploadDocument(
  studentId: string,
  documentId: number,
  fileUrl: string
) {
  // Check if a record already exists
  const { data: existing } = await supabase
    .from('student_documents')
    .select('id')
    .eq('student_id', studentId)
    .eq('document_id', documentId)
    .maybeSingle();

  if (existing) {
    return supabase.from('student_documents')
      .update({ file_url: fileUrl, uploaded_at: new Date().toISOString(), status: 'pending' })
      .eq('id', existing.id);
  }

  return supabase.from('student_documents').insert({
    student_id: studentId,
    document_id: documentId,
    status: 'pending',
    file_url: fileUrl,
    uploaded_at: new Date().toISOString(),
  });
}

export async function uploadFileToStorage(
  bucket: string,
  path: string,
  file: File
) {
  return supabase.storage.from(bucket).upload(path, file, { upsert: true });
}

export function getPublicUrl(bucket: string, path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteFileFromStorage(bucket: string, path: string) {
  return supabase.storage.from(bucket).remove([path]);
}

export async function updateStudentPassport(studentId: string, passportUrl: string) {
  return supabase.from('students').update({ passport_url: passportUrl }).eq('id', studentId);
}

// ─── Queue (Officer) ────────────────────────────────
export async function getOfficerQueue(officerId: string) {
  return supabase.from('clearance_queue')
    .select('*, student:students(*), profile:profiles!clearance_queue_officer_id_fkey(name)')
    .eq('officer_id', officerId);
}

export async function assignToQueue(officerId: string, studentId: string) {
  return supabase.from('clearance_queue').insert({
    officer_id: officerId,
    student_id: studentId,
  });
}

// ─── Activity Logs (HOD) ────────────────────────────
export async function getActivityLogs(limit = 50) {
  return supabase.from('activity_logs')
    .select('*, profile:profiles(name)')
    .order('created_at', { ascending: false })
    .limit(limit);
}

export async function logActivity(
  officerId: string,
  action: string,
  targetStudent: string
) {
  return supabase.from('activity_logs').insert({
    officer_id: officerId,
    action,
    target_student: targetStudent,
  });
}

// ─── Notifications ──────────────────────────────────
export async function getNotifications(userId: string) {
  return supabase.from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
}

export async function markNotifRead(notifId: string) {
  return supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
}

export async function markAllNotifRead(userId: string) {
  return supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
}

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type = 'info'
) {
  return supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
  });
}

// ─── Officers (HOD) ─────────────────────────────────
export async function getOfficers() {
  return supabase.from('profiles')
    .select('*')
    .eq('role', 'officer')
    .order('name');
}

export async function addOfficer(name: string, email: string) {
  const pwd = `temp${Date.now()}`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: pwd,
    email_confirm: true,
  });
  if (error || !data.user) return { error };
  return supabase.from('profiles').insert({
    id: data.user.id,
    name,
    email,
    role: 'officer' as UserRole,
  });
}

export async function toggleOfficerActive(officerId: string, active: boolean) {
  return supabase.from('profiles').update({ active }).eq('id', officerId);
}

export async function removeOfficer(officerId: string) {
  return supabase.auth.admin.deleteUser(officerId);
}

// ─── Password Reset ──────────────────────────────────
export function getPasswordResetUrl() {
  return `${window.location.origin}/#/reset-password`;
}

export async function resetPassword(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordResetUrl(),
  });
}

export async function changePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (!error && data.user) {
    await supabase.auth.updateUser({
      data: { password_change_required: false },
    });
  }
  return { data, error };
}
