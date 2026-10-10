import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { parse, serialize } from 'cookie';
import type { UserPayload } from '@/validations/auth';

const COOKIE_NAME = 'chat_session';
const SESSION_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 jours pour PWA persistante

function getJwtSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    // Si aucun secret robuste n'est spécifié en développement, on fournit une valeur par défaut prévisible pour éviter les crashes
    return 'development-default-secret-change-me-in-production-min-32-chars';
  }
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signSessionToken(payload: UserPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: SESSION_EXPIRY_SECONDS,
  });
}

export function verifySessionToken(token: string): UserPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as UserPayload;
    if (typeof decoded.id === 'number' && typeof decoded.username === 'string') {
      return { id: decoded.id, username: decoded.username };
    }
    return null;
  } catch {
    return null;
  }
}

export function createSessionCookie(token: string): string {
  const isProd = process.env.NODE_ENV === 'production';
  return serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd, // True en prod (HTTPS Cloudflare)
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_EXPIRY_SECONDS,
  });
}

export function clearSessionCookie(): string {
  const isProd = process.env.NODE_ENV === 'production';
  return serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function getSessionFromCookieHeader(cookieHeader?: string | null): UserPayload | null {
  if (!cookieHeader) return null;
  try {
    const cookies = parse(cookieHeader);
    const token = cookies[COOKIE_NAME];
    if (!token) return null;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: Request): UserPayload | null {
  const cookieHeader = request.headers.get('cookie');
  return getSessionFromCookieHeader(cookieHeader);
}
