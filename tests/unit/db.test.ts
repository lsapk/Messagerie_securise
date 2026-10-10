import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  initDb,
  createUser,
  getUserByUsername,
  getUserById,
  createMessage,
  getConversationMessages,
  canUserAccessMediaPath,
  upsertPushSubscription,
  getPushSubscriptionsForUser,
  getPushSubscriptionsExcludingUser,
  deletePushSubscription,
  closeDb,
} from '../../src/libs/db';

const TEST_DB_PATH = path.resolve(process.cwd(), './data/test-chat.db');

describe('Couche Base de Données SQLite', () => {
  beforeAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch {}
    }
    initDb(TEST_DB_PATH);
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch {}
    }
  });

  it('doit créer et récupérer des utilisateurs', () => {
    const user1 = createUser('alice', 'fakehash1');
    const user2 = createUser('bob', 'fakehash2');

    expect(user1.id).toBeDefined();
    expect(user1.username).toBe('alice');

    const fetched = getUserByUsername('alice');
    expect(fetched?.id).toBe(user1.id);
    expect(fetched?.password_hash).toBe('fakehash1');

    const fetchedById = getUserById(user2.id);
    expect(fetchedById?.username).toBe('bob');
  });

  it('doit enregistrer et lister les messages dans l’ordre chronologique', () => {
    const user1 = getUserByUsername('alice')!;
    const user2 = getUserByUsername('bob')!;

    const msg1 = createMessage(user1.id, user2.id, 'Bonjour Bob !', null);
    const msg2 = createMessage(user2.id, user1.id, 'Salut Alice !', null);
    const msg3 = createMessage(user1.id, user2.id, null, '/api/uploads/photo.jpg');

    expect(msg1.sender_username).toBe('alice');
    expect(msg3.media_path).toBe('/api/uploads/photo.jpg');

    const recent = getConversationMessages(user1.id, user2.id, 10);
    expect(recent.length).toBeGreaterThanOrEqual(3);
    const lastThree = recent.slice(-3);
    expect(lastThree[0].content).toBe('Bonjour Bob !');
    expect(lastThree[1].content).toBe('Salut Alice !');
    expect(lastThree[2].media_path).toBe('/api/uploads/photo.jpg');
  });

  it('ne doit pas exposer les messages d’une autre conversation', () => {
    const alice = getUserByUsername('alice')!;
    const bob = getUserByUsername('bob')!;
    const charlie = createUser('charlie', 'fakehash3');

    createMessage(alice.id, charlie.id, 'Secret pour Charlie', null);

    const aliceBob = getConversationMessages(alice.id, bob.id, 50);
    expect(aliceBob.some((message) => message.content === 'Secret pour Charlie')).toBe(false);

    const aliceCharlie = getConversationMessages(alice.id, charlie.id, 50);
    expect(aliceCharlie.some((message) => message.content === 'Secret pour Charlie')).toBe(true);

    expect(canUserAccessMediaPath(alice.id, '/api/uploads/photo.jpg')).toBe(true);
    expect(canUserAccessMediaPath(charlie.id, '/api/uploads/photo.jpg')).toBe(false);
  });

  it('doit gérer les souscriptions Web Push (upsert et suppression)', () => {
    const user1 = getUserByUsername('alice')!;
    const user2 = getUserByUsername('bob')!;

    const endpoint = 'https://push.example.com/sub/12345';
    upsertPushSubscription(user1.id, endpoint, 'key-p256', 'key-auth');

    const subsUser1 = getPushSubscriptionsForUser(user1.id);
    expect(subsUser1.length).toBe(1);
    expect(subsUser1[0].endpoint).toBe(endpoint);

    // Récupération pour tous les autres utilisateurs
    const subsOthers = getPushSubscriptionsExcludingUser(user2.id);
    expect(subsOthers.some((s) => s.endpoint === endpoint)).toBe(true);

    // Suppression de l'endpoint
    deletePushSubscription(endpoint);
    const subsAfterDelete = getPushSubscriptionsForUser(user1.id);
    expect(subsAfterDelete.length).toBe(0);
  });
});
