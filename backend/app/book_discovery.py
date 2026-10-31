"""Optional OAPEN book discovery; never turn unavailable provider data into fixtures.

API: https://www.oapen.org/article/8185269-search-using-a-rest-api
Expanded item/bitstream fields follow DSpace 6's official REST model.
The live endpoint returned HTTP 403 from this machine on 2026-10-19; the
application must surface that limitation and use another actual provider.
"""

import re
from urllib.parse import quote, urljoin, urlparse

import httpx

BASE_URL = "https://library.oapen.org"
SEARCH_URL = BASE_URL + "/rest/search"


class BookDiscoveryUnavailable(ValueError):
    """A provider failure, distinct from a successful search with no matches."""


def book_intent(query: str) -> bool:
    return bool(re.search(r"\b(?:books?|textbooks?|e-?books?|monographs?)\b", query, re.I))


def _search_terms(query: str) -> str:
    text = re.sub(r"^\s*(?:please\s+)?(?:find|search\s+for|get|locate|show)\s+(?:me\s+)?", "", query, flags=re.I)
    text = re.sub(r"\b(?:books?|textbooks?|e-?books?|monographs?|pdf|free|open[ -]access)\b", " ", text, flags=re.I)
    text = re.sub(r"^\s*(?:a|an|the)\s+", "", text, flags=re.I)
    text = re.sub(r"^\s*(?:about|on|covering)\s+", "", text, flags=re.I)
    return " ".join(text.split()).strip()[:500]


def _trusted_url(value: str | None) -> str | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        url = urljoin(BASE_URL + "/", value)
        parsed = urlparse(url)
        if (parsed.scheme != "https" or parsed.hostname != "library.oapen.org"
                or parsed.username or parsed.password or parsed.port not in (None, 443)):
            return None
    except ValueError:
        return None
    return url


def _reusable_license(value: str) -> bool:
    normalized = value.lower().strip()
    if normalized in {"cc0", "cc-by", "cc-by-sa", "public-domain"}:
        return True
    try:
        parsed = urlparse(normalized)
    except ValueError:
        return False
    return parsed.scheme in {"http", "https"} and parsed.hostname in {"creativecommons.org", "www.creativecommons.org"} and (
        parsed.path.startswith(("/licenses/by/", "/licenses/by-sa/", "/publicdomain/zero/", "/publicdomain/mark/"))
    )


def parse_book(item: dict) -> dict | None:
    if not isinstance(item, dict) or str(item.get("withdrawn", "false")).lower() == "true":
        return None
    metadata: dict[str, list[str]] = {}
    for entry in item.get("metadata") or []:
        if isinstance(entry, dict) and isinstance(entry.get("key"), str) and isinstance(entry.get("value"), str):
            metadata.setdefault(entry["key"], []).append(entry["value"])
    types = " ".join(metadata.get("dc.type", [])).lower()
    if "chapter" in types or (types and not any(word in types for word in ("book", "monograph"))):
        return None
    title = next(iter(metadata.get("dc.title", [])), item.get("name"))
    if not isinstance(title, str) or not title.strip():
        return None
    handle = item.get("handle")
    source_url = next((url for value in metadata.get("dc.identifier.uri", []) if (url := _trusted_url(value))), None)
    if not source_url and isinstance(handle, str) and re.fullmatch(r"[0-9.]+/[A-Za-z0-9._-]+", handle):
        source_url = f"{BASE_URL}/handle/{quote(handle, safe='/')}"
    if not source_url:
        return None
    pdf_url = None
    for bitstream in item.get("bitstreams") or []:
        if not isinstance(bitstream, dict):
            continue
        if bitstream.get("bundleName") == "ORIGINAL" and bitstream.get("mimeType") == "application/pdf":
            pdf_url = _trusted_url(bitstream.get("retrieveLink"))
            if pdf_url:
                break
    licenses = metadata.get("dc.rights.uri", []) + metadata.get("dc.rights", [])
    license_value = next((value for value in licenses if _reusable_license(value)), next(iter(licenses), None))
    importable = bool(pdf_url and license_value and _reusable_license(license_value))
    date = next(iter(metadata.get("dc.date.issued", [])), "")
    year = re.search(r"\b(\d{4})\b", date)
    doi = next(iter(metadata.get("dc.identifier.doi", [])), None)
    return {
        "id": f"oapen:{item.get('uuid') or handle or source_url}", "title": title.strip(),
        "authors": metadata.get("dc.contributor.author", metadata.get("dc.contributor.editor", []))[:8],
        "year": int(year.group(1)) if year else None,
        "source": next(iter(metadata.get("dc.publisher", [])), "OAPEN Library"),
        "source_url": source_url, "pdf_url": pdf_url, "doi": doi,
        "license": license_value, "importable": importable,
        "access_reason": ("Open-license book PDF listed by OAPEN" if importable else
                          "Read at OAPEN; downloadable copy or hosting rights are unverified"),
        "summary": next(iter(metadata.get("dc.description.abstract", [])), "")[:800],
        "provider": "OAPEN", "kind": "Book", "version": None,
        "verification_status": "provider-metadata", "identity_verified": False,
    }


def discover_books(query: str, limit: int = 8) -> list[dict]:
    terms = _search_terms(query)
    if not terms:
        raise ValueError("Describe the book's title, author, or subject.")
    limit = max(1, min(limit, 12))
    try:
        with httpx.Client(timeout=httpx.Timeout(12, connect=5), trust_env=False, follow_redirects=False) as client:
            response = client.get(SEARCH_URL, params={"query": terms, "expand": "metadata,bitstreams", "limit": limit},
                                  headers={"Accept": "application/json", "User-Agent": "FinderKeeper/0.1 (personal research library)"})
            if response.status_code != 200:
                raise BookDiscoveryUnavailable(f"OAPEN book discovery is unavailable (HTTP {response.status_code}).")
            records = response.json()
            if not isinstance(records, list):
                raise BookDiscoveryUnavailable("OAPEN returned an unsupported response format.")
    except BookDiscoveryUnavailable:
        raise
    except httpx.HTTPError as exc:
        raise BookDiscoveryUnavailable("OAPEN book discovery could not be reached.") from exc
    except ValueError as exc:
        raise BookDiscoveryUnavailable("OAPEN returned an unreadable response.") from exc
    return [candidate for item in records[:limit] if (candidate := parse_book(item))]
