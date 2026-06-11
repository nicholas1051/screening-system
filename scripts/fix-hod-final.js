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

  // Fix HOD: recreate auth user fresh
  console.log('Recreating HOD user...');
  
  // Delete old HOD if exists
  const { data: list } = await supabase.auth.admin.listUsers();
  const old = list?.users?.find(u => u.email === 'hod@uniabuja.edu.ng');
  if (old) {
    await supabase.auth.admin.deleteUser(old.id);
    await supabase.from('profiles').delete().eq('email', 'hod@uniabuja.edu.ng');
    console.log('  Deleted old HOD');
  }

  // Create fresh
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'hod@uniabuja.edu.ng',
    password: 'demo123',
    email_confirm: true,
  });

  if (error) { console.error('  Error:', error.message); process.exit(1); }
  const uid = data?.user?.id;
  if (!uid) { console.error('  No user id'); process.exit(1); }

  await supabase.from('profiles').insert({
    id: uid, name: 'Prof. Abdullahi', email: 'hod@uniabuja.edu.ng', role: 'hod', active: true,
  });
  console.log('  Created HOD');

  // Verify identity providers exist
  const { data: users } = await supabase.auth.admin.listUsers();
  for (const u of users?.users || []) {
    const providers = u.identities?.length || 0;
    console.log(`  ${u.email}: ${providers} identity(ies)`);
  }

  console.log('\nLogin: hod@uniabuja.edu.ng / demo123');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
