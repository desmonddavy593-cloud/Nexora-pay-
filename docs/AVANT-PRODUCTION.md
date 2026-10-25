# Avant-production

Nexora Pay est livré en environnement LAB uniquement. Avant tout lancement réel, il faut :

- obtenir les agréments réglementaires applicables et définir le responsable conformité ;
- implémenter le KYC, la lutte anti-fraude et la conservation légale des données ;
- faire valider les conditions d'utilisation, la politique de confidentialité et la politique de remboursement ;
- remplacer les valeurs provisoires par une grille tarifaire réelle (`FRAIS_TAUX`, `FRAIS_MINIMUM`) ;
- obtenir l'activation SHAP et positionner `SHAP_ENABLED=true` seulement après validation ;
- basculer vers les URLs, identifiants et callback HTTPS de production Digitech Africa ;
- configurer les secrets Railway hors du dépôt, sauvegardes PostgreSQL, alertes et rotation des secrets ;
- faire auditer les flux financiers, les webhooks et les procédures de rapprochement ;
- ajouter la vérification de signature/authenticité du webhook si elle est fournie par Digitech ;
- effectuer un test de charge, un test de reprise et une validation juridique des pays supportés.

TODO : la tarification, le texte contractuel et les règles KYC exactes restent à confirmer.
