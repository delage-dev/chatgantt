from __future__ import annotations

import hashlib
from datetime import datetime
from html.parser import HTMLParser
from io import StringIO

import httpx

from app.models.resources import Resource
from app.models.tickets import ConnectionConfig


class _HTMLTextExtractor(HTMLParser):
    """Simple HTML to text converter using stdlib."""

    def __init__(self) -> None:
        super().__init__()
        self._result = StringIO()
        self._skip = False

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag in ("script", "style", "noscript"):
            self._skip = True

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style", "noscript"):
            self._skip = False
        if tag in ("p", "div", "br", "h1", "h2", "h3", "h4", "h5", "h6", "li"):
            self._result.write("\n")

    def handle_data(self, data: str) -> None:
        if not self._skip:
            self._result.write(data)

    def get_text(self) -> str:
        return self._result.getvalue().strip()


def _strip_html(html: str) -> str:
    parser = _HTMLTextExtractor()
    parser.feed(html)
    return parser.get_text()


def _extract_title(html: str, url: str) -> str:
    """Try to extract <title> from HTML, fall back to URL."""
    lower = html.lower()
    start = lower.find("<title>")
    if start == -1:
        return url.split("/")[-1] or url
    start += len("<title>")
    end = lower.find("</title>", start)
    if end == -1:
        return url.split("/")[-1] or url
    return html[start:end].strip()


class UrlKnowledgeAdapter:
    """Fetches any URL and extracts text content."""

    async def fetch_resource(
        self,
        url: str,
        config: ConnectionConfig,
        max_content_length: int = 4000,
    ) -> Resource:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()

        content_type = response.headers.get("content-type", "")
        raw = response.text

        if "html" in content_type:
            title = _extract_title(raw, url)
            content = _strip_html(raw)
        else:
            title = url.split("/")[-1] or url
            content = raw

        # Truncate to max length
        if len(content) > max_content_length:
            content = content[:max_content_length] + "\n\n[Content truncated]"

        summary = content[:200].strip()
        if len(content) > 200:
            summary += "..."

        return Resource(
            id=hashlib.md5(url.encode()).hexdigest(),
            title=title,
            source_url=url,
            source_type="url",
            content=content,
            summary=summary,
            last_fetched=datetime.utcnow().isoformat(),
        )
