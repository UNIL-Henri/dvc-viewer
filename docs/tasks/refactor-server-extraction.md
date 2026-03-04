# Refactoring Backend : Extraction de logique du `server.py`

## 1. Contexte & Discussion (Narratif)
> Le fichier `server.py` approche les **900 lignes** et mélange plusieurs responsabilités : routage FastAPI, logique SSE (parsing de stdout DVC avec regex), et résolution de configurations Hydra. Ce couplage rend les tests unitaires complexes et augmente le risque de régressions lors d'ajouts futurs.
>
> Identifié lors de la revue architecturale de mars 2026.

## 2. Fichiers Concernés
- `dvc_viewer/server.py` (fichier source à alléger)
- `dvc_viewer/hydra_utils.py` (nouveau — logique `_resolve_hydra_defaults`, `_apply_params`, etc.)
- `dvc_viewer/executor.py` (nouveau — générateur SSE, parsing de `dvc repro` stdout)
- `dvc_viewer/dvc_client.py` (potentiellement enrichi si le SSE parsing y est déplacé)

## 3. Objectifs (Definition of Done)
* `server.py` ne contient que le **routage FastAPI** (définition des endpoints, validation des requêtes, appel aux modules métier).
* La logique Hydra complexe est dans un module dédié (`hydra_utils.py`).
* Le générateur SSE et le parsing regex des sorties `dvc repro` sont dans un module séparé (`executor.py` ou extension de `dvc_client.py`).
* **Aucune régression fonctionnelle** sur les endpoints existants (`/api/run`, `/api/run-stream`, `/api/pipeline`, `/api/config`, etc.).
* Le fichier `server.py` passe sous les **300 lignes**.
