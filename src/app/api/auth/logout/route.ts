import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/libs/auth';

export async function POST() {
  const cookieString = clearSessionCookie();
  const response = NextResponse.json({ message: 'Déconnexion effectuée' }, { status: 200 });
  response.headers.set('Set-Cookie', cookieString);
  return response;
}
