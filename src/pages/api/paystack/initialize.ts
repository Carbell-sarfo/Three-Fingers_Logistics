import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

const paystackSecret =
  import.meta.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY || '';
const siteUrl = (
  import.meta.env.PUBLIC_SITE_URL ||
  process.env.PUBLIC_SITE_URL ||
  'http://localhost:4321'
).replace(/\/+$/, '');

function isValidEmail(val: unknown): val is string {
  return typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const riderId = locals.riderId;
    if (!riderId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { contractId, amount } = await request.json();
    const numericAmount = Number(amount);

    if (!contractId || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid payment amount.' }),
        { status: 400 }
      );
    }

    const { data: rider, error: riderErr } = await supabaseAdmin
      .from('riders')
      .select('*')
      .eq('id', riderId)
      .single();

    if (riderErr || !rider) {
      return new Response(JSON.stringify({ error: 'Rider profile not found.' }), {
        status: 404,
      });
    }

    const { data: contract, error: contractErr } = await supabaseAdmin
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .eq('rider_id', riderId)
      .single();

    if (contractErr || !contract) {
      return new Response(JSON.stringify({ error: 'Contract not found.' }), {
        status: 404,
      });
    }

    // Enforce 3-strike minimum lock if applicable
    const strikes = Number(contract.underpayment_strikes || 0);
    const weeklyMin = Number(contract.weekly_minimum || 0);
    if (strikes >= 3 && numericAmount < weeklyMin) {
      return new Response(
        JSON.stringify({
          error: `With 3 underpayment strikes, payment must be at least GHS ${weeklyMin}.`,
        }),
        { status: 400 }
      );
    }

    const cleanPhone = String(rider.phone || '').replace(/\D/g, '') || riderId.toLowerCase();
    const payerEmail = isValidEmail((rider as any).email)
      ? (rider as any).email.trim()
      : `rider.${cleanPhone}@threefingersgh.com`;

    const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: payerEmail,
        amount: Math.round(numericAmount * 100), // pesewas
        currency: 'GHS',
        callback_url: `${siteUrl}/dashboard`,
        metadata: {
          rider_id: rider.id,
          rider_name: rider.full_name,
          phone: rider.phone,
          contract_id: contract.id,
          bike_id: contract.bike_id,
        },
      }),
    });

    const psData = await psRes.json();

    if (!psRes.ok || !psData?.status) {
      return new Response(
        JSON.stringify({
          error: psData?.message || 'Paystack initialization failed.',
        }),
        { status: 400 }
      );
    }

    return new Response(JSON.stringify(psData), { status: 200 });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Payment initialization error.' }),
      { status: 500 }
    );
  }
};