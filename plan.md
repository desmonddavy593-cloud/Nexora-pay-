# Nexora Pay — plan

## Approche
Backend Node.js 20/Express avec PostgreSQL paramétré, ledger comme source unique du solde, transactions SQL verrouillées pour les mouvements concurrents, intégration E-Billing/SHAP derrière des variables d'environnement et drapeaux LAB. Frontend HTML/CSS/JS sans framework, servi par Express.

## Structure
- `src/`: serveur, configuration, domaine, DB, intégrations et routes.
- `public/`: pages mobile-first, styles et appels API.
- `db/migrations/`: schéma PostgreSQL.
- `tests/`: tests de domaine et API.
- `docs/`: limites avant production.

## Design choisi — confiance nocturne
Probabilité 0,07 : interface fintech sombre, mobile-first, avec orange Nexora comme signal d'action.

Principes : lisibilité immédiate, surfaces élevées, états d'opération explicites, aucune promesse de succès avant confirmation backend.
Palette : bleu nuit `#0f172a`/`#1e293b` pour la confiance, orange `#f97316` pour les actions, vert réservé aux confirmations.
Mise en page : contenu centré de 480px, cartes empilées, barre de navigation fixe.
Signature : motif de halo orange, cartes à bordure fine, montants en chiffres larges.
Interaction : chaque mouvement affiche son montant, ses frais et son état ; les boutons dangereux demandent une confirmation serveur.
Typographie : system-ui, titres courts et microcopy directe.
Voix : sobre, rassurante, explicite. Exemple : « Votre solde vient du journal sécurisé. » / « Validez la demande sur votre téléphone. »
Marque : monogramme N en deux arcs, évoqué par le logo texte `N` dans l'interface.

## Provisoires
La grille tarifaire et les textes juridiques sont marqués TODO. Aucun secret réel n'est commité.
