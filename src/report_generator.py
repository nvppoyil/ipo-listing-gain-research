"""Report generator facade for JSON, Markdown, and CSV exports."""
from .research import write_reports as generate_reports

__all__ = ["generate_reports"]
