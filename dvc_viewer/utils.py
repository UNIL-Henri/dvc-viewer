import json

def _parse_json_str(s: str) -> dict:
    """Robust JSON parser that falls back to yaml.safe_load for python dict strings and malformed JSON."""
    s = s.strip()
    if s.startswith('"') and s.endswith('"'):
        s = s[1:-1]
    elif s.startswith("'") and s.endswith("'"):
        s = s[1:-1]
    try:
        return json.loads(s)
    except Exception:
        import yaml
        return yaml.safe_load(s)
