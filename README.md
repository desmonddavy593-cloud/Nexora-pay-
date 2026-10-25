# Nexora Pay

Portefeuille électronique multi-pays en environnement LAB. Le solde est calculé exclusivement à partir du journal `ledger`; E-Billing/SHAP ne stockent pas les soldes.

## Installation locale

```bash
cp .env.example .env
npm install
# créer la base PostgreSQL puis appliquer db/migrations/001_initial.sql
npm test
npm start
```

L'application écoute sur `PORT` (3000 par défaut). Vérification : `GET /health`.

## Variables d'environnement

Voir `.env.example`. Les secrets `JWT_SECRET`, identifiants E-Billing/SHAP et `DATABASE_URL` doivent être injectés hors Git. `SHAP_ENABLED=false` par défaut. Les coûts provisoires sont `FRAIS_TAUX=0.01` et `FRAIS_MINIMUM=100`.

## Tests

`npm test` couvre le calcul des frais, le solde ledger, l'insuffisance de solde, l'idempotence du webhook et les cinq scénarios SIMU.

## SIMU LAB

- `077000001` ou `066000001` : succès ;
- `077010001` ou `066010001` : échec ;
- `077210001` ou `066210001` : expiration différée ;
- `077000077` ou `066000066` : ambigu, conservé en attente ;
- autre numéro : introuvable.

## Railway

1. Connecter le dépôt GitHub `desmonddavy593-cloud/Nexora-pay-` et la branche `main`.
2. Ajouter PostgreSQL et exécuter la migration SQL.
3. Renseigner les variables de `.env.example` dans Railway, sans commiter de secret.
4. Utiliser `npm start` (ou le `Procfile`) et vérifier `/health`.
5. Garder les URLs LAB et `SHAP_ENABLED=false` jusqu'à validation Digitech.

## État de l'intégration

Les appels OAuth2 E-Billing et SHAP sont isolés dans `src/providers.js`. Aucun succès n'est simulé par l'interface : sans configuration opérateur, les demandes sont refusées ou affichées en attente. Le webhook E-Billing vérifie la référence, le montant et l'idempotence. TODO : signature de webhook et règles KYC à confirmer avec Digitech.
