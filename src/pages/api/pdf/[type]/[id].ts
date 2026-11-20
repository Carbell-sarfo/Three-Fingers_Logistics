import type { APIRoute } from 'astro';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { supabaseAdmin } from '../../../../lib/supabase';

export const GET: APIRoute = async ({ params }) => {
  const { type, id } = params;

  if (type === 'receipt' && id) {
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*, riders(full_name), contracts(contract_type, contract_value, security_deposit, deposit_status, arrears_balance)')
      .eq('receipt_number', id)
      .single();

    if (!payment) return new Response('Receipt not found', { status: 404 });

    const { data: allPayments } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('contract_id', payment.contract_id)
      .eq('verification_status', 'Verified')
      .lte('week_number', payment.week_number);

    const paidToDate = (allPayments || []).reduce((s, p) => s + Number(p.amount), 0);
    const c = payment.contracts;
    const isLease = c?.contract_type === 'lease_to_own';
    const depCredit = c?.deposit_status === 'Paid' ? Number(c.security_deposit) : 0;
    const remaining = isLease ? Math.max(0, Number(c.contract_value) - paidToDate - depCredit) : 0;

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([420, 580]);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);

    let y = 530;
    page.drawText('THREE FINGERS LTD.', { x: 40, y, size: 16, font: bold });
    y -= 18;
    page.drawText('Three Fingers Transport — Payment Receipt', { x: 40, y, size: 10, font: regular, color: rgb(0.35, 0.35, 0.35) });
    y -= 24;
    page.drawLine({ start: { x: 40, y }, end: { x: 380, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    y -= 28;

    const rows: [string, string][] = [
      ['Receipt Number:', payment.receipt_number],
      ['Date:', new Date(payment.paid_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })],
      ['Received From:', payment.riders?.full_name || payment.rider_id],
      ['Bike ID:', payment.bike_id],
      ['Contract ID:', `${payment.contract_id} (${isLease ? 'Lease-to-Own' : 'Sales'})`],
      ['Week Number:', `Week ${payment.week_number}`],
      ['Amount Paid:', `GHS ${Number(payment.amount).toLocaleString()}`],
      ['Payment Method:', payment.payment_method],
      ['Reference:', payment.reference_number || 'N/A'],
      ['Received By:', payment.received_by || 'System'],
    ];

    if (isLease) {
      rows.push(['Balance After Payment:', `GHS ${remaining.toLocaleString()}`]);
    }

    for (const [label, value] of rows) {
      page.drawText(label, { x: 40, y, size: 10, font: regular, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(value, { x: 195, y, size: 10, font: bold });
      y -= 24;
    }

    y -= 18;
    page.drawText('Thank you for your payment — keep this receipt for your records.', {
      x: 40, y, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4),
    });

    const bytes = await pdf.save();
    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${payment.receipt_number}.pdf"`,
      },
    });
  }

  if (type === 'statement' && id) {
    const { data: rider } = await supabaseAdmin.from('riders').select('*').eq('id', id).single();
    const { data: contract } = await supabaseAdmin
      .from('contracts')
      .select('*')
      .eq('rider_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('rider_id', id)
      .eq('verification_status', 'Verified')
      .order('week_number', { ascending: true });

    if (!rider || !contract) return new Response('Statement not found', { status: 404 });

    const list = payments || [];
    const totalPaid = list.reduce((s, p) => s + Number(p.amount), 0);
    const isLease = contract.contract_type === 'lease_to_own';
    const depCredit = contract.deposit_status === 'Paid' ? Number(contract.security_deposit) : 0;
    const remaining = isLease ? Math.max(0, Number(contract.contract_value) - totalPaid - depCredit) : 0;

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);

    let y = 790;
    page.drawText('THREE FINGERS LTD. — STATEMENT OF AFFAIRS', { x: 45, y, size: 15, font: bold });
    y -= 18;
    page.drawText(`Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`, {
      x: 45, y, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4),
    });
    y -= 28;

    const summary: [string, string][] = [
      ['Rider:', `${rider.full_name} (${rider.id})`],
      ['Phone:', rider.phone],
      ['Bike / Contract:', `${contract.bike_id} / ${contract.id} (${isLease ? 'Lease-to-Own' : 'Pure Sales'})`],
      ['Weekly Minimum:', `GHS ${Number(contract.weekly_minimum).toLocaleString()}`],
      ['Security Deposit:', `GHS ${Number(contract.security_deposit).toLocaleString()} (${contract.deposit_status})`],
      ['Total Paid to Date:', `GHS ${totalPaid.toLocaleString()} (${list.length} payments)`],
      ['Carried Arrears:', `GHS ${Number(contract.arrears_balance).toLocaleString()} (Strikes: ${contract.underpayment_strikes}/3)`],
    ];

    if (isLease) {
      summary.splice(3, 0, ['Contract Value:', `GHS ${Number(contract.contract_value).toLocaleString()}`]);
      summary.push(['Remaining Balance:', `GHS ${remaining.toLocaleString()}`]);
    }

    for (const [k, v] of summary) {
      page.drawText(k, { x: 45, y, size: 10, font: regular, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(v, { x: 185, y, size: 10, font: bold });
      y -= 18;
    }

    y -= 16;
    page.drawLine({ start: { x: 45, y }, end: { x: 550, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    y -= 20;

    // Table Header
    page.drawText('Receipt', { x: 45, y, size: 9, font: bold });
    page.drawText('Date', { x: 125, y, size: 9, font: bold });
    page.drawText('Week', { x: 215, y, size: 9, font: bold });
    page.drawText('Amount (GHS)', { x: 270, y, size: 9, font: bold });
    page.drawText('Method', { x: 370, y, size: 9, font: bold });
    page.drawText('Reference', { x: 460, y, size: 9, font: bold });
    y -= 16;

    for (const p of list) {
      if (y < 60) break;
      page.drawText(p.receipt_number, { x: 45, y, size: 9, font: regular });
      page.drawText(new Date(p.paid_at).toLocaleDateString('en-GB'), { x: 125, y, size: 9, font: regular });
      page.drawText(`Wk ${p.week_number}`, { x: 215, y, size: 9, font: regular });
      page.drawText(Number(p.amount).toLocaleString(), { x: 270, y, size: 9, font: bold });
      page.drawText(p.payment_method, { x: 370, y, size: 9, font: regular });
      page.drawText(p.reference_number || '-', { x: 460, y, size: 9, font: regular });
      y -= 16;
    }

    const bytes = await pdf.save();
    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Statement_${rider.id}.pdf"`,
      },
    });
  }

  return new Response('Invalid PDF request', { status: 400 });
};