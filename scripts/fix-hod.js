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

  // Create HOD auth user
  console.log('Creating HOD user...');
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'hod@uniabuja.edu.ng',
    password: 'Hod123456',
    email_confirm: true,
  });

  let userId;
  if (data?.user?.id) {
    userId = data.user.id;
    console.log('Auth user created');
  } else if (error?.message?.includes('already')) {
    // Find existing
    const { data: list } = await supabase.auth.admin.listUsers();
    const found = list?.users?.find(u => u.email === 'hod@uniabuja.edu.ng');
    if (found) { userId = found.id; console.log('Auth user already exists'); }
    else { console.error('Cannot find HOD user'); process.exit(1); }
  } else {
    console.error('Error:', error?.message);
    process.exit(1);
  }

  // Upsert profile
  const { error: pe } = await supabase.from('profiles').upsert({
    id: userId,
    name: 'Prof. Abdullahi',
    email: 'hod@uniabuja.edu.ng',
    role: 'hod',
    active: true,
  });
  if (pe) console.error('Profile error:', pe.message);
  else console.log('Profile upserted');

  // Verify
  const { data: profs } = await supabase.from('profiles').select('email,role');
  console.log('\nProfiles in DB:', profs?.length || 0);
  for (const p of profs || []) console.log(`  ${p.email} (${p.role})`);

  console.log('\nLogin: hod@uniabuja.edu.ng / Hod123456');
}

main().catch(e => { console.error(e); process.exit(1); });
