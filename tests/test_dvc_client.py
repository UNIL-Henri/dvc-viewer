"""Tests for dvc_client module."""

import json
import os
import subprocess
from pathlib import Path
from dvc_viewer.dvc_client import (
    safe_read_rwlock,
    resolve_dvc_bin,
    is_dvc_process_alive,
)


def test_safe_read_rwlock_valid(tmp_path):
    """Returns parsed JSON for a valid rwlock file."""
    rwlock = tmp_path / "rwlock"
    data = {"read": {"data/foo": {"pid": 123, "cmd": "repro"}}}
    rwlock.write_text(json.dumps(data))
    
    parsed = safe_read_rwlock(rwlock)
    assert parsed == data


def test_safe_read_rwlock_missing(tmp_path):
    """Returns None if file doesn't exist."""
    assert safe_read_rwlock(tmp_path / "missing") is None


def test_safe_read_rwlock_empty_and_clean(tmp_path, monkeypatch):
    """Deletes empty/corrupted file if no repro process is running."""
    rwlock = tmp_path / "rwlock"
    rwlock.write_text("")
    
    # Mock pgrep to say no repro running
    class MockRes:
        returncode = 1
    monkeypatch.setattr("subprocess.run", lambda *args, **kwargs: MockRes())
    
    parsed = safe_read_rwlock(rwlock)
    assert parsed is None
    assert not rwlock.exists()


def test_safe_read_rwlock_corrupted_and_clean(tmp_path, monkeypatch):
    """Deletes corrupted JSON if no repro process is running."""
    rwlock = tmp_path / "rwlock"
    rwlock.write_text("{invalid json")
    
    class MockRes:
        returncode = 1
    monkeypatch.setattr("subprocess.run", lambda *args, **kwargs: MockRes())
    
    parsed = safe_read_rwlock(rwlock)
    assert parsed is None
    assert not rwlock.exists()


def test_resolve_dvc_bin_venv(tmp_path, monkeypatch):
    """Finds DVC in .venv if it exists."""
    venv_dvc = tmp_path / ".venv" / "bin" / "dvc"
    venv_dvc.parent.mkdir(parents=True)
    venv_dvc.write_text("")
    
    assert resolve_dvc_bin(tmp_path) == str(venv_dvc)


def test_is_dvc_process_alive_not_found():
    """Returns False for non-existent PID."""
    # Assuming PID 9999999 doesn't exist
    assert not is_dvc_process_alive(9999999)
