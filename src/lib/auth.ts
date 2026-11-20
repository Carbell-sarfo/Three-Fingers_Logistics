import { SignJWT, jwtVerify } from 'jose';

const rawSecret = import.meta.env.JWT_SECRET || process.env.JWT_SECRET || 'fallback-dev-secret-change-me-32chars';
const secret = new TextEncoder().encode(rawSecret);

export function normalizeGhanaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '233' + digits.slice(1);
  return digits;
}

export async function createRiderToken(riderId: string) {
  return await new SignJWT({ riderId, role: 'rider' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret);
}

export async function verifyRiderToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { riderId: string; role: string };
  } catch {
    return null;
  }
}