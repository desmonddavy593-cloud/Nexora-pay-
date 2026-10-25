# Suivi Nexora Pay

- [x] Backend Express Node 20+, route `/health`, service statique et démarrage Railway.
- [x] Pays, indicatifs, longueurs, normalisation internationale et règle Gabon limitée aux préfixes 6/7.
- [x] Authentification bcrypt coût 12, JWT 24 h en cookie httpOnly, erreurs génériques et blocage après cinq échecs.
- [x] Refus du démarrage en production si `JWT_SECRET` manque ou contient moins de 32 caractères.
- [x] Ledger PostgreSQL comme source unique du solde, références uniques, transactions et contrôles de minimum/frais.
- [x] Envoi à soi-même refusé avant toute écriture.
- [x] Recharge E-Billing avec email obligatoire, montant brut montant+frais, frais exposés et SIMU envoyé par HTTP E-Billing hors production.
- [x] Webhook protégé par secret constant-time, vérification de facture E-Billing, statut payé strict et idempotence.
- [x] Retrait SHAP débité dans le ledger avant appel, avec régularisation atomique en cas d'échec.
- [x] Client SHAP utilisant `access_token` et `expires_in`.
- [x] Interface HTML/CSS/JS mobile-first sombre et orange, écrans demandés.
- [x] Tests de frais, solde, webhook non authentifié, démarrage production et appels SIMU mockés.
- [ ] TODO : faire confirmer par Digitech la valeur exacte de `EBILLING_PAID_STATE` et le format de signature webhook éventuel.
- [ ] TODO : activer SHAP et migrer vers les identifiants/URLs de production après validation Digitech.
- [ ] TODO : KYC, agréments, textes juridiques et grille tarifaire réelle.
