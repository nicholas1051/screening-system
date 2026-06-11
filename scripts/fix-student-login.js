import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

const __dirname = dirname(fileURLToPath(import.meta.url));

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

  // Get all student records
  const { data: students } = await supabase.from('students').select('*');
  if (!students) { console.log('No students found'); return; }

  console.log(`Found ${students.length} student records\n`);

  for (const s of students) {
    // Remove broken FK reference first so we can delete stale auth users
    await supabase.from('students').update({ user_id: null }).eq('id', s.id);

    // Try to find existing auth user by email
    const { data: users } = await supabase.auth.admin.listUsers();
    let existingUser = users?.users?.find(u => u.email === s.email);

    if (existingUser) {
      console.log(`${s.reg_no}: auth user exists (${s.email})`);
      // Update password to demo123
      await supabase.auth.admin.updateUserById(existingUser.id, { password: 'demo123' });
      // Make sure student record links to this user
      if (s.user_id !== existingUser.id) {
        await supabase.from('students').update({ user_id: existingUser.id }).eq('id', s.id);
      }
      console.log(`  -> password reset to demo123`);
    } else {
      console.log(`${s.reg_no}: creating auth user for ${s.email}`);
      const { data, error } = await supabase.auth.admin.createUser({
        email: s.email,
        password: 'demo123',
        email_confirm: true,
      });
      if (error) { console.log(`  -> FAILED: ${error.message}`); continue; }
      if (data?.user?.id) {
        await supabase.from('students').update({ user_id: data.user.id }).eq('id', s.id);
        console.log(`  -> created with password demo123`);
      }
    }
  }

  // Demo student
  const demoEmail = 'student@uniabuja.edu.ng';
  const { data: users2 } = await supabase.auth.admin.listUsers();
  const demoUser = users2?.users?.find(u => u.email === demoEmail);
  if (demoUser) {
    await supabase.auth.admin.updateUserById(demoUser.id, { password: 'demo123' });
    console.log(`\nDemo student password reset to demo123`);
  }

  console.log('\nDone. Try logging in now.');
}

main().catch(e => console.error('Fatal:', e));
