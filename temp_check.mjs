import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

const env = readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
if (!key) { console.log('Need SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }
const supabase = createClient(url, key[1].trim());

const { data: profiles } = await supabase.from('profiles').select('id, name, email, role');
console.log('Existing profiles:', JSON.stringify(profiles, null, 2));

const { data: { users } } = await supabase.auth.admin.listUsers();
console.log('Auth users:', JSON.stringify(users.map(u => ({ id: u.id, email: u.email })), null, 2));
