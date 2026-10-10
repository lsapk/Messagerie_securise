import { z } from 'zod';

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, 'Le nom d’utilisateur doit comporter au moins 2 caractères')
    .max(50, 'Le nom d’utilisateur ne peut pas dépasser 50 caractères'),
  password: z
    .string()
    .min(6, 'Le mot de passe doit comporter au moins 6 caractères')
    .max(100, 'Le mot de passe ne peut pas dépasser 100 caractères'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const userPayloadSchema = z.object({
  id: z.number().int().positive(),
  username: z.string().min(2).max(50),
});

export type UserPayload = z.infer<typeof userPayloadSchema>;
