# Fix DVC Graph Status and Ordering [SOLVED]

## 1. Contexte & Discussion (Narratif)

L'utilisateur a signalé deux problèmes majeurs dans dvc-viewer pendant l'exécution d'un `dvc repro` :
1. **Couleurs faussées** : Des stages terminées avec succès apparaissent en jaune ("needs rerun") au lieu de vert ("valid").
2. **Ordre sidebar illogique** : Le stage "running" peut apparaître après des stages "needs rerun".

### Analyse (Architecte)
- La CLI DVC (`dvc status --json`, `dvc repro --dry`) est **inutilisable** pendant un run car le lock est tenu.
- Le fichier `dvc.lock` (YAML) est cependant **lisible à tout moment** et **mis à jour incrémentalement** par DVC après chaque stage terminée avec succès.
- Le fichier `.dvc/tmp/rwlock` (JSON) donne les fichiers read/write-lockés avec leurs PIDs — source exacte du stage en cours.

### Décision clé (demande User)
> "On ne triche pas : on doit récupérer l'information et l'interpréter correctement, pas l'inférer !"

La stratégie retenue est de **lire directement `dvc.lock`** sur disque et de comparer les hash avec un snapshot pris au début du run.

## 2. Fichiers Concernés
- `dvc_viewer/parser.py` — Logique de `build_pipeline()`, `detect_running_stage()`, `pipeline_to_dict()`
- `dvc_viewer/static/index.html` — (éventuellement) Si le tri sidebar doit être modifié côté frontend

## 3. Objectifs (Definition of Done)

* **Lecture de `dvc.lock` sur disque** : Pendant un run, le système doit lire `dvc.lock` directement (YAML) au lieu de s'appuyer sur le cache `_last_dvc_status` ou un fallback aveugle.
* **Snapshot & Diff** : Au début d'un run détecté, capturer le contenu de `dvc.lock`. À chaque poll, comparer le `dvc.lock` actuel avec le snapshot pour identifier les stages freshly completed (→ `valid`).
* **État exact** : Les stages terminées dans le run courant doivent être vertes, le stage en cours bleu, les stages en attente jaunes. Aucune inférence.
* **Tri sidebar corrigé** : L'ordre topologique de la sidebar reflète la réalité de l'exécution grâce à un `state_priority` affiné (`running` > `failed` > `needs_rerun` > `never_run` > `valid`).
* **Tests** : Tests unitaires ajoutés dans `tests/test_dvc_fix.py` validant tous les scénarios (snapshot, late join, tri).
