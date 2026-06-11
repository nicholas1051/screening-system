import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

const URL = 'https://hgodwqnzyiskjhtqimkm.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb2R3cW56eWlza2podHFpbWttIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTA3MzAxNywiZXhwIjoyMDk2NjQ5MDE3fQ.CMquNnUw8jyPD7gkV1WvTYHbXZsVkOUjh_fg46MZy0s';

const admin = createClient(URL, KEY, { auth: { persistSession: false } });

// Check clearance_queue
const { data: queue, error: qe } = await admin.from('clearance_queue').select('*');
console.log('Queue:', queue?.length || 0, qe?.message || '');

// Check officers
const { data: officers } = await admin.from('profiles').select('id, name, role').eq('role', 'officer');
console.log('Officers:', officers?.map(o => ({ name: o.name, id: o.id })) || 'none');

// Check students without queue assignment
const { data: students } = await admin.from('students').select('id, reg_no, name');
if (students) {
  const queued = new Set((queue || []).map(q => q.student_id));
  const unqueued = students.filter(s => !queued.has(s.id));
  console.log(`Students total: ${students.length}, queued: ${queued.size}, unqueued: ${unqueued.length}`);
}

// Check if admin can read queue as an officer would
const { data: { session } } = await admin.auth.signInWithPassword({
  email: 'officer1@uniabuja.edu.ng', password: 'officer123'
});
if (session) {
  const supabase = createClient(URL, KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: 'Bearer ' + session.access_token } }
  });
  const { data: q2, error: qe2 } = await supabase.from('clearance_queue').select('*');
  console.log(`\nAs officer1: queue=${q2?.length || 0}`, qe2?.message || '');
}
process.exit(0);
