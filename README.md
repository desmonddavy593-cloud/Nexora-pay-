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

Les variables complètes sont dans `.env.example`. Les secrets `JWT_SECRET`, `EBILLING_CLIENT_ID`, `EBILLING_CLIENT_SECRET`, `EBILLING_WEBHOOK_SECRET`, `SHAP_API_ID` et `SHAP_API_SECRET` doivent être injectés hors Git, par exemple dans Railway. En production, `JWT_SECRET` doit contenir au moins 32 caractères. `SHAP_ENABLED=false` par défaut.

`EBILLING_CALLBACK_URL` doit être une URL HTTPS publique dont le paramètre `token` contient la même valeur privée que `EBILLING_WEBHOOK_SECRET`, par exemple `https://example.invalid/api/webhooks/ebilling?token=...`. Ne communiquez jamais cette URL complète dans un dépôt ou un ticket public. Le statut exact payé doit être fourni par Digitech via `EBILLING_PAID_STATE`; tant qu'il n'est pas renseigné, le webhook refuse de créditer.

## Tests

`npm test` couvre les frais, le solde ledger, le minimum, la normalisation, l'authentification du webhook, le démarrage production sans JWT, et vérifie que le scénario SIMU passe réellement par les appels HTTP E-Billing mockés. Le paiement LAB réel et la valeur du statut payé dépendent encore de Digitech.

## SIMU LAB

SIMU est autorisé uniquement hors production et est envoyé à E-Billing comme `payment_system_name=SIMU`. Les numéros de scénario sont routés par le simulateur E-Billing : `077000001`/`066000001` succès, `077010001`/`066010001` échec, `077210001`/`066210001` expiration, `077000077`/`066000066` ambigu et tout autre numéro introuvable.

## Frais de recharge

L'utilisateur paie `montant + frais` à E-Billing. Le portefeuille est crédité du seul montant demandé. Le webhook compare donc le montant brut reçu à `montant + frais`, et les frais sont renvoyés par les routes de recharge.

## Railway

Connecter `desmonddavy593-cloud/Nexora-pay-` sur `main`, ajouter PostgreSQL, appliquer la migration SQL, puis renseigner les variables privées de `.env.example`. Utiliser `npm start` et vérifier `/health`. Conserver les URLs LAB et `SHAP_ENABLED=false` jusqu'à validation Digitech.

## État de l'intégration

Les appels OAuth2 E-Billing et SHAP sont isolés dans `src/providers.js`. Aucun succès n'est simulé par l'interface. Les webhooks exigent le secret privé, vérifient la facture auprès d'E-Billing et créditent une seule fois. Les retraits débitent le ledger avant l'appel SHAP et créent une régularisation en cas d'échec. TODO : confirmation du statut payé et éventuel format de signature Digitech, KYC et grille tarifaire réelle.

## Statuts E-Billing non payés

Le callback authentifié met à jour une recharge en `failed`, `expired` ou `ambiguous` lorsque le statut confirmé par E-Billing correspond à la constante configurée. Aucun crédit ledger n'est créé et la réponse est HTTP 200. Un statut inconnu reste en HTTP 422. Les valeurs exactes doivent être confirmées par Digitech et renseignées dans `EBILLING_*_STATE`.

Pour une recharge réelle, le numéro local commençant par 7 exige `airtelmoney` et celui commençant par 6 exige `moovmoney4`. SIMU reste disponible hors production et passe par les appels HTTP E-Billing mockés dans les tests.
