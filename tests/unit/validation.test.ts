import { describe, it, expect } from 'vitest';
import { loginSchema } from '../../src/validations/auth';
import { createMessageSchema, wsMessageSchema } from '../../src/validations/message';
import { pushSubscriptionSchema } from '../../src/validations/push';

describe('Validation des Schémas Zod', () => {
  describe('loginSchema', () => {
    it('doit valider un payload de login correct', () => {
      const input = { username: 'alex', password: 'password123' };
      const result = loginSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.username).toBe('alex');
      }
    });

    it('doit rejeter un nom d’utilisateur trop court ou vide', () => {
      expect(loginSchema.safeParse({ username: 'a', password: 'password123' }).success).toBe(false);
      expect(loginSchema.safeParse({ username: '  ', password: 'password123' }).success).toBe(false);
    });

    it('doit rejeter un mot de passe trop court', () => {
      expect(loginSchema.safeParse({ username: 'alex', password: '123' }).success).toBe(false);
    });
  });

  describe('createMessageSchema', () => {
    it('doit accepter un message avec texte seul', () => {
      const result = createMessageSchema.safeParse({
        recipientId: 2,
        content: 'Coucou comment vas-tu ?',
      });
      expect(result.success).toBe(true);
    });

    it('doit accepter un message avec photo seule', () => {
      const result = createMessageSchema.safeParse({
        recipientId: 2,
        mediaPath: '/api/uploads/550e8400-e29b-41d4-a716-446655440000.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('doit accepter un message avec texte et photo', () => {
      const result = createMessageSchema.safeParse({
        recipientId: 2,
        content: 'Regarde cette photo',
        mediaPath: '/api/uploads/550e8400-e29b-41d4-a716-446655440000.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('doit rejeter un chemin média hors du dossier d’upload', () => {
      const result = createMessageSchema.safeParse({
        recipientId: 2,
        mediaPath: '/api/uploads/../secret.jpg',
      });
      expect(result.success).toBe(false);
    });

    it('doit rejeter un message sans destinataire', () => {
      const result = createMessageSchema.safeParse({
        content: 'Sans destinataire',
      });
      expect(result.success).toBe(false);
    });

    it('doit rejeter un message sans texte ni photo', () => {
      const result = createMessageSchema.safeParse({
        content: '',
        mediaPath: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('wsMessageSchema', () => {
    it('doit valider une trame chat_message avec destinataire', () => {
      const result = wsMessageSchema.safeParse({
        type: 'chat_message',
        recipientId: 2,
        content: 'Message privé',
      });
      expect(result.success).toBe(true);
    });

    it('doit rejeter une trame chat_message sans destinataire', () => {
      const result = wsMessageSchema.safeParse({
        type: 'chat_message',
        recipientId: null,
        content: 'Message général',
      });
      expect(result.success).toBe(false);
    });

    it('doit valider une trame ping', () => {
      const result = wsMessageSchema.safeParse({ type: 'ping' });
      expect(result.success).toBe(true);
    });

    it('doit valider une trame typing', () => {
      const result = wsMessageSchema.safeParse({
        type: 'typing',
        recipientId: 2,
        isTyping: true,
      });
      expect(result.success).toBe(true);
    });

    it('doit rejeter un type de message inconnu', () => {
      const result = wsMessageSchema.safeParse({ type: 'unknown_action' });
      expect(result.success).toBe(false);
    });
  });

  describe('pushSubscriptionSchema', () => {
    it('doit valider un objet de souscription Web Push complet', () => {
      const input = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/fake-subscription-token',
        keys: {
          p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9Ac',
          auth: 'tBHItJI5svbpez7KI4CCXg',
        },
      };
      const result = pushSubscriptionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('doit rejeter un endpoint qui n’est pas une URL valide', () => {
      const input = {
        endpoint: 'invalid-url',
        keys: {
          p256dh: 'validKeyP256dhLengthOk',
          auth: 'validAuthKey',
        },
      };
      const result = pushSubscriptionSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
