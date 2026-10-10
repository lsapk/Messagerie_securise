# Directives de Sécurité Non-Négociables (OWASP & Best Practices)

Chaque fonctionnalité produite doit respecter scrupuleusement ces 6 règles de sécurité :

## 1. Isolation des données & RLS (Row Level Security)
- Toute requête en base de données doit être explicitement filtrée par l'identifiant de l'utilisateur connecté (`user_id`).
- Si une base SQL (ex. Supabase/PostgreSQL) est utilisée, active systématiquement les politiques RLS sur CHAQUE table.

## 2. Validation Côté Serveur (Server-Side)
- **Jamais de confiance aveugle au Frontend** : Valide tous les formulaires et payloads d'API côté serveur avec un schéma strict (ex. Zod, Pydantic).
- Sanitise les entrées utilisateurs pour prévenir les injections SQL et XSS.

## 3. Gestion Strictement Serveur des Secrets
- Aucune clé API secrète, jeton ou mot de passe ne doit figurer dans le code source ou être exposé côté client.
- Utilise exclusivement des variables d'environnement (`.env`) lues côté backend.

## 4. Contrôle d'Accès & Authentification
- Vérifie la session active ET le rôle (RBAC) sur toutes les routes sensibles, server actions et endpoints d'API.
- Bloque par défaut tout accès non explicité.

## 5. Rate Limiting & Protection API
- Implémente un rate-limiting sur tous les endpoints critiques (authentification, paiement, appels d'IA, formulaires publics) pour éviter le spam et l'épuisement de budget.

## 6. Checklist d'Audit Rapide à Exécuter
Avant de valider un module, réponds à ces 5 points :
[ ] Un utilisateur A peut-il voir/modifier les données de l'utilisateur B en changeant une ID dans l'URL/payload ?
[ ] Des clés secrètes sont-elles visibles dans le bundle client ?
[ ] La validation des données est-elle exécutée sur le serveur ?
[ ] Les erreurs renvoyées au client masquent-elles les détails sensibles d'infrastructure ?
[ ] Les routes d'administration vérifient-elles le rôle de l'utilisateur ?