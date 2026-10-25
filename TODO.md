# Suivi Nexora Pay

- [x] Backend Express Node 20+, route `/health`, service statique et démarrage Railway.
- [x] Pays, indicatifs, longueurs, normalisation internationale et règle Gabon limitée aux préfixes 6/7.
- [x] Authentification bcrypt coût 12, JWT 24 h en cookie httpOnly, erreurs génériques et blocage après cinq échecs.
- [x] Ledger PostgreSQL comme source unique du solde, références uniques, transactions et contrôles de minimum/frais.
- [x] Inscription, connexion, déconnexion, profil, portefeuille et 20 opérations.
- [x] Lookup destinataire puis envoi interne avec double écriture dans une transaction.
- [x] Recharge E-Billing LAB, OAuth2 caché, push USSD, webhook contrôlé et état consultable.
- [x] Retrait SHAP derrière `SHAP_ENABLED=false`, sans faux succès en LAB.
- [x] Interface HTML/CSS/JS mobile-first sombre et orange, écrans demandés.
- [x] Tests de frais, solde, insuffisance, idempotence de webhook et scénarios SIMU.
- [ ] TODO : faire confirmer les textes juridiques, la grille tarifaire réelle, le KYC et les règles de signature webhook.
- [ ] TODO : activer SHAP et migrer vers les identifiants/URLs de production après validation Digitech.
