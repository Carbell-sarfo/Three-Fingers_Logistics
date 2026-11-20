import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { createRiderToken, normalizeGhanaPhone } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const rawDigits = String(body.phone || '').replace(/\D/g, '');
    const normalizedPhone = normalizeGhanaPhone(rawDigits);
    const localPhone = normalizedPhone.startsWith('233')
      ? '0' + normalizedPhone.slice(3)
      : rawDigits;
    const cleanPin = String(body.pin || '').trim();

    if (!normalizedPhone || !/^\d{4}$/.test(cleanPin)) {
      return new Response(
        JSON.stringify({ error: 'Enter a valid phone number and 4-digit PIN.' }),
        { status: 400 }
      );
    }

    const candidates = Array.from(new Set([normalizedPhone, localPhone, rawDigits])).filter(Boolean);

    const { data: riders, error } = await supabaseAdmin
      .from('riders')
      .select('id, full_name, phone, pin_hash, status')
      .in('phone', candidates);

    if (error) {
      console.error('Supabase riders query error:', error);
      return new Response(
        JSON.stringify({ error: `Supabase error: ${error.message} (hint: check SUPABASE_SERVICE_ROLE_KEY in .env)` }),
        { status: 500 }
      );
    }

    const rider = riders?.[0];
    if (!rider) {
      return new Response(
        JSON.stringify({ error: `No rider found for ${normalizedPhone}` }),
        { status: 401 }
      );
    }

    const { data: isValidPin, error: rpcError } = await supabaseAdmin.rpc('verify_rider_pin', {
      p_pin: cleanPin,
      p_hash: rider.pin_hash,
    });

    if (rpcError) {
      console.error('RPC verify_rider_pin error:', rpcError);
      return new Response(
        JSON.stringify({ error: `RPC error: ${rpcError.message}` }),
        { status: 500 }
      );
    }

    if (!isValidPin) {
      return new Response(
        JSON.stringify({ error: 'Incorrect 4-digit PIN.' }),
        { status: 401 }
      );
    }

    const token = await createRiderToken(rider.id);
    cookies.set('tf_rider_token', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: import.meta.env.PROD,
      maxAge: 60 * 60 * 24 * 30,
    });

    return new Response(JSON.stringify({ ok: true, riderName: rider.full_name }), {
      status: 200,
    });
  } catch (err: any) {
    console.error('Rider login crash:', err);
    return new Response(
      JSON.stringify({ error: `Server crash: ${err?.message || String(err)}` }),
      { status: 500 }
    );
  }
};