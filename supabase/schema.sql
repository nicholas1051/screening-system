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

-- BASIC RLS POLICIES
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Officers and HOD can view all profiles"
  ON profiles FOR SELECT USING (
    auth.jwt() -> 'user_metadata' ->> 'role' IN ('officer', 'hod')
  );

CREATE POLICY "Students can view own record"
  ON students FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Officers and HOD can view all students"
  ON students FOR SELECT USING (
    auth.jwt() -> 'user_metadata' ->> 'role' IN ('officer', 'hod')
  );

CREATE POLICY "Students can view own documents"
  ON student_documents FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

CREATE POLICY "Officers and HOD can view all documents"
  ON student_documents FOR SELECT USING (
    auth.jwt() -> 'user_metadata' ->> 'role' IN ('officer', 'hod')
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
