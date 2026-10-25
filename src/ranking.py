"""Order analysed IPOs without upgrading uncertain data into a recommendation."""

def rank_results(results: list[dict]) -> list[dict]:
    priority = {"CONSIDER": 0, "MONITOR": 1, "AVOID": 2, "INSUFFICIENT DATA": 3}
    return sorted(results, key=lambda r: (priority.get(r.get("analysis", {}).get("verdict"), 4),
                                         -(r.get("analysis", {}).get("score") if r.get("analysis", {}).get("score") is not None else -1)))
