import http from 'node:http';
import { parse as parseUrl } from 'node:url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';

// Chargement des variables d'environnement
dotenv.config();

import { initDb, createMessage, getUserById } from './libs/db';
import { getSessionFromCookieHeader } from './libs/auth';
import { wsMessageSchema } from './validations/message';
import { sendPushToUser, configureWebPush } from './libs/push';

const port = Number(process.env.PORT) || 3000;
const dev = process.env.NODE_ENV !== 'production';

// Initialisation de la base SQLite et de Web Push
initDb();
configureWebPush();

const app = next({ dev, hostname: '0.0.0.0', port });
const handle = app.getRequestHandler();
const handleUpgrade = app.getUpgradeHandler();

// Map userId -> Set de WebSockets actifs (un utilisateur peut avoir plusieurs onglets/appareils ouverts)
const activeUserSockets = new Map<number, Set<WebSocket>>();

function registerSocket(userId: number, socket: WebSocket) {
  if (!activeUserSockets.has(userId)) {
    activeUserSockets.set(userId, new Set());
  }
  activeUserSockets.get(userId)!.add(socket);
  broadcastPresence();
}

function unregisterSocket(userId: number, socket: WebSocket) {
  const sockets = activeUserSockets.get(userId);
  if (sockets) {
    sockets.delete(socket);
    if (sockets.size === 0) {
      activeUserSockets.delete(userId);
    }
  }
  broadcastPresence();
}

function broadcastPresence() {
  const onlineUserIds = Array.from(activeUserSockets.keys());
  const payload = JSON.stringify({
    type: 'presence',
    onlineUserIds,
  });

  for (const userSet of activeUserSockets.values()) {
    for (const ws of userSet) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
}

async function main() {
  await app.prepare();

  const server = http.createServer((req, res) => {
    const parsedUrl = parseUrl(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parseUrl(req.url || '');

    if (pathname === '/ws') {
      const user = getSessionFromCookieHeader(req.headers.cookie);
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req, user);
      });
      return;
    }

    handleUpgrade(req, socket, head);
  });

  wss.on('connection', (ws: WebSocket, _req: http.IncomingMessage, user: { id: number; username: string }) => {
    registerSocket(user.id, ws);

    // Confirmation de connexion au client
    ws.send(
      JSON.stringify({
        type: 'connected',
        user: { id: user.id, username: user.username },
        onlineUserIds: Array.from(activeUserSockets.keys()),
      })
    );

    ws.on('message', async (data) => {
      try {
        const text = data.toString('utf-8');
        const rawJson = JSON.parse(text);
        const parseResult = wsMessageSchema.safeParse(rawJson);

        if (!parseResult.success) {
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Format de message invalide',
            })
          );
          return;
        }

        const msg = parseResult.data;

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        if (msg.type === 'typing') {
          // Relayer l'indicateur de saisie aux autres utilisateurs
          const typingPayload = JSON.stringify({
            type: 'user_typing',
            userId: user.id,
            username: user.username,
            isTyping: msg.isTyping,
          });

          if (msg.recipientId) {
            const recipientSockets = activeUserSockets.get(msg.recipientId);
            if (recipientSockets) {
              for (const s of recipientSockets) {
                if (s.readyState === WebSocket.OPEN) s.send(typingPayload);
              }
            }
          } else {
            // Relayer à tout le monde sauf l'expéditeur
            for (const [uid, set] of activeUserSockets.entries()) {
              if (uid !== user.id) {
                for (const s of set) {
                  if (s.readyState === WebSocket.OPEN) s.send(typingPayload);
                }
              }
            }
          }
          return;
        }

        if (msg.type === 'chat_message') {
          if (!msg.content && !msg.mediaPath) return;
          if (msg.recipientId === user.id) {
            ws.send(JSON.stringify({ type: 'error', message: 'Destinataire invalide' }));
            return;
          }

          const recipient = getUserById(msg.recipientId);
          if (!recipient) {
            ws.send(JSON.stringify({ type: 'error', message: 'Destinataire introuvable' }));
            return;
          }

          // Sauvegarde en base de données
          const savedMessage = createMessage(
            user.id,
            msg.recipientId,
            msg.content ?? null,
            msg.mediaPath ?? null
          );

          const chatPayload = JSON.stringify({
            type: 'new_message',
            message: savedMessage,
          });

          const senderSockets = activeUserSockets.get(user.id);
          if (senderSockets) {
            for (const s of senderSockets) {
              if (s.readyState === WebSocket.OPEN) s.send(chatPayload);
            }
          }

          const recipientSockets = activeUserSockets.get(msg.recipientId);
          let recipientReceivedViaWs = false;

          if (recipientSockets && recipientSockets.size > 0) {
            for (const s of recipientSockets) {
              if (s.readyState === WebSocket.OPEN) {
                s.send(chatPayload);
                recipientReceivedViaWs = true;
              }
            }
          }

          if (!recipientReceivedViaWs) {
            sendPushToUser(msg.recipientId, {
              title: `${user.username}`,
              body: msg.content || '📷 Vous a envoyé une photo.',
              url: '/',
            }).catch((err) => console.error('Erreur Web Push:', err));
          }
        }
      } catch (err) {
        console.error('Erreur traitement WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      unregisterSocket(user.id, ws);
    });

    ws.on('error', (err) => {
      console.error(`WebSocket erreur (utilisateur ${user.username}):`, err);
      unregisterSocket(user.id, ws);
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Serveur de messagerie privée démarré avec succès !`);
    console.log(`📡 URL locale        : http://localhost:${port}`);
    console.log(`⚡ WebSocket actif   : ws://localhost:${port}/ws`);
    console.log(`💾 Base de données   : SQLite (${process.env.DATABASE_URL || './data/chat.db'})`);
    console.log(`📁 Dossier médias    : ${process.env.UPLOAD_DIR || './uploads'}`);
    console.log(`======================================================\n`);
  });
}

main().catch((err) => {
  console.error('Erreur critique au démarrage du serveur:', err);
  process.exit(1);
});
