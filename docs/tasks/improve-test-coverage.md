# Compléter la couverture de tests (`dvc_client.py` & SSE)

## 1. Contexte & Discussion (Narratif)
> Bien que le projet compte 46 tests, les fonctions critiques `run_dvc_repro` et `start_dvc_repro` dans `dvc_client.py` ne sont **pas testées**. Le nouveau comportement `--keep-going` n'est donc pas couvert non plus. De même, le parsing SSE (regex matching des statuts dans le stream `dvc repro`) contient de la logique métier critique mais n'est testé qu'indirectement via des tests d'intégration manuels.
>
> Identifié lors de la revue architecturale de mars 2026.

## 2. Fichiers Concernés
- `tests/test_dvc_client.py` (enrichir avec des tests pour `run_dvc_repro`, `start_dvc_repro`)
- `tests/test_sse_parser.py` (nouveau — tests du parsing regex des sorties `dvc repro`)
- `dvc_viewer/dvc_client.py` (cible des tests)
- `dvc_viewer/server.py` (cible des tests SSE, ou le futur `executor.py` après refactoring)

## 3. Objectifs (Definition of Done)
* `run_dvc_repro` et `start_dvc_repro` sont testés unitairement avec `subprocess` mocké.
* Le flag `--keep-going` est vérifié : présent quand `keep_going=True`, absent sinon.
* Les regex du parseur SSE (`re_running`, `re_failed`, `re_failed2`, `re_cached`) sont testés avec des exemples réels de sorties `dvc repro`.
* Les cas limites sont couverts : multiple échecs, stages avec caractères spéciaux (`@`, `.`, `-`), annulation en cours de stream.
