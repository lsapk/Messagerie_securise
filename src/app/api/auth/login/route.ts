import { NextResponse } from 'next/server';
import { loginSchema } from '@/validations/auth';
import { getUserByUsername } from '@/libs/db';
import { verifyPassword, signSessionToken, createSessionCookie } from '@/libs/auth';

// Rate limiting basique en mémoire (protection brute force)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) {
    return false;
  }
  entry.count += 1;
  return true;
}

export async function POST(request: Request) {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || 'local';
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: 'Trop de tentatives de connexion. Veuillez réessayer dans une minute.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parseResult = loginSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { username, password } = parseResult.data;
    const user = getUserByUsername(username);

    if (!user) {
      return NextResponse.json(
        { error: 'Identifiant ou mot de passe incorrect' },
        { status: 401 }
      );
    }

    const passwordMatches = await verifyPassword(password, user.password_hash);
    if (!passwordMatches) {
      return NextResponse.json(
        { error: 'Identifiant ou mot de passe incorrect' },
        { status: 401 }
      );
    }

    const token = signSessionToken({ id: user.id, username: user.username });
    const cookieString = createSessionCookie(token);

    const response = NextResponse.json(
      {
        user: { id: user.id, username: user.username },
        message: 'Connexion réussie',
      },
      { status: 200 }
    );

    response.headers.set('Set-Cookie', cookieString);
    return response;
  } catch (error) {
    console.error('Erreur API Login:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
