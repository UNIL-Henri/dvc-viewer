import sys
if "yaml" in sys.modules and hasattr(sys.modules["yaml"], "safe_load") and type(sys.modules["yaml"].safe_load).__name__ == "MagicMock":
    del sys.modules["yaml"]

from dvc_viewer.utils import _parse_json_str

def test_parse_json_str_normal():
    assert _parse_json_str('{"key": "value"}') == {"key": "value"}

def test_parse_json_str_literal_quotes_double():
    assert _parse_json_str('"{"key": "value"}"') == {"key": "value"}

def test_parse_json_str_literal_quotes_single():
    assert _parse_json_str("'{\"key\": \"value\"}'") == {"key": "value"}

def test_parse_json_str_malformed_yaml():
    assert _parse_json_str("{key: value}") == {"key": "value"}

def test_parse_json_str_literal_quotes_malformed_yaml():
    assert _parse_json_str('"{key: value}"') == {"key": "value"}
