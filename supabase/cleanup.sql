-- Clean up old seed data with hardcoded UUIDs so the setup script can create proper profiles
-- Run this in the Supabase SQL Editor BEFORE re-running `npm run setup`

DELETE FROM notifications;
DELETE FROM activity_logs;
DELETE FROM clearance_queue;
DELETE FROM student_documents;
DELETE FROM students;
DELETE FROM profiles WHERE email IN (
  'student@uniabuja.edu.ng',
  'adebayo@uniabuja.edu.ng',
  'okafor@uniabuja.edu.ng',
  'ezeh@uniabuja.edu.ng',
  'hod@uniabuja.edu.ng'
);
