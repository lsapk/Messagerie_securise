import { NextResponse } from 'next/server';
import { getVapidPublicKey } from '@/libs/push';

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { error: 'Le service Web Push n’est pas encore configuré avec des clés VAPID.' },
      { status: 503 }
    );
  }

  return NextResponse.json({ publicKey });
}
