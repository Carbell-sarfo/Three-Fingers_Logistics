import type { APIRoute } from 'astro';
import { supabasePublic } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const { email, password } = await request.json();

  const { data, error } = await supabasePublic.auth.signInWithPassword({
    email: String(email || '').trim(),
    password: String(password || ''),
  });

  if (error || !data.session) {
    return new Response(
      JSON.stringify({ error: 'Invalid admin email or password.' }),
      { status: 401 }
    );
  }

  cookies.set('sb-access-token', data.session.access_token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    maxAge: data.session.expires_in,
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};