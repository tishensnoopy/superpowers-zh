import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const BCRYPT_COST = 12;
const JWT_ALG = 'HS256';

function getJwtSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET env var is required');
  return new TextEncoder().encode(s);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface AdminJwtPayload {
  sub: string;
  email: string;
  role: 'superadmin' | 'admin' | 'viewer';
}

export async function signJwt(payload: AdminJwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret());
}

export async function verifyJwt(token: string): Promise<AdminJwtPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return {
    sub: payload.sub as string,
    email: payload.email as string,
    role: payload.role as AdminJwtPayload['role'],
  };
}

export const COOKIE_NAME = 'central_admin_session';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
