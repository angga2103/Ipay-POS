import crypto from 'crypto';

const JWT_SECRET = process.env.POS_JWT_SECRET || 'ipay-pos-secure-hmac-salt-key-2026-garudatel';

export interface AuthTokenPayload {
  tenantId: string;
  userId: number;
  username: string;
  role: string;
  exp: number; // unix timestamp in seconds
}

/**
 * Buat token autentikasi kriptografis bertanda tangan HMAC-SHA256
 */
export function createAuthToken(data: { tenantId: string; userId: number; username: string; role: string }): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 hari
  const payload: AuthTokenPayload = {
    tenantId: data.tenantId,
    userId: data.userId,
    username: data.username,
    role: data.role,
    exp,
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${b64Header}.${b64Payload}`).digest('base64url');

  return `${b64Header}.${b64Payload}.${signature}`;
}

/**
 * Verifikasi token autentikasi kriptografis
 */
export function verifyAuthToken(token: string): AuthTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [b64Header, b64Payload, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${b64Header}.${b64Payload}`).digest('base64url');

  // Constant-time comparison untuk mencegah timing attack
  if (signature.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }

  try {
    const payloadStr = Buffer.from(b64Payload, 'base64url').toString('utf8');
    const payload: AuthTokenPayload = JSON.parse(payloadStr);

    // Cek kadaluwarsa
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Hash password atau PIN menggunakan crypto.scryptSync dengan garam (salt) acak
 */
export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(secret, salt, 32).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

/**
 * Verifikasi kecocokan password atau PIN (kompatibel penuh dengan plain text lama)
 */
export function verifySecret(secret: string, storedHash: string): boolean {
  if (!storedHash || !secret) return false;

  // 1. Format scrypt modern
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const originalHash = parts[2];
    const derived = crypto.scryptSync(secret, salt, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(originalHash, 'hex'));
  }

  // 2. Fallback untuk data awal plaintext (seperti 'admin123', '123456')
  return secret === storedHash;
}

export interface OtpSessionPayload {
  tenantId: string;
  userId?: number;
  email: string;
  purpose: 'LOGIN' | 'REGISTER' | 'RESET_PASSWORD';
  storeName?: string;
  extra?: any;
  exp: number; // unix timestamp in seconds
}

/**
 * Buat token sesi OTP sementara (15 menit)
 */
export function createOtpSessionToken(data: {
  tenantId: string;
  userId?: number;
  email: string;
  purpose: 'LOGIN' | 'REGISTER' | 'RESET_PASSWORD';
  storeName?: string;
  extra?: any;
}): string {
  const header = { alg: 'HS256', typ: 'OTP' };
  const exp = Math.floor(Date.now() / 1000) + (15 * 60); // 15 menit
  const payload: OtpSessionPayload = {
    ...data,
    exp,
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${b64Header}.${b64Payload}`).digest('base64url');

  return `${b64Header}.${b64Payload}.${signature}`;
}

/**
 * Verifikasi token sesi OTP sementara
 */
export function verifyOtpSessionToken(token: string): OtpSessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [b64Header, b64Payload, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${b64Header}.${b64Payload}`).digest('base64url');

  if (signature.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }

  try {
    const payloadStr = Buffer.from(b64Payload, 'base64url').toString('utf8');
    const payload: OtpSessionPayload = JSON.parse(payloadStr);

    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
