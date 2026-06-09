import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEMO_USERS = [
  { email: 'student@uniabuja.edu.ng', password: 'demo123', name: 'Oluwaseun Adeyemi', role: 'student' },
  { email: 'adebayo@uniabuja.edu.ng', password: 'demo123', name: 'Dr. Adebayo', role: 'officer' },
  { email: 'okafor@uniabuja.edu.ng', password: 'demo123', name: 'Mrs. Okafor', role: 'officer' },
  { email: 'ezeh@uniabuja.edu.ng', password: 'demo123', name: 'Mr. Ezeh', role: 'officer' },
  { email: 'hod@uniabuja.edu.ng', password: 'demo123', name: 'Prof. Abdullahi', role: 'hod' },
];

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

  if (!supabaseUrl) {
    supabaseUrl = await prompt('Enter Supabase URL (from .env or dashboard): ');
  }
  if (!serviceRoleKey) {
    serviceRoleKey = await prompt('Enter Supabase service_role key (Settings > API > service_role key): ');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const results = [];
  let errors = 0;

  for (const user of DEMO_USERS) {
    process.stdout.write(`Setting up ${user.email}... `);
    let userId = null;

    // Step 1: Create or find auth user
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { name: user.name, role: user.role },
    });

    if (data?.user?.id) {
      userId = data.user.id;
      console.log('created');
    } else if (error && (error.message?.includes('already') || error.message?.includes('already registered'))) {
      // Find existing user
      const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
      if (listErr) { console.error(`list error: ${listErr.message}`); errors++; continue; }
      const found = (listData?.users || []).find(u => u.email === user.email);
      if (found) {
        userId = found.id;
        console.log('already exists');
      } else {
        console.error(`cannot find existing user`);
        errors++;
        continue;
      }
    } else {
      console.error(`create error: ${error?.message || 'unknown'}`);
      errors++;
      continue;
    }

    // Step 2: Delete stale profile for this email (ignore if none)
    await supabase.from('profiles').delete().eq('email', user.email);

    // Step 3: Insert fresh profile
    const { error: profileErr } = await supabase.from('profiles').insert({
      id: userId,
      name: user.name,
      email: user.email,
      role: user.role,
      active: true,
    });

    if (profileErr) {
      console.error(`  -> profile insert failed: ${profileErr.message}`);
      errors++;
    } else {
      console.log(`  -> profile inserted`);
      results.push({ ...user, id: userId });
    }
  }

  // Verify
  console.log('\n--- Verification ---');
  const { data: profs, error: verr } = await supabase.from('profiles').select('email, role');
  if (verr) {
    console.error(`Cannot verify profiles: ${verr.message}`);
  } else {
    console.log(`Profiles in database: ${profs?.length || 0} rows`);
    for (const p of profs || []) console.log(`  ${p.email} (${p.role})`);
  }

  if (errors > 0) {
    console.log(`\n⚠ ${errors} error(s) occurred. Check messages above.`);
  }

  console.log('\n=== Setup Complete ===\n');
  console.log('Login credentials:');
  console.log('  Role     Identifier                    Password');
  console.log('  ─────────────────────────────────────────────────');
  DEMO_USERS.forEach(u => {
    const id = u.role === 'student' ? '202630123456AB' : u.email;
    console.log(`  ${u.role.padEnd(8)} ${id.padEnd(30)} ${u.password}`);
  });
  console.log('\n- Students log in with Registration Number (not email)');
  console.log('- Staff (officers, HOD) log in with Email');
  console.log('\nNext: Run supabase/seed.sql in the Supabase SQL Editor.\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
