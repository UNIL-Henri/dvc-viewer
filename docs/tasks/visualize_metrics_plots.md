# Visualisation des Métriques et Graphes Non Cachés avec Fallback Git

## 1. Contexte & Discussion (Narratif)
> L'utilisateur a récemment configuré son système de CI hybride (Cluster-CI) pour que les métriques et les graphes de DVC soient synchronisés séparément dans Git (car ils portent la directive `{cache: false}`). En conséquence, ces fichiers n'existent pas localement sur le disque dans le Working tree, ce qui provoquait une erreur "File not found" lors de la tentative de visualisation dans l'inspecteur de fichiers de `dvc-viewer`. L'objectif est de permettre un affichage prioritaire et transparent de ces métriques et graphes tout en haut de la sidebar des détails de stage, avec un fallback automatique vers leur version Git historique (commit Git connu le plus récent) si le fichier est absent du Working tree.

## 2. Fichiers Concernés
- `dvc_viewer/static/index.html` : Réorganisation de l'affichage de la sidebar pour prioriser "Metrics" et "Plots" et logique JavaScript de fallback automatique vers Git pour les fichiers absents localement.
- `dvc_viewer/server.py` : Améliorations de robustesse et décodages UTF-8 pour la compatibilité Windows lors des appels système Git et Python.
- `tests/test_hooks.py` : Correction d'échappement pour les tests sous Windows.

## 3. Objectifs (Definition of Done)
* **Priorisation visuelle** : Les sections `Metrics` et `Plots` s'affichent tout en haut des détails du stage dans la sidebar, au-dessus des dépendances et des sorties standard.
* **Fallback Git transparent** : L'inspecteur de fichiers s'ouvre sur le commit Git le plus récent (index 0 de l'historique) de manière automatique et transparente sans crash si le fichier n'est pas présent localement sur le disque.
* **Sécurisation de la navigation** : Le bouton de retour vers le Working tree ("Next") est désactivé si le fichier n'est pas présent localement, empêchant toute tentative d'ouverture d'un fichier manquant.
* **Robustesse multi-plateforme** : Le système fonctionne parfaitement sous Windows sans erreurs d'encodage (UTF-8 activé pour toutes les commandes système et lectures de fichiers).
