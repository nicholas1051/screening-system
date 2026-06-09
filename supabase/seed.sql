-- UniAbuja Screening System - Seed Data
-- Run this AFTER: schema.sql (once) + cleanup.sql (if re-seeding) + npm run setup
-- Safe to run multiple times (all inserts use ON CONFLICT / DO NOTHING)

-- Ensure the email lookup function exists (also defined in schema.sql)
CREATE OR REPLACE FUNCTION get_email_by_reg_no(reg TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result TEXT;
BEGIN
  SELECT p.email INTO result
  FROM students s JOIN profiles p ON p.id = s.user_id
  WHERE s.reg_no = reg LIMIT 1;
  RETURN result;
END;
$$;

-- ─── Documents (unique on name) ──────────────────────────────
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
  ('Passport Photograph', 14)
ON CONFLICT (name) DO NOTHING;

-- ─── Students (unique on reg_no) ─────────────────────────────
INSERT INTO students (id, user_id, reg_no, admission_type, course, session, jamb_no, status) VALUES
  ('b0000000-0000-0000-0000-000000000001', (SELECT id FROM profiles WHERE email = 'student@uniabuja.edu.ng'), '2023/123456AB', 'UTME', 'Computer Science', '2023/2024', 'JAMB-987654321', 'pending'::student_status),
  ('b0000000-0000-0000-0000-000000000002', NULL, '2023/998877XY', 'UTME', 'Computer Science', '2023/2024', NULL, 'pending'::student_status),
  ('b0000000-0000-0000-0000-000000000003', NULL, '2023/554433ZZ', 'DE', 'Computer Science', '2023/2024', NULL, 'pending'::student_status),
  ('b0000000-0000-0000-0000-000000000004', NULL, '2023/112233WW', 'UTME', 'Computer Science', '2023/2024', NULL, 'queried'::student_status),
  ('b0000000-0000-0000-0000-000000000005', NULL, '2023/445566AA', 'UTME', 'Computer Science', '2023/2024', NULL, 'pending'::student_status),
  ('b0000000-0000-0000-0000-000000000006', NULL, '2023/778899BB', 'DE', 'Computer Science', '2023/2024', NULL, 'cleared'::student_status),
  ('b0000000-0000-0000-0000-000000000007', NULL, '2023/334455CC', 'UTME', 'Computer Science', '2023/2024', NULL, 'pending'::student_status),
  ('b0000000-0000-0000-0000-000000000008', NULL, '2023/667788DD', 'DE', 'Computer Science', '2023/2024', NULL, 'queried'::student_status)
ON CONFLICT (reg_no) DO NOTHING;

-- ─── Student Documents (name-based join, avoids hardcoded IDs) ──
-- Student #1 (Oluwaseun Adeyemi - pending)
INSERT INTO student_documents (student_id, document_id, status, queried_reason)
SELECT s.id, d.id, sd.status::doc_status, sd.reason
FROM (VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Drug Test Result',             'pending',  NULL),
  ('b0000000-0000-0000-0000-000000000001', 'Admission Notification/Letter', 'verified', NULL),
  ('b0000000-0000-0000-0000-000000000001', 'Primary School Certificate',   'pending',  NULL),
  ('b0000000-0000-0000-0000-000000000001', 'SSCE Result',                  'verified', NULL),
  ('b0000000-0000-0000-0000-000000000001', 'JAMB Result Slip / JAMB Score', 'verified', NULL),
  ('b0000000-0000-0000-0000-000000000001', 'Post UTME Score',              'pending',  NULL),
  ('b0000000-0000-0000-0000-000000000001', 'Birth Certificate',            'issues',   'Name mismatch - upload a clearer copy with your full legal name as on JAMB record'),
  ('b0000000-0000-0000-0000-000000000001', 'Indigene Letter',              'pending',  NULL),
  ('b0000000-0000-0000-0000-000000000001', 'Letter of Undertaking',        'verified', NULL),
  ('b0000000-0000-0000-0000-000000000001', 'JAMB Reg Slip',                'verified', NULL),
  ('b0000000-0000-0000-0000-000000000001', 'Acceptance Fee Receipt',       'verified', NULL),
  ('b0000000-0000-0000-0000-000000000001', 'Screening Fee Receipt',        'verified', NULL),
  ('b0000000-0000-0000-0000-000000000001', 'Scratch Card',                 'pending',  NULL),
  ('b0000000-0000-0000-0000-000000000001', 'Passport Photograph',          'verified', NULL)
) AS sd(student_uuid, doc_name, status, reason)
JOIN students s ON s.id = sd.student_uuid::uuid
JOIN documents d ON d.name = sd.doc_name
ON CONFLICT (student_id, document_id) DO NOTHING;

-- Student #4 (Okonkwo, Emeka - queried)
INSERT INTO student_documents (student_id, document_id, status, queried_reason)
SELECT s.id, d.id, sd.status::doc_status, sd.reason
FROM (VALUES
  ('b0000000-0000-0000-0000-000000000004', 'Drug Test Result',             'issues',   'Blurry upload - please re-upload a clear scan'),
  ('b0000000-0000-0000-0000-000000000004', 'Admission Notification/Letter', 'verified', NULL),
  ('b0000000-0000-0000-0000-000000000004', 'Primary School Certificate',   'verified', NULL),
  ('b0000000-0000-0000-0000-000000000004', 'SSCE Result',                  'pending',  NULL),
  ('b0000000-0000-0000-0000-000000000004', 'JAMB Result Slip / JAMB Score', 'pending', NULL),
  ('b0000000-0000-0000-0000-000000000004', 'Post UTME Score',              'verified', NULL),
  ('b0000000-0000-0000-0000-000000000004', 'Birth Certificate',            'verified', NULL),
  ('b0000000-0000-0000-0000-000000000004', 'Indigene Letter',              'pending',  NULL),
  ('b0000000-0000-0000-0000-000000000004', 'Letter of Undertaking',        'pending',  NULL),
  ('b0000000-0000-0000-0000-000000000004', 'JAMB Reg Slip',                'pending',  NULL),
  ('b0000000-0000-0000-0000-000000000004', 'Acceptance Fee Receipt',       'pending',  NULL),
  ('b0000000-0000-0000-0000-000000000004', 'Screening Fee Receipt',        'pending',  NULL),
  ('b0000000-0000-0000-0000-000000000004', 'Scratch Card',                 'pending',  NULL),
  ('b0000000-0000-0000-0000-000000000004', 'Passport Photograph',          'pending',  NULL)
) AS sd(student_uuid, doc_name, status, reason)
JOIN students s ON s.id = sd.student_uuid::uuid
JOIN documents d ON d.name = sd.doc_name
ON CONFLICT (student_id, document_id) DO NOTHING;

-- Student #6 (Musa, Amina - cleared)
INSERT INTO student_documents (student_id, document_id, status, queried_reason)
SELECT s.id, d.id, sd.status::doc_status, sd.reason
FROM (VALUES
  ('b0000000-0000-0000-0000-000000000006', 'Drug Test Result',             'verified', NULL),
  ('b0000000-0000-0000-0000-000000000006', 'Admission Notification/Letter', 'verified', NULL),
  ('b0000000-0000-0000-0000-000000000006', 'Primary School Certificate',   'verified', NULL),
  ('b0000000-0000-0000-0000-000000000006', 'SSCE Result',                  'verified', NULL),
  ('b0000000-0000-0000-0000-000000000006', 'JAMB Result Slip / JAMB Score', 'verified', NULL),
  ('b0000000-0000-0000-0000-000000000006', 'Post UTME Score',              'verified', NULL),
  ('b0000000-0000-0000-0000-000000000006', 'Birth Certificate',            'verified', NULL),
  ('b0000000-0000-0000-0000-000000000006', 'Indigene Letter',              'verified', NULL),
  ('b0000000-0000-0000-0000-000000000006', 'Letter of Undertaking',        'verified', NULL),
  ('b0000000-0000-0000-0000-000000000006', 'JAMB Reg Slip',                'verified', NULL),
  ('b0000000-0000-0000-0000-000000000006', 'Acceptance Fee Receipt',       'verified', NULL),
  ('b0000000-0000-0000-0000-000000000006', 'Screening Fee Receipt',        'verified', NULL),
  ('b0000000-0000-0000-0000-000000000006', 'Scratch Card',                 'verified', NULL),
  ('b0000000-0000-0000-0000-000000000006', 'Passport Photograph',          'verified', NULL)
) AS sd(student_uuid, doc_name, status, reason)
JOIN students s ON s.id = sd.student_uuid::uuid
JOIN documents d ON d.name = sd.doc_name
ON CONFLICT (student_id, document_id) DO NOTHING;

-- Student #8 (Yakubu, Grace - queried)
INSERT INTO student_documents (student_id, document_id, status, queried_reason)
SELECT s.id, d.id, sd.status::doc_status, sd.reason
FROM (VALUES
  ('b0000000-0000-0000-0000-000000000008', 'Drug Test Result',             'verified', NULL),
  ('b0000000-0000-0000-0000-000000000008', 'Admission Notification/Letter', 'verified', NULL),
  ('b0000000-0000-0000-0000-000000000008', 'Primary School Certificate',   'verified', NULL),
  ('b0000000-0000-0000-0000-000000000008', 'SSCE Result',                  'verified', NULL),
  ('b0000000-0000-0000-0000-000000000008', 'JAMB Result Slip / JAMB Score', 'verified', NULL),
  ('b0000000-0000-0000-0000-000000000008', 'Post UTME Score',              'verified', NULL),
  ('b0000000-0000-0000-0000-000000000008', 'Birth Certificate',            'issues',   'Birth Certificate - name mismatch with JAMB record'),
  ('b0000000-0000-0000-0000-000000000008', 'Indigene Letter',              'pending',  NULL),
  ('b0000000-0000-0000-0000-000000000008', 'Letter of Undertaking',        'pending',  NULL),
  ('b0000000-0000-0000-0000-000000000008', 'JAMB Reg Slip',                'pending',  NULL),
  ('b0000000-0000-0000-0000-000000000008', 'Acceptance Fee Receipt',       'pending',  NULL),
  ('b0000000-0000-0000-0000-000000000008', 'Screening Fee Receipt',        'pending',  NULL),
  ('b0000000-0000-0000-0000-000000000008', 'Scratch Card',                 'pending',  NULL),
  ('b0000000-0000-0000-0000-000000000008', 'Passport Photograph',          'pending',  NULL)
) AS sd(student_uuid, doc_name, status, reason)
JOIN students s ON s.id = sd.student_uuid::uuid
JOIN documents d ON d.name = sd.doc_name
ON CONFLICT (student_id, document_id) DO NOTHING;

-- ─── Clearance Queue (unique on officer_id + student_id) ─────
INSERT INTO clearance_queue (officer_id, student_id)
SELECT (SELECT id FROM profiles WHERE email = 'adebayo@uniabuja.edu.ng'), s.id
FROM students s
WHERE s.user_id IS NULL OR s.id != 'b0000000-0000-0000-0000-000000000001'
ON CONFLICT (officer_id, student_id) DO NOTHING;

-- ─── Activity Logs ───────────────────────────────────────────
INSERT INTO activity_logs (officer_id, action, target_student, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM profiles WHERE email = 'adebayo@uniabuja.edu.ng'), 'Approved', 'Okafor, Chinedu', NOW() - INTERVAL '12 minutes'),
  ((SELECT id FROM profiles WHERE email = 'okafor@uniabuja.edu.ng'), 'Queried', 'Bello, Fatima', NOW() - INTERVAL '35 minutes'),
  ((SELECT id FROM profiles WHERE email = 'adebayo@uniabuja.edu.ng'), 'Cleared', 'Musa, Amina', NOW() - INTERVAL '1 hour'),
  ((SELECT id FROM profiles WHERE email = 'ezeh@uniabuja.edu.ng'), 'Queried', 'Okonkwo, Emeka', NOW() - INTERVAL '2 hours'),
  ((SELECT id FROM profiles WHERE email = 'adebayo@uniabuja.edu.ng'), 'Approved', 'Adebayo, Tolu', NOW() - INTERVAL '3 hours'),
  ((SELECT id FROM profiles WHERE email = 'okafor@uniabuja.edu.ng'), 'Approved', 'Eze, Ifeanyi', NOW() - INTERVAL '4 hours'),
  ((SELECT id FROM profiles WHERE email = 'adebayo@uniabuja.edu.ng'), 'Cleared', 'Yakubu, Grace', NOW() - INTERVAL '5 hours'),
  ((SELECT id FROM profiles WHERE email = 'ezeh@uniabuja.edu.ng'), 'Queried', 'Nwachukwu, David', NOW() - INTERVAL '6 hours'),
  ((SELECT id FROM profiles WHERE email = 'okafor@uniabuja.edu.ng'), 'Approved', 'Umar, Sadiq', NOW() - INTERVAL '7 hours'),
  ((SELECT id FROM profiles WHERE email = 'adebayo@uniabuja.edu.ng'), 'Queried', 'Ibrahim, Aisha', NOW() - INTERVAL '8 hours'),
  ((SELECT id FROM profiles WHERE email = 'ezeh@uniabuja.edu.ng'), 'Approved', 'Olawale, Femi', NOW() - INTERVAL '9 hours'),
  ((SELECT id FROM profiles WHERE email = 'okafor@uniabuja.edu.ng'), 'Cleared', 'Ugwu, Nkechi', NOW() - INTERVAL '10 hours'),
  ((SELECT id FROM profiles WHERE email = 'adebayo@uniabuja.edu.ng'), 'Approved', 'Aliyu, Hassan', NOW() - INTERVAL '11 hours'),
  ((SELECT id FROM profiles WHERE email = 'ezeh@uniabuja.edu.ng'), 'Queried', 'Okpara, Chiamaka', NOW() - INTERVAL '12 hours'),
  ((SELECT id FROM profiles WHERE email = 'okafor@uniabuja.edu.ng'), 'Approved', 'Suleiman, Fatima', NOW() - INTERVAL '13 hours'),
  ((SELECT id FROM profiles WHERE email = 'adebayo@uniabuja.edu.ng'), 'Approved', 'Bala, Solomon', NOW() - INTERVAL '14 hours'),
  ((SELECT id FROM profiles WHERE email = 'ezeh@uniabuja.edu.ng'), 'Approved', 'Danladi, Peter', NOW() - INTERVAL '15 hours'),
  ((SELECT id FROM profiles WHERE email = 'okafor@uniabuja.edu.ng'), 'Queried', 'Kalu, Kelechi', NOW() - INTERVAL '16 hours'),
  ((SELECT id FROM profiles WHERE email = 'adebayo@uniabuja.edu.ng'), 'Cleared', 'Nnamdi, Chisom', NOW() - INTERVAL '17 hours'),
  ((SELECT id FROM profiles WHERE email = 'ezeh@uniabuja.edu.ng'), 'Approved', 'Adamu, Zainab', NOW() - INTERVAL '18 hours')
) AS t
WHERE NOT EXISTS (
  SELECT 1 FROM activity_logs
  WHERE activity_logs.target_student = t.column3 AND activity_logs.created_at = t.column4
);

-- ─── Notifications: Student ──────────────────────────────────
INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM profiles WHERE email = 'student@uniabuja.edu.ng'), 'Document Approved', 'Your SSCE Result has been approved.', 'approval', true, NOW() - INTERVAL '1 hour'),
  ((SELECT id FROM profiles WHERE email = 'student@uniabuja.edu.ng'), 'Document Queried', 'Birth Certificate: Name mismatch - upload a clearer copy.', 'query', false, NOW() - INTERVAL '3 hours'),
  ((SELECT id FROM profiles WHERE email = 'student@uniabuja.edu.ng'), 'Document Approved', 'Your Admission Notification/Letter has been approved.', 'approval', true, NOW() - INTERVAL '5 hours'),
  ((SELECT id FROM profiles WHERE email = 'student@uniabuja.edu.ng'), 'Screening Progress', 'You have 12 approved documents out of 14.', 'milestone', false, NOW() - INTERVAL '1 day')
) AS t
WHERE NOT EXISTS (
  SELECT 1 FROM notifications
  WHERE notifications.user_id = t.column1 AND notifications.title = t.column2
);

-- ─── Notifications: Officer (Dr. Adebayo) ────────────────────
INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM profiles WHERE email = 'adebayo@uniabuja.edu.ng'), 'New Student Added', 'Nwachukwu, David has been added to your clearance queue.', 'queue', false, NOW() - INTERVAL '2 hours'),
  ((SELECT id FROM profiles WHERE email = 'adebayo@uniabuja.edu.ng'), 'Query Response Received', 'Okonkwo, Emeka has re-uploaded SSCE Result for review.', 'response', true, NOW() - INTERVAL '4 hours'),
  ((SELECT id FROM profiles WHERE email = 'adebayo@uniabuja.edu.ng'), 'HOD Announcement', 'All pending DE clearances must be resolved by Friday.', 'announcement', false, NOW() - INTERVAL '6 hours')
) AS t
WHERE NOT EXISTS (
  SELECT 1 FROM notifications
  WHERE notifications.user_id = t.column1 AND notifications.title = t.column2
);

-- ─── Notifications: HOD ──────────────────────────────────────
INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM profiles WHERE email = 'hod@uniabuja.edu.ng'), 'Query Response Received', 'Okonkwo, Emeka has re-uploaded SSCE Result.', 'response', false, NOW() - INTERVAL '5 minutes'),
  ((SELECT id FROM profiles WHERE email = 'hod@uniabuja.edu.ng'), 'Bulk Upload Complete', 'Admission list for 45 new DE students processed.', 'upload', true, NOW() - INTERVAL '1 hour'),
  ((SELECT id FROM profiles WHERE email = 'hod@uniabuja.edu.ng'), 'Clearance Milestone', '210 students fully cleared -- 46.7% clearance rate.', 'milestone', false, NOW() - INTERVAL '3 hours'),
  ((SELECT id FROM profiles WHERE email = 'hod@uniabuja.edu.ng'), 'Officer Activity Alert', 'Dr. Adebayo approved 12 documents in the last hour.', 'activity', true, NOW() - INTERVAL '5 hours')
) AS t
WHERE NOT EXISTS (
  SELECT 1 FROM notifications
  WHERE notifications.user_id = t.column1 AND notifications.title = t.column2
);
