import dotenv from 'dotenv';
dotenv.config();

import { initDb, createUser, getUserByUsername } from '../src/libs/db';
import { hashPassword } from '../src/libs/auth';

async function seed() {
  initDb();

  console.log('--- Initialisation des Utilisateurs par Défaut ---');

  const defaultUsers = [
    { username: 'utilisateur1', password: 'password123' },
    { username: 'utilisateur2', password: 'password123' },
  ];

  for (const u of defaultUsers) {
    const existing = getUserByUsername(u.username);
    if (!existing) {
      const hash = await hashPassword(u.password);
      const created = createUser(u.username, hash);
      console.log(`✅ Utilisateur créé : "${created.username}" (ID: ${created.id}) | Mot de passe : "${u.password}"`);
    } else {
      console.log(`ℹ️  Utilisateur "${u.username}" existe déjà (ID: ${existing.id}).`);
    }
  }

  console.log('--------------------------------------------------');
  console.log('Vous pouvez vous connecter avec ces identifiants pour tester la messagerie en duo !');
}

seed().catch((err) => {
  console.error('Erreur lors du seed:', err);
  process.exit(1);
});
