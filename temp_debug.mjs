import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

const env = readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.+)/)[1].trim();
const anon = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim();

const client = createClient(url, anon);

const { data: rpcResult, error: rpcErr } = await client.rpc('get_email_by_reg_no', { reg: '2023/123456AB' });
console.log('RPC result:', rpcResult);
console.log('RPC error:', rpcErr?.message || 'none');

const { data: signInData, error: signInErr } = await client.auth.signInWithPassword({ email: 'student@uniabuja.edu.ng', password: 'demo123' });
if (signInErr) { console.log('Sign in error:', signInErr.message); process.exit(1); }
console.log('Signed in user ID:', signInData.user.id);

const { data: prof, error: profErr } = await client.from('profiles').select('*').eq('id', signInData.user.id).single();
console.log('Profile:', JSON.stringify(prof));
console.log('Profile error:', profErr?.message || 'none');
