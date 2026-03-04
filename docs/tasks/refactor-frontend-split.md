# Refactoring Front-End : Split `index.html`

## 1. Contexte & Discussion (Narratif)
> Le fichier `dvc_viewer/static/index.html` a dépassé les **4000 lignes** et **159 Ko**. Il contient l'intégralité du HTML, du CSS et du JavaScript de l'application dans un seul fichier monolithique. Ce mélange de responsabilités rend la maintenance difficile, empêche toute testabilité front-end, et augmente le risque de régressions à chaque ajout de fonctionnalité (comme le futur support multi-projets).
>
> La dette a été identifiée lors de la revue architecturale post-implémentation de la feature `--keep-going` (mars 2026).

## 2. Fichiers Concernés
- `dvc_viewer/static/index.html` (fichier source unique à éclater)
- `dvc_viewer/static/style.css` (nouveau)
- `dvc_viewer/static/js/graph.js` (nouveau — logique Cytoscape)
- `dvc_viewer/static/js/api.js` (nouveau — SSE, fetch, communication serveur)
- `dvc_viewer/static/js/ui.js` (nouveau — modals, toasts, sidebar, filtres)
- `dvc_viewer/server.py` (vérifier le serving des nouveaux fichiers statiques)

## 3. Objectifs (Definition of Done)
* Le fichier `index.html` ne contient que la **structure HTML** et les `<link>`/`<script>` vers les fichiers externes.
* Le CSS est dans un ou plusieurs fichiers `.css` dédiés.
* Le JavaScript est séparé en modules logiques (`graph.js`, `api.js`, `ui.js` au minimum).
* **Aucune régression fonctionnelle** : toutes les features existantes (SSE, filtres, run, inspection, etc.) sont préservées.
* Le serving des fichiers statiques via FastAPI reste fonctionnel.
