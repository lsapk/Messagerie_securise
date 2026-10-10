import { z } from 'zod';

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url('L’endpoint doit être une URL valide'),
  keys: z.object({
    p256dh: z.string().min(10, 'La clé p256dh est requise'),
    auth: z.string().min(6, 'Le secret auth est requis'),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
