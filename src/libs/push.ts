import webpush from 'web-push';
import {
  getPushSubscriptionsForUser,
  getPushSubscriptionsExcludingUser,
  deletePushSubscription,
} from './db';

let vapidConfigured = false;

export function configureWebPush(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@private-chat.local';

  if (!publicKey || !privateKey || publicKey === 'VOTRE_CLE_PUBLIQUE_VAPID') {
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch (err) {
    console.error('Erreur configuration VAPID:', err);
    return false;
  }
}

export function getVapidPublicKey(): string | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey || publicKey === 'VOTRE_CLE_PUBLIQUE_VAPID') {
    return null;
  }
  return publicKey;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushToUser(
  userId: number,
  payload: PushNotificationPayload
): Promise<void> {
  if (!configureWebPush()) {
    return;
  }

  const subscriptions = getPushSubscriptionsForUser(userId);
  if (subscriptions.length === 0) return;

  const payloadString = JSON.stringify(payload);

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payloadString
        );
      } catch (err: unknown) {
        const error = err as { statusCode?: number };
        // 404 Not Found ou 410 Gone indiquent une souscription expirée ou désenregistrée
        if (error.statusCode === 404 || error.statusCode === 410) {
          deletePushSubscription(sub.endpoint);
        }
      }
    })
  );
}

export async function sendPushToOtherUsers(
  excludeSenderId: number,
  payload: PushNotificationPayload
): Promise<void> {
  if (!configureWebPush()) {
    return;
  }

  const subscriptions = getPushSubscriptionsExcludingUser(excludeSenderId);
  if (subscriptions.length === 0) return;

  const payloadString = JSON.stringify(payload);

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payloadString
        );
      } catch (err: unknown) {
        const error = err as { statusCode?: number };
        if (error.statusCode === 404 || error.statusCode === 410) {
          deletePushSubscription(sub.endpoint);
        }
      }
    })
  );
}
