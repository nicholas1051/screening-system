-- Migration: Replace 10 old document types with 14 new ones
-- Run this in the Supabase SQL Editor

BEGIN;

-- 1. Remove student_documents that reference old document IDs
DELETE FROM student_documents;

-- 2. Remove all old document types
DELETE FROM documents;

-- 3. Reset the identity sequence so new IDs start at 1
ALTER TABLE documents ALTER COLUMN id RESTART WITH 1;

-- 4. Insert the new 14 documents
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

-- 5. Re-insert student_documents for seeded students (name-based join)
-- Student #1 (Oluwaseun Adeyemi - user_id linked to student@uniabuja.edu.ng)
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

COMMIT;
