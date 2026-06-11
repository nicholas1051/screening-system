import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { students: studentList } = req.body;
  if (!studentList || !Array.isArray(studentList) || studentList.length === 0) {
    return res.status(400).json({ error: 'Missing students array' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const results = { created: 0, failed: 0, errors: [] };

  for (const s of studentList) {
    const password = 'student123';

    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: s.email,
      password,
      email_confirm: true,
      user_metadata: { name: s.name, role: 'student', password_change_required: true }
    });

    if (authErr) {
      results.failed++;
      results.errors.push({ reg_no: s.reg_no, error: authErr.message });
      continue;
    }

    const userId = authData.user.id;

    await supabase.from('students').update({ user_id: userId }).eq('id', s.id);
    await supabase.from('profiles').upsert({
      id: userId,
      name: s.name,
      email: s.email,
      role: 'student',
      active: true
    }, { onConflict: 'id' });

    results.created++;
  }

  return res.status(200).json(results);
}
