import dotenv from 'dotenv';
dotenv.config();

import { initDb, syncUsers } from '../src/libs/db';
import { hashPassword } from '../src/libs/auth';

async function seed() {
  initDb();

  const defaultUsers = [
    { username: 'Romane_C', password: 'romane123', migrateFrom: 'utilisateur1' },
    { username: 'Leny_G', password: 'leny123', migrateFrom: 'utilisateur2' },
  ];

  const users = await Promise.all(
    defaultUsers.map(async ({ username, password, migrateFrom }) => ({
      username,
      migrateFrom,
      passwordHash: await hashPassword(password),
    }))
  );
  syncUsers(users);

  console.log('Les comptes Romane_C et Leny_G sont prêts. Les autres comptes ont été supprimés.');
}

seed().catch((err) => {
  console.error('Erreur lors du seed:', err);
  process.exit(1);
});
