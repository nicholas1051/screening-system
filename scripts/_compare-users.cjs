import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

const SUPABASE_URL = 'https://hgodwqnzyiskjhtqimkm.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb2R3cW56eWlza2podHFpbWttIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTA3MzAxNywiZXhwIjoyMDk2NjQ5MDE3fQ.CMquNnUw8jyPD7gkV1WvTYHbXZsVkOUjh_fg46MZy0s';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

(async () => {
  // Compare all columns between working and newly created user
  const testRes = await admin.auth.signInWithPassword({
    email: 'student@uniabuja.edu.ng',
    password: 'demo123'
  });
  const workingId = testRes.data.user.id;
  
  // Create a test user via admin API for comparison
  const testEmail = 'compare-' + Date.now() + '@test.com';
  const cr = await admin.auth.admin.createUser({
    email: testEmail,
    password: 'test123',
    email_confirm: true,
    user_metadata: { name: 'Compare User', role: 'student' }
  });
  
  if (cr.error) { console.error('create:', cr.error.message); process.exit(1); }
  const newId = cr.data.user.id;
  
  // Fetch both full records via their sessions
  const wData = testRes.data;
  const nData = cr.data;
  
  // Compare key fields
  console.log('Working user fields:');
  console.log('  id:', wData.user.id);
  console.log('  email:', wData.user.email);
  console.log('  role:', wData.user.role);
  console.log('  app_metadata:', JSON.stringify(wData.user.app_metadata));
  console.log('  user_metadata:', JSON.stringify(wData.user.user_metadata));
  console.log('  created_at:', wData.user.created_at);
  console.log('  confirmed_at:', (wData.user).confirmed_at);
  console.log('  email_confirmed_at:', wData.user.email_confirmed_at);
  console.log('  phone:', wData.user.phone);
  console.log('  identities:', wData.user.identities?.length);
  
  console.log('\nNewly created (admin API) fields:');
  console.log('  id:', nData.user.id);
  console.log('  email:', nData.user.email);
  console.log('  role:', nData.user.role);
  console.log('  app_metadata:', JSON.stringify(nData.user.app_metadata));
  console.log('  user_metadata:', JSON.stringify(nData.user.user_metadata));
  console.log('  created_at:', nData.user.created_at);
  console.log('  confirmed_at:', (nData.user).confirmed_at);
  console.log('  email_confirmed_at:', nData.user.email_confirmed_at);
  console.log('  phone:', nData.user.phone);
  console.log('  identities:', nData.user.identities?.length);
  
  // Cleanup test user
  await admin.auth.admin.deleteUser(newId);
  console.log('\nDone');
  process.exit(0);
})();
