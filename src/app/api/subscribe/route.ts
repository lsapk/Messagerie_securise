import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/libs/auth';
import { pushSubscriptionSchema } from '@/validations/push';
import { upsertPushSubscription } from '@/libs/db';

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = pushSubscriptionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Données de souscription invalides', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { endpoint, keys } = parseResult.data;

    upsertPushSubscription(session.id, endpoint, keys.p256dh, keys.auth);

    return NextResponse.json({
      success: true,
      message: 'Souscription Web Push enregistrée avec succès',
    });
  } catch (error) {
    console.error('Erreur API Subscribe:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
