import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const role = url.searchParams.get('role');

  cookies.delete('tf_rider_token', { path: '/' });
  cookies.delete('sb-access-token', { path: '/' });

  if (role === 'admin') {
    return redirect('/admin/login');
  }
  return redirect('/login');
};