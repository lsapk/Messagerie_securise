import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/libs/auth';
import { createMessageSchema } from '@/validations/message';
import { getConversationMessages, createMessage, getUserById } from '@/libs/db';
import { sendPushToUser } from '@/libs/push';
import { broadcastNewMessage } from '@/libs/realtime';

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 200);
  const beforeId = searchParams.get('beforeId') ? Number(searchParams.get('beforeId')) : undefined;
  const peerId = Number(searchParams.get('recipientId'));

  if (!Number.isInteger(peerId) || peerId <= 0 || peerId === session.id) {
    return NextResponse.json({ error: 'Destinataire invalide' }, { status: 400 });
  }

  const peer = getUserById(peerId);
  if (!peer) {
    return NextResponse.json({ error: 'Destinataire introuvable' }, { status: 404 });
  }

  const messages = getConversationMessages(session.id, peerId, limit, beforeId);

  return NextResponse.json({
    messages,
  });
}

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = createMessageSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Données de message invalides', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { recipientId, content, mediaPath } = parseResult.data;

    if (recipientId === session.id || !getUserById(recipientId)) {
      return NextResponse.json({ error: 'Destinataire invalide' }, { status: 400 });
    }

    const newMessage = createMessage(
      session.id,
      recipientId,
      content ?? null,
      mediaPath ?? null
    );

    const recipientReceivedViaWs = broadcastNewMessage(session.id, recipientId, newMessage);
    if (!recipientReceivedViaWs) {
      sendPushToUser(recipientId, {
        title: `${session.username}`,
        body: content || 'Vous a envoyé une photo.',
        url: '/',
      }).catch((err) => console.error('Push error:', err));
    }

    return NextResponse.json({
      success: true,
      message: newMessage,
    });
  } catch (error) {
    console.error('Erreur API Messages POST:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
