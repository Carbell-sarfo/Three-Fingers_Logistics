import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function generateReceiptPdf(data: {
  receiptNumber: string;
  date: string;
  riderName: string;
  bikeId: string;
  contractId: string;
  contractType: string;
  weekNumber: number;
  amount: number;
  outstandingBalance: number;
  arrearsBalance: number;
  paymentMethod: string;
  reference: string;
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 580]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  let y = 530;
  page.drawText('THREE FINGERS LTD.', { x: 40, y, size: 16, font: bold });
  y -= 18;
  page.drawText('Three Fingers Transport — Official Payment Receipt', { x: 40, y, size: 10, font: regular, color: rgb(0.35, 0.35, 0.35) });
  y -= 25;
  page.drawLine({ start: { x: 40, y }, end: { x: 380, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 28;

  const rows: [string, string][] = [
    ['Receipt Number:', data.receiptNumber],
    ['Date:', data.date],
    ['Received From:', data.riderName],
    ['Bike ID:', data.bikeId],
    ['Contract ID:', `${data.contractId} (${data.contractType === 'lease_to_own' ? 'Lease-to-Own' : 'Sales'})`],
    ['Week Number:', `Week ${data.weekNumber}`],
    ['Amount Paid:', `GHS ${data.amount.toLocaleString()}`],
    ['Payment Method:', data.paymentMethod],
    ['Reference:', data.reference || 'N/A'],
    ['Arrears Carried Forward:', `GHS ${data.arrearsBalance.toLocaleString()}`],
  ];

  if (data.contractType === 'lease_to_own') {
    rows.push(['Remaining Lease Balance:', `GHS ${data.outstandingBalance.toLocaleString()}`]);
  }

  for (const [label, value] of rows) {
    page.drawText(label, { x: 40, y, size: 10, font: regular, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(value, { x: 200, y, size: 10, font: bold });
    y -= 24;
  }

  y -= 20;
  page.drawText('Thank you for your payment — keep this receipt for your records.', {
    x: 40, y, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4)
  });

  return await pdf.save();
}