import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface Message {
  id: number;
  sender_id: number;
  recipient_id: number | null;
  content: string | null;
  media_path: string | null;
  created_at: string;
}

export interface MessageWithSender extends Message {
  sender_username: string;
}

export interface PushSubscriptionRow {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

let dbInstance: Database.Database | null = null;

export function getDatabasePath(): string {
  const envUrl = process.env.DATABASE_URL || './data/chat.db';
  if (envUrl.startsWith('file:')) {
    return envUrl.replace('file:', '');
  }
  return envUrl;
}

export function initDb(customPath?: string): Database.Database {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const dbPath = customPath || getDatabasePath();
  const dbDir = path.dirname(path.resolve(dbPath));

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Performance et intégrité relationnelle
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Création des tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      content TEXT,
      media_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
    CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
  `);

  if (dbInstance && dbInstance !== db) {
    try {
      dbInstance.close();
    } catch {}
  }
  dbInstance = db;
  return db;
}

export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    return initDb();
  }
  return dbInstance;
}

// Fonctions Utilisateurs
export function getUserByUsername(username: string): User | undefined {
  const stmt = getDb().prepare<[string], User>('SELECT * FROM users WHERE username = ?');
  return stmt.get(username);
}

export function getUserById(id: number): User | undefined {
  const stmt = getDb().prepare<[number], User>('SELECT * FROM users WHERE id = ?');
  return stmt.get(id);
}

export function getAllUsers(): Array<Omit<User, 'password_hash'>> {
  const stmt = getDb().prepare<[], Omit<User, 'password_hash'>>('SELECT id, username, created_at FROM users ORDER BY username ASC');
  return stmt.all();
}

export function createUser(username: string, passwordHash: string): User {
  const stmt = getDb().prepare<[string, string]>(
    'INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING *'
  );
  return stmt.get(username, passwordHash) as User;
}

// Fonctions Messages
export function createMessage(
  senderId: number,
  recipientId: number | null,
  content: string | null,
  mediaPath: string | null
): MessageWithSender {
  const insertStmt = getDb().prepare<[number, number | null, string | null, string | null]>(
    'INSERT INTO messages (sender_id, recipient_id, content, media_path) VALUES (?, ?, ?, ?) RETURNING *'
  );
  const inserted = insertStmt.get(senderId, recipientId, content, mediaPath) as Message;
  const user = getUserById(senderId);
  return {
    ...inserted,
    sender_username: user ? user.username : 'Inconnu',
  };
}

export function getConversationMessages(
  userId: number,
  peerId: number,
  limit = 100,
  beforeId?: number
): MessageWithSender[] {
  if (beforeId) {
    const stmt = getDb().prepare<[number, number, number, number, number, number], MessageWithSender>(`
      SELECT m.*, u.username as sender_username
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id < ?
        AND (
          (m.sender_id = ? AND m.recipient_id = ?)
          OR (m.sender_id = ? AND m.recipient_id = ?)
        )
      ORDER BY m.id DESC
      LIMIT ?
    `);
    const results = stmt.all(beforeId, userId, peerId, peerId, userId, limit);
    return results.reverse();
  }

  const stmt = getDb().prepare<[number, number, number, number, number], MessageWithSender>(`
    SELECT m.*, u.username as sender_username
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE
      (m.sender_id = ? AND m.recipient_id = ?)
      OR (m.sender_id = ? AND m.recipient_id = ?)
    ORDER BY m.id DESC
    LIMIT ?
  `);
  const results = stmt.all(userId, peerId, peerId, userId, limit);
  return results.reverse();
}

export function canUserAccessMediaPath(userId: number, mediaPath: string): boolean {
  const stmt = getDb().prepare<[string, number, number]>(
    `SELECT 1 as ok
     FROM messages
     WHERE media_path = ?
       AND (sender_id = ? OR recipient_id = ?)
     LIMIT 1`
  );
  return Boolean(stmt.get(mediaPath, userId, userId));
}

// Fonctions Push Subscriptions
export function upsertPushSubscription(
  userId: number,
  endpoint: string,
  p256dh: string,
  auth: string
): void {
  const stmt = getDb().prepare<[number, string, string, string]>(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      created_at = CURRENT_TIMESTAMP
  `);
  stmt.run(userId, endpoint, p256dh, auth);
}

export function getPushSubscriptionsForUser(userId: number): PushSubscriptionRow[] {
  const stmt = getDb().prepare<[number], PushSubscriptionRow>(
    'SELECT * FROM push_subscriptions WHERE user_id = ?'
  );
  return stmt.all(userId);
}

export function getPushSubscriptionsExcludingUser(excludeUserId: number): PushSubscriptionRow[] {
  const stmt = getDb().prepare<[number], PushSubscriptionRow>(
    'SELECT * FROM push_subscriptions WHERE user_id != ?'
  );
  return stmt.all(excludeUserId);
}

export function deletePushSubscription(endpoint: string): void {
  const stmt = getDb().prepare<[string]>('DELETE FROM push_subscriptions WHERE endpoint = ?');
  stmt.run(endpoint);
}
