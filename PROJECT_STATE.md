# État Global du Projet

## 1. Vision & Objectif
- **Nom du projet** : Messagerie Privée Auto-Hébergée (MonChat)
- **Description rapide** : Application de messagerie instantanée privée en duo / cercle restreint, installable comme PWA sur iOS et Android, avec notifications Web Push VAPID, synchronisation WebSocket en temps réel, souveraineté complète des données (SQLite locale + médias sur disque hôte) et tunnel Cloudflare sécurisé sans ouverture de port.

## 2. Stack Technique Active
- **Frontend** : Next.js 15 (App Router), React 19, Tailwind CSS, Lucide React, Service Worker PWA (`sw.js` + `manifest.json`).
- **Backend / Serveur** : Node.js HTTP Server personnalisé (`src/server.ts`) unifié avec serveur WebSocket natif (`ws` sur `/ws`) et requêtes Next.js.
- **Database & Stockage** : SQLite local (`better-sqlite3`, WAL mode, intégrité référentielle, index), stockage local des photos dans `./uploads`.
- **Notifications & Push** : Module officiel `web-push` avec protocole VAPID pour réveil de smartphone (APNs Apple & FCM Google).
- **Validation / Sécurité** : Zod (validation stricte côté serveur), Bcrypt (hachage des mots de passe cost 12), JWT en cookie HTTP-only `SameSite=Lax`, limitation de débit (rate-limiting), protection contre le path-traversal sur les médias.
- **Déploiement** : Dockerfile multi-stage, `docker-compose.yml` couplé avec le démon `cloudflare/cloudflared`.

## 3. Architecture & Base de Données
- **Tables principales** :
  - `users` : (id, username, password_hash, created_at)
  - `messages` : (id, sender_id, recipient_id, content, media_path, created_at)
  - `push_subscriptions` : (id, user_id, endpoint, p256dh, auth, created_at)
- **Dossiers de stockage** :
  - `./data/chat.db` : Fichier de base de données SQLite.
  - `./uploads/` : Fichiers images HD enregistrés sous UUID unique.

## 4. Fonctionnalités Implémentées
- [x] Authentification & Gestion des sessions (Login, Logout, Cookie HTTP-only, Rate Limiting).
- [x] Messagerie temps réel bidirectionnelle via WebSocket (`ws://` ou `wss://` sur `/ws`).
- [x] Indicateur de présence (en ligne / hors ligne) et indicateur de saisie en direct.
- [x] Partage de photos HD (Upload sécurisé, validation MIME, prévisualisation, Lightbox plein écran).
- [x] PWA complète : `manifest.json`, Service Worker `sw.js`, icônes 192x192 & 512x512.
- [x] Module Web Push VAPID : script de génération de clés, souscription client, dispatch automatique dès qu'un destinataire n'est pas actif sur le WebSocket.
- [x] Dockerfile multi-stage et `docker-compose.yml` avec service `cloudflared`.
- [x] Scripts utilitaires : `npm run seed` (utilisateurs de test), `npm run vapid:generate` (générateur de clés).
- [x] Suite complète de tests unitaires et d'intégration Vitest (24 tests validés avec succès).
- [x] Vérification de typage TypeScript strict sans erreur (`tsc --noEmit`).

## 5. Dette Technique & Points d'Attention
- [x] Isolation des conversations : un utilisateur ne lit plus l’historique global ni les médias des autres fils.
- [x] WebSocket : reconnexion stoppée à la déconnexion ; les upgrades Next.js (HMR) ne sont plus détruits.
- [x] Destinataire obligatoire côté Zod / WS / REST ; sélecteur de contact si plusieurs utilisateurs.
- [ ] En production avec Cloudflare Tunnel, renseigner `TUNNEL_TOKEN` puis lancer `docker compose --profile tunnel up -d`.
- [ ] Sur iOS (Safari), ajouter l’app à l’écran d’accueil pour autoriser Web Push.
- [ ] `SESSION_SECRET` dans `.env` est encore un placeholder : le remplacer avant un déploiement public.
- [ ] Des utilisateurs de test (`alice`, `bob`) existent dans `data/chat.db` suite aux anciens tests ; le sélecteur de contact permet de choisir `utilisateur2`.
- [ ] Pas encore de suite E2E Playwright (auth + envoi de message).

## 6. Prochaines Étapes
1. Lancer l'application en local via `npm run dev` (après `npm run seed` si la base est vide).
2. Déployer sur Docker : `docker compose up -d` (app seule) ou `docker compose --profile tunnel up -d` avec Cloudflare.