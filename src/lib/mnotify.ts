const apiKey = import.meta.env.MNOTIFY_API_KEY || process.env.MNOTIFY_API_KEY || '';
const senderId =
  import.meta.env.MNOTIFY_SENDER_ID || process.env.MNOTIFY_SENDER_ID || 'TF Logistic';

interface SendSmsParams {
  to: string;
  message: string;
}

export async function sendSms({ to, message }: SendSmsParams): Promise<{
  ok: boolean;
  error?: string;
}> {
  const cleanPhone = String(to || '').replace(/\D/g, '');

  if (!cleanPhone || !message) {
    return { ok: false, error: 'Missing recipient phone or message.' };
  }

  if (!apiKey) {
    console.warn('MNOTIFY_API_KEY is not set; skipping SMS send.');
    return { ok: false, error: 'Missing MNOTIFY_API_KEY' };
  }

  try {
    const endpoint = `https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: [cleanPhone],
        sender: senderId.slice(0, 11),
        message,
        is_schedule: false,
        schedule_date: '',
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || (data?.status && String(data.status).toLowerCase() === 'error')) {
      const errMsg = data?.message || `mNotify HTTP ${response.status}`;
      console.error('mNotify SMS error:', errMsg, data);
      return { ok: false, error: errMsg };
    }

    return { ok: true };
  } catch (err: any) {
    console.error('mNotify request failed:', err);
    return { ok: false, error: err?.message || 'Network error sending SMS' };
  }
}