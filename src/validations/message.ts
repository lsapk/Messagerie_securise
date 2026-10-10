import { z } from 'zod';

export const UPLOAD_MEDIA_PATH_REGEX =
  /^\/api\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif|heic|heif)$/i;

const optionalContent = z
  .string()
  .trim()
  .max(4000, 'Le message ne peut pas dépasser 4000 caractères')
  .nullable()
  .optional();

const optionalMediaPath = z
  .string()
  .trim()
  .regex(UPLOAD_MEDIA_PATH_REGEX, 'Chemin média invalide')
  .nullable()
  .optional();

export const createMessageSchema = z
  .object({
    recipientId: z.number().int().positive(),
    content: optionalContent,
    mediaPath: optionalMediaPath,
  })
  .refine(
    (data) =>
      (typeof data.content === 'string' && data.content.length > 0) ||
      (typeof data.mediaPath === 'string' && data.mediaPath.length > 0),
    {
      message: 'Le message doit contenir du texte ou une photo',
    }
  );

export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const wsMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('chat_message'),
    recipientId: z.number().int().positive(),
    content: optionalContent,
    mediaPath: optionalMediaPath,
  }),
  z.object({
    type: z.literal('typing'),
    recipientId: z.number().int().positive().nullable().optional(),
    isTyping: z.boolean(),
  }),
  z.object({
    type: z.literal('ping'),
  }),
]);

export type WsMessageInput = z.infer<typeof wsMessageSchema>;
