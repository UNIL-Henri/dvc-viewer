"""
Git client module.

Encapsulates interactions with the Git CLI to retrieve historical states of
the DVC pipeline (commits, file contents at specific commits).
"""

from __future__ import annotations

import subprocess
from pathlib import Path


def git_show_file(project_dir: str | Path, commit: str, path: str) -> str | None:
    """Read a file at a specific git commit via `git show`. Returns None if missing."""
    project_dir = Path(project_dir)
    try:
        result = subprocess.run(
            ["git", "show", f"{commit}:{path}"],
            capture_output=True, text=True,
            cwd=str(project_dir), timeout=10,
        )
        if result.returncode != 0:
            return None
        return result.stdout
    except (subprocess.TimeoutExpired, OSError):
        return None


def get_commit_list(project_dir: str | Path, limit: int = 100) -> list[dict]:
    """Return the git commit history for the repository."""
    project_dir = Path(project_dir)
    try:
        result = subprocess.run(
            ["git", "log", f"-{limit}", "--pretty=format:%H|%h|%s|%an|%ai"],
            capture_output=True, text=True,
            cwd=str(project_dir), timeout=15,
        )
        if result.returncode != 0:
            raise RuntimeError(f"git log failed: {result.stderr.strip()}")

        commits = []
        for line in result.stdout.strip().split("\n"):
            if not line.strip():
                continue
            parts = line.split("|", 4)
            if len(parts) >= 5:
                commits.append({
                    "hash": parts[0],
                    "short_hash": parts[1],
                    "message": parts[2],
                    "author": parts[3],
                    "date": parts[4],
                })
        return commits
    except (subprocess.TimeoutExpired, OSError) as e:
        raise RuntimeError(f"Failed to list commits: {e}")
