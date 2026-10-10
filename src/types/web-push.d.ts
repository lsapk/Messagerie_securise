declare module 'web-push' {
  export interface VapidKeys {
    publicKey: string;
    privateKey: string;
  }

  export interface PushSubscriptionKeys {
    p256dh: string;
    auth: string;
  }

  export interface PushSubscription {
    endpoint: string;
    keys: PushSubscriptionKeys;
  }

  export interface RequestOptions {
    vapidDetails?: {
      subject: string;
      publicKey: string;
      privateKey: string;
    };
    TTL?: number;
    headers?: Record<string, string>;
  }

  export function generateVAPIDKeys(): VapidKeys;

  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string
  ): void;

  export function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer | null,
    options?: RequestOptions
  ): Promise<{ statusCode: number; body: string; headers: Record<string, string> }>;
}
