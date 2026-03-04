# 🔍 DVC Viewer

> A modern, interactive web interface to visualize your DVC pipeline DAGs.

![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)
![License MIT](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Features

- **Interactive DAG** — Explore your pipeline as a navigable directed graph
- **Stage states** — See at a glance which stages are ✅ valid, 🔄 need rerun, or ⬜ never run
- **Precise Dependency Coloring** — 🎯 When a stage needs rerun, only the specific dependency that changed is highlighted yellow, not all dependencies. Missing files are red, unchanged files stay green.
- **Invalidation Diagnostic** — ⚠️ When a code change invalidates a stage, the console shows exactly which file changed and the **transitive import chain** responsible. Now with **Git Awareness**: alerts you if a file is not tracked by Git (the #1 cause of cross-PC invalidation).
- **Search & Filter** — Instantly find and filter stages by name or status (valid, changed, frozen, etc.).
- **Global Stage List** — View all stages in the sidebar, sorted by topological order with stable status-based prioritization (dirty stages first).
- **Progress Bar & ETA** — ⏱️ During `dvc repro`, a progress bar shows completed stages and estimated completion time based on average execution speed.
- **Frozen Status** — Visual indicators (❄️) for frozen stages.
- **One-click Navigation** — Click notifications or list items to zoom and center on any stage.
- **Smart Code Hashing** — 🧠 Only executable code changes trigger reruns. Comments, docstrings, and whitespace are ignored. Stable across Python versions (3.9+) via pure AST unparsing.
- **Symbol-Level Invalidation** — 🎯 If a script imports `foo` from `utils.py`, changing `bar` in `utils.py` will NOT invalidate the stage.
- **Click-to-inspect** — Click any node to view its command, dependencies, and outputs
- **Dark theme** — Sleek glassmorphism UI with smooth animations
- **Concurrent Robustness** — 🛡️ Zero-contention design prevents `rwlock` corruption by monitoring DVC state via the dedicated `dvc_client` module, which performs passive monitoring without triggering internal DVC write-locks.
- **Zero config** — Just run `dvc-viewer` inside any DVC project

## 🚀 Quick Install

```bash
curl -fsSL "https://raw.githubusercontent.com/hjamet/dvc-viewer/main/install.sh?$(date +%s)" | bash
```

This will:
1. Clone the repo to `~/.dvc-viewer`
2. Create an isolated Python virtual environment
3. Install the `dvc-viewer` command to `~/.local/bin`

## 📦 Manual Install

```bash
git clone https://github.com/hjamet/dvc-viewer.git ~/.dvc-viewer
cd ~/.dvc-viewer
python3 -m venv .venv
source .venv/bin/activate
pip install .
```

## 🎯 Usage

```bash
cd /path/to/your/dvc-project
dvc-viewer
```

The web interface opens automatically at [http://localhost:8686](http://localhost:8686).

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--port` | Server port | `8686` |
| `--no-open` | Don't auto-open browser | `false` |

## 🛠 Requirements
 
 - Python ≥ 3.9
 - DVC installed and accessible in `$PATH`
 - A project with a `dvc.yaml` file

## 🪝 Hooks

DVC-Viewer supports **project-level hooks** — scripts that run automatically after specific operations.

### `post_hash` hook

Create `.dvc-viewer/hooks/post_hash.py` in your project. It runs after every `dvc-viewer hash`.

```bash
mkdir -p .dvc-viewer/hooks
cat > .dvc-viewer/hooks/post_hash.py << 'EOF'
"""Example post_hash hook — runs after code hashing."""
print("✅ Post-hash hook executed!")
EOF
```

**Python resolution** — the hook runs with the project's Python, resolved in order:

1. Active virtualenv (`$VIRTUAL_ENV`)
2. Project venv (`.venv/`, `venv/`, `.env/`, `env/`)
3. System `python3`

**Error handling** — if the hook fails, a warning is printed but `dvc-viewer hash` always succeeds. Hooks never block the pipeline.

## 📚 Documentation Index

| Titre | Description |
|-------|-------------|
| [Index Tasks](docs/index_tasks.md) | Tâches planifiées et en cours |
| [Index Hashing](docs/index_hashing.md) | Mécanismes de hash, d'invalidation et portabilité |

## 📂 Plan du repo

```text
dvc-viewer/
├── dvc_viewer/
│   ├── dvc_client.py   # Interactions DVC (subprocess, rwlock, pgrep)
│   ├── git_client.py   # Interactions Git (log, show)
│   ├── parser.py       # Pure YAML/JSON parser & DAG builder
│   ├── server.py       # FastAPI server & API endpoints
│   ├── updater.py      # dvc.yaml enhancement (hasher injection)
│   ├── hasher.py       # AST-based code analysis
│   └── cli.py          # Entry point
├── tests/              # Test suite (46 tests)
└── docs/               # Documentation
```

## 📜 Scripts d'entrée principaux

| Commande | Description |
|----------|-------------|
| `dvc-viewer` | Lance le serveur web et l'auto-updater |
| `dvc-viewer hash` | Calcule les hashes et met à jour `dvc.yaml` |

## 🛣️ Roadmap

- [x] [Isolation des interactions DVC (dvc_client.py)](docs/tasks/fix-rwlock-corruption.md)
- [x] [Correction coloration graphe et ordre sidebar](docs/tasks/fix_dvc_graph.md)
- [ ] Support pour les pipelines multi-projets

## 📄 License

MIT
