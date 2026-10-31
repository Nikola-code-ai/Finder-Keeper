"""Open-content book catalogs, with format-neutral, unverified acquisition assets.

Provider contracts:
https://gutendex.com/ (independent Project Gutenberg metadata service)
https://github.com/openstax/openstax-cms/wiki/API-Endpoints

Catalog metadata is evidence for a candidate, not proof that its file can be
downloaded or that it is the requested edition. Acquisition owns those checks.
"""

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

GUTENDEX_URL = "https://gutendex.com/books/"
OPENSTAX_URL = "https://openstax.org/apps/cms/api/books/"
_CACHE: dict[tuple, tuple[float, object]] = {}
_CACHE_LOCK = Lock()
_STOP_WORDS = {"a", "an", "and", "the", "of", "to", "in", "for", "on", "by", "with", "about"}
_FORMAT_NAMES = {
    "text/html": "HTML", "application/xhtml+xml": "HTML", "application/epub+zip": "EPUB",
    "text/plain": "TEXT", "application/pdf": "PDF",
}


class OpenBookProviderUnavailable(ValueError):
    pass


def query_terms(query: str) -> tuple[str, bool]:
    """Remove request scaffolding without deleting words inside a book title."""
    value = query.strip()[:500]
    topical = bool(re.search(r"\b(?:books?|textbooks?|e-?books?|monographs?)\s+(?:about|on|covering|regarding)\b", value, re.I))
    quoted = re.search(r'["“]([^"”]+)["”]', value)
    if quoted:
        return quoted.group(1).strip(), False
    value, request_count = re.subn(r"^(?:please\s+)?(?:find|search\s+for|look\s+for|look\s+up|get|locate|show)\s+(?:me\s+)?", "", value, flags=re.I)
    value = re.sub(r"^(?:(?:a|an|the)\s+)?(?:(?:free|open[ -]access|available|pdf|epub)\s+)*(?:copy|version)\s+of\s+", "", value, flags=re.I)
    if request_count or topical or re.match(r"^(?:(?:a|an|the)\s+)?(?:free|open[ -]access|available|pdf|epub)\b", value, re.I):
        value = re.sub(r"^(?:(?:a|an|the)\s+)?(?:(?:free|open[ -]access|available|pdf|epub)\s+)*(?:books?|textbooks?|e-?books?|monographs?)\s+(?:(?:about|on|covering|regarding|called|titled)\s+)?", "", value, flags=re.I)
    value = re.sub(r"\s+(?:as|in)\s+(?:a\s+)?(?:pdf|epub)(?:\s+format)?$", "", value, flags=re.I)
    return " ".join(value.split()).strip(" .?"), topical


def _tokens(value: str) -> set[str]:
    return {word for word in re.findall(r"[^\W_]+", value.casefold()) if word not in _STOP_WORDS}


def _strings(value) -> list[str]:
    return [item for item in value if isinstance(item, str)] if isinstance(value, list) else []


def _records(value) -> list[dict]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _relevance(terms: str, title: str, context: str) -> int:
    wanted = _tokens(terms)
    title_words = _tokens(title)
    if not wanted or not wanted.issubset(title_words | _tokens(context)):
        return 0
    return 10 * len(wanted & title_words) + (100 if terms.casefold() in title.casefold() else 0) + 1


def _safe_url(value, hosts: set[str]) -> str | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = urlparse(value)
        if (parsed.scheme != "https" or parsed.hostname not in hosts or parsed.username or parsed.password
                or parsed.port not in (None, 443)):
            return None
    except ValueError:
        return None
    return value


def _get_json(url: str, params: dict | None = None):
    """Bound metadata size, redirects and network time; never request book files."""
    current = url
    hosts = {urlparse(url).hostname}
    try:
        with httpx.Client(timeout=httpx.Timeout(8, connect=3), trust_env=False, follow_redirects=False) as client:
            for _ in range(3):
                with client.stream("GET", current, params=params, headers={
                    "Accept": "application/json", "User-Agent": "FinderKeeper/0.1 (private research library)",
                }) as response:
                    if response.status_code in (301, 302, 303, 307, 308):
                        next_url = urljoin(current, response.headers.get("location", ""))
                        if not _safe_url(next_url, hosts):
                            raise OpenBookProviderUnavailable("catalog redirected outside its provider")
                        current, params = next_url, None
                        continue
                    if response.status_code != 200:
                        raise OpenBookProviderUnavailable(f"catalog returned HTTP {response.status_code}")
                    data = bytearray()
                    for chunk in response.iter_bytes():
                        data.extend(chunk)
                        if len(data) > 2_000_000:
                            raise OpenBookProviderUnavailable("catalog response exceeded the size limit")
                    return json.loads(data)
    except (httpx.HTTPError, ValueError) as exc:
        if isinstance(exc, OpenBookProviderUnavailable):
            raise
        raise OpenBookProviderUnavailable("catalog could not be reached or returned invalid data") from exc
    raise OpenBookProviderUnavailable("catalog redirected too many times")


def _cached_json(url: str, params: dict | None = None, max_age: int = 3600):
    key = (url, tuple(sorted((params or {}).items())))
    with _CACHE_LOCK:
        cached = _CACHE.get(key)
        if cached and time.monotonic() - cached[0] < max_age:
            return cached[1]
    result = _get_json(url, params)
    with _CACHE_LOCK:
        if len(_CACHE) >= 64:
            _CACHE.pop(min(_CACHE, key=lambda item: _CACHE[item][0]))
        _CACHE[key] = (time.monotonic(), result)
    return result


def _asset(url: str, format_name: str, mime: str, license_value: str | None):
    return {"url": url, "format": format_name, "mime_type": mime,
            "access_status": "unverified", "license": license_value}


def parse_gutenberg(item: dict) -> dict | None:
    if not isinstance(item, dict) or type(item.get("id")) is not int or item["id"] <= 0:
        return None
    title = item.get("title")
    if not isinstance(title, str) or not title.strip() or item.get("media_type") != "Text":
        return None
    license_value = "public-domain-US" if item.get("copyright") is False else None
    source_url = f"https://www.gutenberg.org/ebooks/{item['id']}"
    assets = []
    formats = item.get("formats") or {}
    if not isinstance(formats, dict):
        return None
    for mime, value in formats.items():
        if not isinstance(mime, str):
            continue
        format_name = _FORMAT_NAMES.get(mime.split(";", 1)[0].strip().lower())
        url = _safe_url(value, {"www.gutenberg.org", "gutenberg.org"})
        if not format_name or not url or urlparse(url).path.lower().endswith(".zip"):
            continue
        # The current text importer accepts UTF-8/ASCII; do not advertise other encodings.
        if format_name == "TEXT" and "charset=" in mime and not any(value in mime.lower() for value in ("utf-8", "us-ascii")):
            continue
        if url not in {asset["url"] for asset in assets}:
            assets.append(_asset(url, format_name, mime, license_value))
    assets.sort(key=lambda item: {"HTML": 0, "EPUB": 1, "TEXT": 2, "PDF": 3}[item["format"]])
    authors = [author["name"] for author in _records(item.get("authors")) if isinstance(author.get("name"), str)]
    return {
        "id": f"gutenberg:{item['id']}", "title": title.strip(), "authors": authors[:8], "year": None,
        "source": "Project Gutenberg", "provider": "Gutendex / Project Gutenberg", "source_url": source_url,
        "read_url": source_url, "read_scope": "catalog", "import_url": assets[0]["url"] if assets else None,
        "format": assets[0]["format"] if assets else None, "assets": assets, "license": license_value,
        "rights_scope": "US" if license_value else None, "importable": False,
        "access_reason": ("Public domain in the United States according to the catalog; rights elsewhere may differ. Copy not yet checked."
                          if license_value else "Read at Project Gutenberg; reuse rights and downloadable copy need checking."),
        "summary": " ".join(_strings(item.get("summaries")))[:800],
        "version": "Project Gutenberg edition", "identity_verified": False, "verification_status": "provider-metadata",
        "kind": "Book",
    }


def _gutenberg(terms: str, topical: bool, limit: int):
    params = {"copyright": "false", "languages": "en", "topic" if topical else "search": terms}
    data = _cached_json(GUTENDEX_URL, params, max_age=600)
    if not isinstance(data, dict) or not isinstance(data.get("results"), list):
        raise OpenBookProviderUnavailable("catalog returned an unsupported response")
    results = []
    for item in data["results"][:32]:
        candidate = parse_gutenberg(item)
        if not candidate:
            continue
        subjects = " ".join(_strings(item.get("subjects")) + _strings(item.get("bookshelves")))
        if topical and "fiction" in subjects.casefold() and not (_tokens(terms) & {"fiction", "novel", "novels", "stories"}):
            continue
        rank = _relevance(terms, candidate["title"], subjects + " " + " ".join(candidate["authors"]))
        if rank:
            results.append((rank, candidate))
    return [item for _, item in sorted(results, key=lambda pair: pair[0], reverse=True)[:limit]]


def parse_openstax(item: dict, detail: dict | None = None) -> dict | None:
    """Only whole-book downloads are assets; a web-reader chapter stays a read link."""
    if not isinstance(item, dict) or item.get("book_state") != "live":
        return None
    slug, title = item.get("slug"), item.get("title")
    if (not isinstance(slug, str) or not re.fullmatch(r"books/[a-z0-9-]+", slug)
            or not isinstance(title, str) or not title.strip()):
        return None
    detail = detail if isinstance(detail, dict) else {}
    if detail and (detail.get("id") != item.get("id") or detail.get("book_state") != "live"):
        return None
    source_url = f"https://openstax.org/{slug}"
    license_value = _safe_url(detail.get("license_url"), {"creativecommons.org", "www.creativecommons.org"})
    pdf = _safe_url(detail.get("pdf_url") or item.get("pdf_url"), {"assets.openstax.org", "openstax.org"})
    assets = [_asset(pdf, "PDF", "application/pdf", license_value)] if pdf else []
    reader = _safe_url(detail.get("webview_rex_link") or item.get("webview_rex_link"), {"openstax.org"})
    authors = [author["value"]["name"] for author in _records(detail.get("authors"))
               if isinstance(author.get("value"), dict) and isinstance(author["value"].get("name"), str)]
    year = re.match(r"(\d{4})-", str(detail.get("publish_date") or ""))
    summary = BeautifulSoup(str(detail.get("description") or ""), "html.parser").get_text(" ", strip=True)
    return {
        "id": f"openstax:{item.get('id') or slug}", "title": title.strip(), "authors": authors[:8],
        "year": int(year.group(1)) if year else None, "source": "OpenStax", "provider": "OpenStax",
        "source_url": source_url, "read_url": reader or source_url,
        "read_scope": "multipart-reader" if reader else "catalog", "import_url": pdf,
        "format": "PDF" if pdf else "HTML", "assets": assets, "pdf_url": pdf, "license": license_value,
        "importable": False, "access_reason": "Free OpenStax textbook; download and the edition's license need checking.",
        "summary": summary[:800], "version": None, "kind": "Book", "identity_verified": False,
        "verification_status": "provider-metadata",
    }


def _openstax(terms: str, limit: int):
    data = _cached_json(OPENSTAX_URL, {"format": "json"})
    if not isinstance(data, dict) or not isinstance(data.get("books"), list):
        raise OpenBookProviderUnavailable("catalog returned an unsupported response")
    matches = []
    for item in data["books"]:
        if not isinstance(item, dict) or not parse_openstax(item):
            continue
        context = " ".join(_strings(item.get("subjects")) + _strings(item.get("subject_categories")))
        rank = _relevance(terms, item["title"], context)
        if rank:
            matches.append((rank, item))
    matches.sort(key=lambda pair: pair[0], reverse=True)

    def resolve(pair):
        _, item = pair
        try:
            if not isinstance(item.get("id"), int):
                return parse_openstax(item), "OpenStax returned a book without a usable metadata identifier."
            detail = _cached_json(f"https://openstax.org/apps/cms/api/v2/pages/{item['id']}/")
            if not isinstance(detail, dict):
                raise OpenBookProviderUnavailable("book metadata returned an unsupported response")
            return parse_openstax(item, detail), None
        except OpenBookProviderUnavailable:
            return parse_openstax(item), f"OpenStax license details could not be loaded for {item['title']}."

    with ThreadPoolExecutor(max_workers=3) as pool:
        resolved = list(pool.map(resolve, matches[:min(limit, 6)]))
    return [candidate for candidate, _ in resolved if candidate], [warning for _, warning in resolved if warning]


def discover_open_books(query: str, limit: int = 8) -> tuple[list[dict], list[str]]:
    """Search real catalogs in parallel. No fixtures or unrelated fallback titles."""
    terms, topical = query_terms(query)
    if not _tokens(terms):
        return [], ["Describe a book title, author, or subject to search the open catalogs."]
    limit = max(1, min(limit, 12))
    results, warnings = [], []
    with ThreadPoolExecutor(max_workers=2) as pool:
        sources = [("OpenStax", pool.submit(_openstax, terms, limit)),
                   ("Gutendex / Project Gutenberg", pool.submit(_gutenberg, terms, topical, limit))]
        for provider, future in sources:
            try:
                value = future.result()
                if provider == "OpenStax":
                    candidates, notices = value
                    warnings.extend(notices)
                else:
                    candidates = value
                results.extend(candidates)
            except OpenBookProviderUnavailable as exc:
                warnings.append(f"{provider} is unavailable: {exc}.")
    return results[:limit], warnings
