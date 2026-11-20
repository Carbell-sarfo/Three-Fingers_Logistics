import { defineMiddleware } from 'astro:middleware';
import { verifyRiderToken } from './lib/auth';

export const onRequest = defineMiddleware(async ({ url, cookies, locals, redirect }, next) => {
  const path = url.pathname;

  const isRiderRoute =
    path.startsWith('/dashboard') ||
    path.startsWith('/pay') ||
    path.startsWith('/statement') ||
    path.startsWith('/api/paystack/initialize');

  if (isRiderRoute) {
    const token = cookies.get('tf_rider_token')?.value;
    const session = token ? await verifyRiderToken(token) : null;

    if (!session?.riderId) {
      if (path.startsWith('/api/')) {
        return new Response(JSON.stringify({ error: 'Unauthorized — please sign in again.' }), {
          status: 401,
        });
      }
      return redirect('/login');
    }

    locals.riderId = session.riderId;
  }

  return next();
});