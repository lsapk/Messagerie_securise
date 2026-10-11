import { WebSocket } from 'ws';
import type { MessageWithSender } from './db';

const activeUserSockets = new Map<number, Set<WebSocket>>();

export function getOnlineUserIds(): number[] {
  return Array.from(activeUserSockets.keys());
}

export function registerSocket(userId: number, socket: WebSocket): void {
  let sockets = activeUserSockets.get(userId);
  if (!sockets) {
    sockets = new Set();
    activeUserSockets.set(userId, sockets);
  }
  sockets.add(socket);
  broadcastPresence();
}

export function unregisterSocket(userId: number, socket: WebSocket): void {
  const sockets = activeUserSockets.get(userId);
  if (sockets) {
    sockets.delete(socket);
    if (sockets.size === 0) {
      activeUserSockets.delete(userId);
    }
  }
  broadcastPresence();
}

export function sendToUser(userId: number, payload: unknown): boolean {
  const serialized = JSON.stringify(payload);
  let delivered = false;

  for (const socket of activeUserSockets.get(userId) ?? []) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(serialized);
      delivered = true;
    }
  }

  return delivered;
}

export function broadcastPresence(): void {
  const payload = { type: 'presence', onlineUserIds: getOnlineUserIds() };
  for (const userId of activeUserSockets.keys()) {
    sendToUser(userId, payload);
  }
}

export function broadcastNewMessage(
  senderId: number,
  recipientId: number,
  message: MessageWithSender
): boolean {
  const payload = { type: 'new_message', message };
  sendToUser(senderId, payload);
  return sendToUser(recipientId, payload);
}