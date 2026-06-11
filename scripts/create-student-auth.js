import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

const __dirname = dirname(fileURLToPath(import.meta.url));

async function prompt(query) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, answer => { rl.close(); resolve(answer.trim()); }));
}

async function main() {
  const envPath = resolve(__dirname, '..', '.env');
  let supabaseUrl = '';
  let serviceRoleKey = '';

  if (existsSync(envPath)) {
    const env = readFileSync(envPath, 'utf-8');
    for (const line of env.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = trimmed.split('=').slice(1).join('=');
      if (trimmed.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) serviceRoleKey = trimmed.split('=').slice(1).join('=');
    }
  }

  if (!supabaseUrl) supabaseUrl = await prompt('Supabase URL: ');
  if (!serviceRoleKey) serviceRoleKey = await prompt('Service role key: ');

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // Get students without auth accounts (no user_id or no profile)
  const { data: students, error: se } = await supabase.from('students').select('*');
  if (se) { console.error('Error fetching students:', se.message); return; }

  let created = 0, skipped = 0, errors = 0;

  for (const s of students) {
    // Check if this student already has a working auth account
    if (s.user_id) {
      const { error: pe } = await supabase.from('profiles').select('id').eq('id', s.user_id).maybeSingle();
      if (!pe) {
        skipped++;
        continue;
      }
    }

    const password = 'student123';

    // Create auth user via admin API (this creates proper GoTrue-compatible records)
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: s.email,
      password,
      email_confirm: true,
      user_metadata: { name: s.name, role: 'student', password_change_required: true }
    });

    if (authErr) {
      console.error(`  ${s.reg_no} ${s.email}: AUTH FAIL - ${authErr.message}`);
      errors++;
      continue;
    }

    const userId = authData.user.id;

    // Link student record
    const { error: ue } = await supabase.from('students').update({ user_id: userId }).eq('id', s.id);
    if (ue) console.error(`  ${s.reg_no}: update student fail - ${ue.message}`);

    // Create profile
    const { error: pe } = await supabase.from('profiles').upsert({
      id: userId,
      name: s.name,
      email: s.email,
      role: 'student',
      active: true
    }, { onConflict: 'id' });
    if (pe) console.error(`  ${s.reg_no}: profile fail - ${pe.message}`);

    console.log(`  ${s.reg_no} ${s.name}: CREATED (password: ${password})`);
    created++;
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped, ${errors} errors`);
  console.log('Students must change password on first login.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
