import yaml
from dvc_viewer.parser import (
    parse_dvc_lock,
    _check_stage_hashes_on_disk,
    build_pipeline,
    pipeline_to_dict,
    Stage,
    Pipeline
)


def test_parse_dvc_lock_detailed(tmp_path):
    """parse_dvc_lock should return detailed hash info."""
    lock_content = {
        "schema": "2.0",
        "stages": {
            "train": {
                "cmd": "python train.py",
                "deps": [
                    {"path": "data.csv", "md5": "12345", "size": 100}
                ],
                "outs": [
                    {"path": "model.pth", "md5": "abcde", "size": 1000}
                ]
            }
        }
    }
    (tmp_path / "dvc.lock").write_text(yaml.dump(lock_content))

    res = parse_dvc_lock(tmp_path)
    assert "train" in res
    assert res["train"]["deps"]["data.csv"] == "12345"
    assert res["train"]["outs"]["model.pth"] == "abcde"


def test_check_stage_hashes_on_disk(tmp_path):
    """_check_stage_hashes_on_disk should detect modifications."""
    f = tmp_path / "data.txt"
    f.write_text("hello")
    import hashlib
    h = hashlib.md5(b"hello").hexdigest()

    stage_info = {
        "deps": {"data.txt": h},
        "outs": {}
    }

    assert _check_stage_hashes_on_disk(tmp_path, stage_info) is True

    # Change content
    f.write_text("world")
    assert _check_stage_hashes_on_disk(tmp_path, stage_info) is False


def test_state_priority_ordering():
    """pipeline_to_dict should sort nodes correctly when definition_order is the same."""
    p = Pipeline()
    # Same definition_order for all → state_priority breaks ties
    p.stages = {
        "a": Stage(name="a", state="valid", definition_order=0),
        "b": Stage(name="b", state="running", definition_order=0),
        "c": Stage(name="c", state="needs_rerun", definition_order=0),
    }
    # No edges, so all are in-degree 0
    res = pipeline_to_dict(p)
    # Same definition_order → sorted by state: running(0), needs_rerun(2), valid(4)
    assert res["execution_order"] == ["b", "c", "a"]


def test_definition_order_primary():
    """definition_order should take precedence over state_priority."""
    p = Pipeline()
    p.stages = {
        "early_valid": Stage(name="early_valid", state="valid", definition_order=0),
        "late_dirty": Stage(name="late_dirty", state="needs_rerun", definition_order=1000),
    }
    res = pipeline_to_dict(p)
    # definition_order is primary: early_valid(0) before late_dirty(1000)
    assert res["execution_order"] == ["early_valid", "late_dirty"]


def test_snapshot_diff_logic(tmp_path, monkeypatch):
    """build_pipeline should use snapshot to detect finished stages."""
    import dvc_viewer.parser as parser

    # Setup dummy dvc.yaml
    (tmp_path / "dvc.yaml").write_text("stages:\n  train:\n    cmd: echo 1")

    # 1. Initial State (Not running)
    parser._was_running = False
    parser._dvc_lock_snapshot = None

    # Initial lock
    lock1 = {"stages": {"train": {"outs": [{"path": "out", "md5": "old"}]}}}
    (tmp_path / "dvc.lock").write_text(yaml.dump(lock1))

    # Mock detect_running_stage to return True
    monkeypatch.setattr(parser, "detect_running_stage", lambda *args: (True, "train", 123))
    # Mock dvc status to return nothing
    monkeypatch.setattr(parser, "get_dvc_status", lambda *args: {})

    # Build 1: Transitions to running, snapshot is taken
    pipe1 = build_pipeline(tmp_path)
    assert parser._was_running is True
    assert parser._dvc_lock_snapshot is not None
    assert pipe1.stages["train"].state == "running"

    # 2. Update dvc.lock (simulation: stage finished)
    lock2 = {"stages": {"train": {"outs": [{"path": "out", "md5": "new"}]}}}
    (tmp_path / "dvc.lock").write_text(yaml.dump(lock2))

    # Mock detect_running_stage to return True BUT for another stage
    monkeypatch.setattr(parser, "detect_running_stage", lambda *args: (True, "next_stage", 123))
    (tmp_path / "dvc.yaml").write_text("stages:\n  train:\n    cmd: '1'\n  next_stage:\n    cmd: '2'")

    pipe2 = build_pipeline(tmp_path)
    # train should be 'valid' now because its hash in dvc.lock != snapshot
    assert pipe2.stages["train"].state == "valid"
