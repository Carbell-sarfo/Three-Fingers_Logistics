import { createClient } from '@supabase/supabase-js';
// import { sendSms } from './mnotify';

export const supabaseAdmin = createClient(
  import.meta.env.SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function processVerifiedPayment(params: {
  contractId: string;
  amount: number;
  method: string;
  reference: string;
  receivedBy?: string;
  notes?: string;
}) {
  // 1. Fetch contract, rider & past verified payment count
  const { data: contract } = await supabaseAdmin
    .from('contracts')
    .select('*, riders(*)')
    .eq('id', params.contractId)
    .single();

  if (!contract) throw new Error('Contract not found');

  const { count } = await supabaseAdmin
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('contract_id', contract.id)
    .eq('verification_status', 'Verified');

  const weekNumber = (count || 0) + 1;
  const minWeekly = Number(contract.weekly_minimum);
  const shortfall = Math.max(0, minWeekly - params.amount);

  // 2. Insert payment record (auto-generates TFR-XXXX receipt number)
  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .insert({
      rider_id: contract.rider_id,
      bike_id: contract.bike_id,
      contract_id: contract.id,
      week_number: weekNumber,
      amount: params.amount,
      shortfall_amount: shortfall,
      payment_method: params.method,
      reference_number: params.reference,
      verification_status: 'Verified',
      received_by: params.receivedBy || 'Paystack Auto',
      notes: params.notes || `Week ${weekNumber} payment`
    })
    .select()
    .single();

  if (error) throw error;

  // 3. Calculate Arrears, Overpayment & Automatic Strike Reset
  let arrears = Number(contract.arrears_balance);
  let strikes = Number(contract.underpayment_strikes);
  let streak = Number(contract.consecutive_full_weeks);

  if (params.amount < minWeekly) {
    // Underpayment: carry shortfall forward + add strike (max 3)
    arrears += shortfall;
    strikes = Math.min(3, strikes + 1);
    streak = 0;
  } else {
    // Full or Overpayment: reduce any arrears first
    const extraPaid = params.amount - minWeekly;
    arrears = Math.max(0, arrears - extraPaid);
    streak += 1;

    // Automatic Strike Reset: Arrears cleared OR 4 consecutive full weeks
    if (arrears === 0 || streak >= 4) {
      strikes = 0;
    }
  }

  // 4. Calculate total paid & check 2-week deposit repo threshold / completion
  const { data: allPayments } = await supabaseAdmin
    .from('payments')
    .select('amount')
    .eq('contract_id', contract.id)
    .eq('verification_status', 'Verified');

  const totalPaid = (allPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
  const depositCredit = contract.deposit_status === 'Paid' ? Number(contract.security_deposit) : 0;

  let newStatus = 'Active';
  if (contract.contract_type === 'lease_to_own' && totalPaid + depositCredit >= Number(contract.contract_value)) {
    newStatus = 'Completed';
  } else if (arrears >= Number(contract.security_deposit)) {
    newStatus = 'At Risk'; // 2-week deposit buffer exhausted -> Retrieve Bike alert
  }

  await supabaseAdmin
    .from('contracts')
    .update({
      arrears_balance: arrears,
      underpayment_strikes: strikes,
      consecutive_full_weeks: streak,
      status: newStatus
    })
    .eq('id', contract.id);

  // 5. Send instant mNotify SMS receipt & warning (if underpaid)
//   const remaining = contract.contract_type === 'lease_to_own'
//     ? Math.max(0, Number(contract.contract_value) - totalPaid - depositCredit)
//     : 0;

//   let smsText = `Three Fingers Transport: GHS ${params.amount} received (Receipt ${payment.receipt_number}, Wk ${weekNumber}). `;
//   if (contract.contract_type === 'lease_to_own') {
//     smsText += `Balance: GHS ${remaining}. `;
//   }
//   if (shortfall > 0) {
//     smsText += `WARNING: Underpayment of GHS ${shortfall} carried forward (Strike ${strikes}/3).`;
//   } else if (arrears > 0) {
//     smsText += `Arrears left: GHS ${arrears}.`;
//   } else {
//     smsText += `Account in good standing.`;
//   }

//   await sendSms(contract.riders.phone, smsText);
//   return payment;
// }
}