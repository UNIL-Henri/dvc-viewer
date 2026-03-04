"""Tests for git_client module."""

import subprocess
import pytest
from dvc_viewer.git_client import git_show_file, get_commit_list


def test_git_show_file_success(tmp_path, monkeypatch):
    class MockRes:
        returncode = 0
        stdout = "file content"
    monkeypatch.setattr("subprocess.run", lambda *args, **kwargs: MockRes())
    
    assert git_show_file(tmp_path, "HEAD", "test.txt") == "file content"


def test_git_show_file_missing(tmp_path, monkeypatch):
    class MockRes:
        returncode = 128
        stdout = ""
    monkeypatch.setattr("subprocess.run", lambda *args, **kwargs: MockRes())
    
    assert git_show_file(tmp_path, "HEAD", "missing.txt") is None


def test_get_commit_list_success(tmp_path, monkeypatch):
    class MockRes:
        returncode = 0
        stdout = "hash1|shash1|msg1|author1|date1\nhash2|shash2|msg2|author2|date2"
    monkeypatch.setattr("subprocess.run", lambda *args, **kwargs: MockRes())
    
    commits = get_commit_list(tmp_path, 2)
    assert len(commits) == 2
    assert commits[0]["hash"] == "hash1"
    assert commits[0]["message"] == "msg1"


def test_get_commit_list_error(tmp_path, monkeypatch):
    class MockRes:
        returncode = 128
        stderr = "fatal: not a git repository"
    monkeypatch.setattr("subprocess.run", lambda *args, **kwargs: MockRes())
    
    with pytest.raises(RuntimeError, match="git log failed"):
        get_commit_list(tmp_path)
