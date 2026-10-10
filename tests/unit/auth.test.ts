import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  signSessionToken,
  verifySessionToken,
  createSessionCookie,
  getSessionFromCookieHeader,
} from '../../src/libs/auth';

describe('Module d’Authentification & Sécurité', () => {
  it('doit hacher et vérifier un mot de passe avec bcrypt', async () => {
    const rawPassword = 'superSecretPassword42!';
    const hash = await hashPassword(rawPassword);

    expect(hash).not.toBe(rawPassword);
    expect(hash.startsWith('$2')).toBe(true);

    const isMatch = await verifyPassword(rawPassword, hash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await verifyPassword('mauvaisMotDePasse', hash);
    expect(isWrongMatch).toBe(false);
  });

  it('doit signer et vérifier un token JWT valide', () => {
    const payload = { id: 1, username: 'testuser' };
    const token = signSessionToken(payload);

    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const verified = verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(1);
    expect(verified?.username).toBe('testuser');
  });

  it('doit refuser un token falsifié ou altéré', () => {
    const payload = { id: 1, username: 'testuser' };
    const token = signSessionToken(payload);
    const tamperedToken = token.slice(0, -5) + 'abcde';

    const verified = verifySessionToken(tamperedToken);
    expect(verified).toBeNull();
  });

  it('doit créer un cookie de session et extraire les identifiants', () => {
    const payload = { id: 5, username: 'sam' };
    const token = signSessionToken(payload);
    const cookieHeader = createSessionCookie(token);

    expect(cookieHeader).toContain('chat_session=');
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('Path=/');

    // Extraction depuis l'en-tête Cookie
    const user = getSessionFromCookieHeader(cookieHeader);
    expect(user).not.toBeNull();
    expect(user?.id).toBe(5);
    expect(user?.username).toBe('sam');
  });
});
