# DVC `--keep-going` Mode & Failed Status

## 1. Contexte & Discussion (Narratif)
> L'utilisateur a demandé d'ajouter le flag `--keep-going` à la commande lancée par le bouton "Run All". L'objectif est de permettre au pipeline de continuer son exécution même si certains stages échouent, tout en s'assurant que ces échecs sont clairement identifiés (en rouge) dans l'interface.

Historiquement, `dvc-viewer` s'arrêtait au premier échec car c'est le comportement par défaut de `dvc repro`. Avec des pipelines longs et des branches indépendantes, ce comportement était frustrant.

## 2. Fichiers Concernés
- `dvc_viewer/dvc_client.py` : Ajout du flag à la structure de commande.
- `dvc_viewer/server.py` : Gestion de la collecte de multiples stages échoués via SSE.
- `dvc_viewer/static/index.html` : Mise à jour du toast final pour lister tous les échecs.

## 3. Objectifs (Definition of Done)
* **Continuité d'exécution** : Le bouton "Run All" lance maintenant `dvc repro --keep-going`.
* **Collecte Multi-Échecs** : Le serveur ne s'arrête plus de parser le stream après un `failed to reproduce` et accumule les stages échoués.
* **Visibilité Rouge** : Les stages échoués s'affichent correctement en rouge (via `_failed_stages` dans le backend et `STATE_COLORS.failed` dans le frontend).
* **Feedback Utilisateur** : Le toast de fin liste explicitement tous les stages ayant échoué.
