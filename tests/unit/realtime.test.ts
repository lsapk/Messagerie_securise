import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import {
  broadcastNewMessage,
  registerSocket,
  unregisterSocket,
} from '../../src/libs/realtime';
import type { MessageWithSender } from '../../src/libs/db';

function createSocket() {
  const sent: string[] = [];
  const socket = {
    readyState: WebSocket.OPEN,
    send: (payload: string) => sent.push(payload),
  } as unknown as WebSocket;
  return { socket, sent };
}

describe('Diffusion temps réel des messages', () => {
  const sockets: Array<{ userId: number; socket: WebSocket }> = [];

  afterEach(() => {
    for (const { userId, socket } of sockets.splice(0)) {
      unregisterSocket(userId, socket);
    }
  });

  it('diffuse le même message à l’expéditeur et au destinataire connectés', () => {
    const sender = createSocket();
    const recipient = createSocket();
    sockets.push({ userId: 101, socket: sender.socket }, { userId: 202, socket: recipient.socket });
    registerSocket(101, sender.socket);
    registerSocket(202, recipient.socket);
    sender.sent.length = 0;
    recipient.sent.length = 0;

    const message: MessageWithSender = {
      id: 1,
      sender_id: 101,
      recipient_id: 202,
      sender_username: 'Romane_C',
      content: 'Bonjour',
      media_path: null,
      created_at: '2026-10-11 14:00:00',
    };

    expect(broadcastNewMessage(101, 202, message)).toBe(true);
    expect(JSON.parse(sender.sent[0])).toEqual({ type: 'new_message', message });
    expect(JSON.parse(recipient.sent[0])).toEqual({ type: 'new_message', message });
  });

  it('indique quand le destinataire est hors ligne', () => {
    const sender = createSocket();
    sockets.push({ userId: 303, socket: sender.socket });
    registerSocket(303, sender.socket);
    sender.sent.length = 0;

    const message: MessageWithSender = {
      id: 2,
      sender_id: 303,
      recipient_id: 404,
      sender_username: 'Leny_G',
      content: 'À plus tard',
      media_path: null,
      created_at: '2026-10-11 14:01:00',
    };

    expect(broadcastNewMessage(303, 404, message)).toBe(false);
    expect(JSON.parse(sender.sent[0])).toEqual({ type: 'new_message', message });
  });
});