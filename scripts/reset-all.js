import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

const __dirname = dirname(fileURLToPath(import.meta.url));

const USERS = [
  { email: 'student@uniabuja.edu.ng', password: 'demo123', name: 'Oluwaseun Adeyemi', role: 'student' },
  { email: 'adebayo@uniabuja.edu.ng',   password: 'demo123', name: 'Dr. Adebayo',      role: 'officer' },
  { email: 'okafor@uniabuja.edu.ng',    password: 'demo123', name: 'Mrs. Okafor',       role: 'officer' },
  { email: 'ezeh@uniabuja.edu.ng',      password: 'demo123', name: 'Mr. Ezeh',          role: 'officer' },
  { email: 'hod@uniabuja.edu.ng',       password: 'demo123', name: 'Prof. Abdullahi',   role: 'hod'    },
];

async function prompt(q) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => { rl.close(); res(a.trim()); }));
}

async function main() {
  const envPath = resolve(__dirname, '..', '.env');
  let url = '', key = '';

  if (existsSync(envPath)) {
    const env = readFileSync(envPath, 'utf-8');
    for (const line of env.split('\n')) {
      const t = line.trim();
      if (t.startsWith('VITE_SUPABASE_URL=')) url = t.split('=').slice(1).join('=');
      if (t.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = t.split('=').slice(1).join('=');
    }
  }

  if (!url) url = await prompt('Supabase URL: ');
  if (!key) key = await prompt('Supabase service_role key: ');

  const supabase = createClient(url, key);

  // 1. Wipe data tables
  console.log('Wiping data...');
  for (const table of ['student_documents', 'clearance_queue', 'activity_logs', 'notifications', 'students', 'profiles']) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error && !error.message.includes('violates')) console.log(`  ${table}: ${error.message}`);
    else console.log(`  ${table}: cleared`);
  }

  // 2. List and delete existing auth users
  console.log('\nCleaning auth users...');
  const { data: list } = await supabase.auth.admin.listUsers();
  const existingEmails = (list?.users || []).map(u => u.email);
  console.log('  Existing emails:', existingEmails.join(', ') || 'none');

  for (const u of list?.users || []) {
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) console.log(`  Failed to delete ${u.email}: ${error.message}`);
    else console.log(`  Deleted ${u.email}`);
  }

  // 3. Create fresh users
  console.log('\nCreating fresh users...');
  for (const user of USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { name: user.name, role: user.role },
    });
    if (error) { console.error(`  ${user.email}: ${error.message}`); continue; }
    const userId = data?.user?.id;
    if (!userId) { console.error(`  ${user.email}: no user id`); continue; }
      const { error: pe } = await supabase.from('profiles').upsert({
        id: userId, name: user.name, email: user.email, role: user.role, active: true,
      }, { onConflict: 'id' });
    if (pe) console.error(`  ${user.email}: profile error: ${pe.message}`);
    else console.log(`  ${user.email} (${user.role}) => created`);
  }

  // 4. Verify
  const { data: profs } = await supabase.from('profiles').select('email,role');
  console.log('\n--- Verification ---');
  console.log('Profiles:', profs?.length || 0);
  for (const p of profs || []) console.log(`  ${p.email} (${p.role})`);

  console.log('\n=== Done ===');
  console.log('Login with:');
  console.log('  HOD:      hod@uniabuja.edu.ng / demo123');
  console.log('  Officers: adebayo@uniabuja.edu.ng / demo123');
  console.log('           okafor@uniabuja.edu.ng / demo123');
  console.log('           ezeh@uniabuja.edu.ng / demo123');
  console.log('  Student:  Uses reg_no 202630123456AB / demo123');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
