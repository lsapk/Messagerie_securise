import webpush from 'web-push';
import fs from 'node:fs';
import path from 'node:path';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('--- Nouvelles Clés VAPID Générées ---');
console.log('Public Key:');
console.log(vapidKeys.publicKey);
console.log('\nPrivate Key:');
console.log(vapidKeys.privateKey);
console.log('-------------------------------------\n');

const envPath = path.resolve(process.cwd(), '.env');
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf-8');
} else {
  const examplePath = path.resolve(process.cwd(), '.env.example');
  if (fs.existsSync(examplePath)) {
    envContent = fs.readFileSync(examplePath, 'utf-8');
  }
}

// Remplacer ou ajouter les clés VAPID
if (envContent.includes('VAPID_PUBLIC_KEY=')) {
  envContent = envContent.replace(/VAPID_PUBLIC_KEY=.*/g, `VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
  envContent = envContent.replace(/VAPID_PRIVATE_KEY=.*/g, `VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
} else {
  envContent += `\nVAPID_PUBLIC_KEY=${vapidKeys.publicKey}\nVAPID_PRIVATE_KEY=${vapidKeys.privateKey}\n`;
}

fs.writeFileSync(envPath, envContent, 'utf-8');
console.log('Fichier .env mis à jour avec succès avec les nouvelles clés VAPID !');
