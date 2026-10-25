"""Compare research output with the previous manual workflow artifact, if accessible."""
from __future__ import annotations
import io, json, os, zipfile
from datetime import datetime, timezone
from typing import Any
import requests

API = "https://api.github.com"


def compare_reports(previous: dict | None, current: dict) -> dict[str, Any]:
    if not previous:
        return {"available": False, "message": "No prior report snapshot was available for comparison.", "changes": []}
    def key_for(item: dict) -> str:
        row = item.get("ipo", {})
        return str(row.get("symbol") or row.get("ipo_name") or "").casefold().strip()
    prev = {key_for(x): x for x in previous.get("results", []) if key_for(x)}
    curr = {key_for(x): x for x in current.get("results", []) if key_for(x)}
    changes = []
    for key in sorted(set(prev) | set(curr)):
        if key not in prev:
            changes.append({"ipo": key, "change": "newly_seen"})
            continue
        if key not in curr:
            changes.append({"ipo": key, "change": "not_in_current_run"})
            continue
        a, b = prev[key], curr[key]
        old_v, new_v = a.get("analysis", {}).get("verdict"), b.get("analysis", {}).get("verdict")
        old_s, new_s = a.get("analysis", {}).get("score"), b.get("analysis", {}).get("score")
        fields = []
        if old_v != new_v: fields.append({"field": "verdict", "old": old_v, "new": new_v})
        if old_s != new_s: fields.append({"field": "score", "old": old_s, "new": new_s})
        for field in ("gmp_inr", "total_subscription", "issue_status"):
            ov, nv = a.get("ipo", {}).get(field), b.get("ipo", {}).get(field)
            if ov != nv: fields.append({"field": field, "old": ov, "new": nv})
        if fields: changes.append({"ipo": key, "change": "updated", "fields": fields})
    return {"available": True, "previous_run_at_utc": previous.get("run_at_utc"),
            "current_run_at_utc": current.get("run_at_utc"), "changes": changes,
            "message": "Comparison is between the latest available research snapshots, which may use different source timestamps."}


def _latest_snapshot_from_archive(content: bytes) -> dict | None:
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            names = [n for n in archive.namelist() if "/snapshots/snapshot-" in n and n.endswith(".json")]
            if not names:
                names = [n for n in archive.namelist() if n.startswith("data/snapshots/snapshot-") and n.endswith(".json")]
            if not names:
                return None
            name = sorted(names)[-1]
            return json.loads(archive.read(name).decode("utf-8"))
    except (zipfile.BadZipFile, json.JSONDecodeError, UnicodeDecodeError, KeyError):
        return None


def fetch_previous_workflow_snapshot(repo: str | None = None, token: str | None = None,
                                     current_run_id: str | None = None) -> dict | None:
    """Fetch most recent prior artifact. Uses GitHub Actions token only; no private token persisted."""
    repo = repo or os.getenv("GITHUB_REPOSITORY", "")
    token = token or os.getenv("GH_TOKEN", "")
    current_run_id = str(current_run_id or os.getenv("GITHUB_RUN_ID", ""))
    if not repo or not token:
        return None
    headers = {"Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}", "X-GitHub-Api-Version": "2022-11-28"}
    try:
        response = requests.get(f"{API}/repos/{repo}/actions/artifacts?per_page=100", headers=headers, timeout=12)
        if not response.ok: return None
        artifacts = response.json().get("artifacts", [])
        candidates = [a for a in artifacts if str(a.get("name", "")).startswith("ipo-research-")
                      and not a.get("expired") and str(a.get("workflow_run", {}).get("id", "")) != current_run_id]
        candidates.sort(key=lambda a: a.get("created_at", ""), reverse=True)
        for artifact in candidates:
            download = requests.get(artifact.get("archive_download_url", ""), headers=headers, timeout=25)
            if download.ok:
                snapshot = _latest_snapshot_from_archive(download.content)
                if snapshot:
                    return snapshot
    except requests.RequestException:
        return None
    return None
