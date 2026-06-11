-- UniAbuja Screening System - Supabase Schema

-- ENUMS
CREATE TYPE user_role AS ENUM ('student', 'officer', 'hod');
CREATE TYPE doc_status AS ENUM ('pending', 'verified', 'issues');
CREATE TYPE student_status AS ENUM ('pending', 'queried', 'cleared');

-- PROFILES (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- STUDENTS
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  reg_no TEXT UNIQUE NOT NULL,
  admission_type TEXT NOT NULL CHECK (admission_type IN ('UTME', 'DE')),
  course TEXT NOT NULL DEFAULT 'Computer Science',
  session TEXT NOT NULL DEFAULT '2023/2024',
  jamb_no TEXT,
  status student_status NOT NULL DEFAULT 'pending',
  passport_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DOCUMENTS (master list)
CREATE TABLE documents (
  id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL UNIQUE,
  required BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);

-- Insert default document types
INSERT INTO documents (name, sort_order) VALUES
  ('Drug Test Result', 1),
  ('Admission Notification/Letter', 2),
  ('Primary School Certificate', 3),
  ('SSCE Result', 4),
  ('JAMB Result Slip / JAMB Score', 5),
  ('Post UTME Score', 6),
  ('Birth Certificate', 7),
  ('Indigene Letter', 8),
  ('Letter of Undertaking', 9),
  ('JAMB Reg Slip', 10),
  ('Acceptance Fee Receipt', 11),
  ('Screening Fee Receipt', 12),
  ('Scratch Card', 13),
  ('Passport Photograph', 14);

-- STUDENT DOCUMENTS
CREATE TABLE student_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  document_id INT NOT NULL REFERENCES documents(id),
  status doc_status NOT NULL DEFAULT 'pending',
  queried_reason TEXT,
  file_url TEXT,
  uploaded_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, document_id)
);

-- QUEUE (officer clearance queue)
CREATE TABLE clearance_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(officer_id, student_id)
);

-- ACTIVITY LOGS
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  target_student TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTIFICATIONS
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INDEXES
CREATE INDEX idx_students_reg_no ON students(reg_no);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_student_documents_student ON student_documents(student_id);
CREATE INDEX idx_student_documents_status ON student_documents(status);
CREATE INDEX idx_clearance_queue_officer ON clearance_queue(officer_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);

-- ROW LEVEL SECURITY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE clearance_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ACTIVITY LOGS RLS
DROP POLICY IF EXISTS "Officers and HOD can view activity logs" ON activity_logs;
CREATE POLICY "Officers and HOD can view activity logs"
  ON activity_logs FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('officer', 'hod')
  );

DROP POLICY IF EXISTS "Authenticated can insert activity logs" ON activity_logs;
CREATE POLICY "Authenticated can insert activity logs"
  ON activity_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- BASIC RLS POLICIES
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Officers and HOD can view all profiles"
  ON profiles FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('officer', 'hod')
  );

CREATE POLICY "Students can view own record"
  ON students FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Officers and HOD can view all students"
  ON students FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('officer', 'hod')
  );

CREATE POLICY "Students can view own documents"
  ON student_documents FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

CREATE POLICY "Officers and HOD can view all documents"
  ON student_documents FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('officer', 'hod')
  );

DROP POLICY IF EXISTS "Officers and HOD can update documents" ON student_documents;
CREATE POLICY "Officers and HOD can update documents"
  ON student_documents FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('officer', 'hod')
  );

DROP POLICY IF EXISTS "Officers and HOD can view queue" ON clearance_queue;
CREATE POLICY "Officers and HOD can view queue"
  ON clearance_queue FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('officer', 'hod')
  );

DROP POLICY IF EXISTS "Officers and HOD can claim students" ON clearance_queue;
CREATE POLICY "Officers and HOD can claim students"
  ON clearance_queue FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('officer', 'hod')
  );

DROP POLICY IF EXISTS "Authenticated can insert notifications" ON notifications;
CREATE POLICY "Authenticated can insert notifications"
  ON notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Officers and HOD can view all notifications" ON notifications;
CREATE POLICY "Officers and HOD can view all notifications"
  ON notifications FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('officer', 'hod')
  );

-- Function: look up a student's auth email by registration number
-- Used for student login (students log in with reg_no + password)
CREATE OR REPLACE FUNCTION get_email_by_reg_no(reg TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT p.email INTO result
  FROM students s
  JOIN profiles p ON p.id = s.user_id
  WHERE s.reg_no = reg
  LIMIT 1;
  RETURN result;
END;
$$;

-- Function: create a notification (bypasses stale schema cache via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO notifications (user_id, title, message, type, is_read)
  VALUES (p_user_id, p_title, p_message, p_type, false)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- Functions: mark a notification as read
CREATE OR REPLACE FUNCTION mark_notif_read(p_notif_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications SET is_read = true WHERE id = p_notif_id;
END;
$$;

CREATE OR REPLACE FUNCTION mark_all_notif_read(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications SET is_read = true WHERE user_id = p_user_id;
END;
$$;

-- Function: log an activity (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION log_activity(
  p_officer_id UUID,
  p_action TEXT,
  p_target_student TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO activity_logs (officer_id, action, target_student)
  VALUES (p_officer_id, p_action, p_target_student);
END;
$$;

-- Function: get recent activity logs (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_activity_logs(p_limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  officer_id UUID,
  action TEXT,
  target_student TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.officer_id, a.action, a.target_student, a.created_at
  FROM activity_logs a
  ORDER BY a.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Function: get activity logs for a specific student (bypasses RLS)
CREATE OR REPLACE FUNCTION get_student_activity_logs(p_student_name TEXT, p_limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  officer_id UUID,
  action TEXT,
  target_student TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.officer_id, a.action, a.target_student, a.created_at
  FROM activity_logs a
  WHERE a.target_student = p_student_name
  ORDER BY a.created_at DESC
  LIMIT p_limit;
END;
$$;
