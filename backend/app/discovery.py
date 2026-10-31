import ipaddress
import re
import socket
import time
from urllib.parse import quote, urljoin, urlparse, urlunparse

import httpx

from .book_discovery import BookDiscoveryUnavailable, book_intent, discover_books
from .config import settings


def public_target(url: str):
    """Resolve once, reject every non-public address, and connect to the validated IP."""
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Imports require a public HTTPS URL without embedded credentials")
    try:
        port = parsed.port or 443
    except ValueError:
        raise ValueError("Invalid URL port") from None
    if port != 443:
        raise ValueError("Imports are limited to standard HTTPS port 443")
    hostname = parsed.hostname.encode("idna").decode("ascii")
    if hostname.endswith((".localhost", ".local", ".internal")) or hostname == "localhost":
        raise ValueError("Private network addresses cannot be imported")
    try:
        records = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise ValueError("The source hostname could not be resolved") from None
    addresses = {record[4][0] for record in records}
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise ValueError("Private network addresses cannot be imported")
    address = sorted(addresses, key=lambda value: (":" in value, value))[0]
    netloc = f"[{address}]" if ":" in address else address
    pinned = urlunparse((parsed.scheme, netloc, parsed.path or "/", parsed.params, parsed.query, ""))
    return pinned, hostname


def download_public(url: str, timeout_seconds=45):
    current = url
    deadline = time.monotonic() + timeout_seconds
    with httpx.Client(timeout=httpx.Timeout(timeout_seconds, connect=min(8, timeout_seconds)), follow_redirects=False, trust_env=False) as client:
        for _ in range(6):
            if time.monotonic() >= deadline:
                raise ValueError("The source exceeded the bounded download time")
            pinned, hostname = public_target(current)
            # Preserve TLS SNI/certificate verification and Host while eliminating DNS rebinding.
            with client.stream("GET", pinned, headers={"Host": hostname, "User-Agent": "FinderKeeper/0.1 (personal research library)"}, extensions={"sni_hostname": hostname}) as response:
                if response.status_code in (301, 302, 303, 307, 308):
                    location = response.headers.get("location")
                    if not location:
                        raise ValueError("The source returned a redirect without a destination")
                    current = urljoin(current, location)
                    continue
                if response.status_code in (401, 403):
                    raise ValueError("The source does not permit this download. Open its source page instead.")
                response.raise_for_status()
                length = response.headers.get("content-length")
                if length and int(length) > settings.max_bytes:
                    raise ValueError(f"The source exceeds the {settings.max_upload_mb} MB limit")
                chunks, size = [], 0
                for chunk in response.iter_bytes():
                    if time.monotonic() >= deadline:
                        raise ValueError("The source exceeded the bounded download time")
                    size += len(chunk)
                    if size > settings.max_bytes:
                        raise ValueError(f"The source exceeds the {settings.max_upload_mb} MB limit")
                    chunks.append(chunk)
                return b"".join(chunks), response.headers.get("content-type", ""), current
    raise ValueError("The source redirects too many times")


def import_license(value):
    value = (value or "").lower()
    # Rights metadata is shown as received. Only unambiguous reusable licenses enable automatic import.
    if value in {"cc0", "cc-by", "cc-by-sa", "cc-by-nc", "cc-by-nc-sa", "cc-by-nd", "cc-by-nc-nd", "public-domain"}:
        return True
    try:
        parsed = urlparse(value)
        return parsed.scheme in {"http", "https"} and parsed.hostname in {"creativecommons.org", "www.creativecommons.org"} and parsed.path.startswith(("/licenses/by/", "/licenses/by-sa/", "/licenses/by-nc/", "/licenses/by-nc-sa/", "/licenses/by-nd/", "/licenses/by-nc-nd/", "/publicdomain/zero/", "/publicdomain/mark/"))
    except ValueError:
        return False


def _abstract(index):
    if not index:
        return ""
    words = sorted((position, word) for word, positions in index.items() for position in positions)
    return " ".join(word for _, word in words)[:800]


def normalize_query(query):
    value = query.strip()
    # Remove only request scaffolding, preserving titles, names and quoted phrases.
    request = re.match(r"^(?:please\s+)?(?:find|search for|look for|look up|retrieve|get)\s+(?:me\s+)?", value, flags=re.I)
    if request:
        value = value[request.end():]
        value = re.sub(r"^(?:a|an|the|some)\s+(?=(?:free|open[- ]access|available|pdf|research|academic|paper|article|book|document|textbook|copy|version)\b)", "", value, flags=re.I)
    value = re.sub(r"^(?:(?:free|open[- ]access|available|pdf|research|academic)\s+)*(?:copy|version)\s+of\s+(?:the\s+)?", "", value, flags=re.I)
    value = re.sub(r"^(?:(?:free|open[- ]access|available|pdf|research|academic)\s+)*(?:paper|papers|article|articles|book|books|document|documents|textbook|textbooks)\s+(?:about|on|covering|regarding|called|titled)\s+", "", value, flags=re.I)
    return value.strip(' .?') or query.strip()


def requested_title(query, terms):
    """Recognize explicit titles conservatively; conversational topic queries stay broad."""
    quoted = re.search(r'["“]([^"”]{4,})["”]', query)
    if quoted:
        return quoted.group(1)
    if re.search(r"\b(?:about|covering|regarding)\b|\b(?:books?|papers?|articles?)\s+on\b", query, re.I):
        return None
    if re.search(r"\b(?:called|titled|copy of|version of)\b", query, re.I):
        return terms
    if re.match(r"^(?:(?:a|an|the)\s+)?(?:introduction to|principles of|fundamentals of)\b", terms, re.I):
        return terms
    words = re.findall(r"\b[A-Za-z][\w'-]*\b", terms)
    significant = [word for word in words if word.casefold() not in {"a", "an", "the", "to", "of", "in", "on", "and", "for", "is"}]
    if len(significant) >= 2 and sum(word[0].isupper() for word in significant) / len(significant) >= 0.75:
        return terms
    return None


def exact_title_match(wanted, candidate):
    def clean(value):
        return re.sub(r"[^\w]+", " ", value.casefold()).strip()
    wanted_clean = clean(wanted)
    candidate_title = candidate.get("title") or ""
    # A requested main title may omit a subtitle, but another edition remains
    # explicit provider metadata rather than a claim of edition verification.
    return wanted_clean in {clean(candidate_title), clean(candidate_title.split(":", 1)[0])}


def _openalex(query, books_only=False):
    params = {"search": query, "per-page": 10}
    if books_only:
        params["filter"] = "type:book"
    doi = re.search(r"10\.\d{4,9}/[^\s]+", query)
    if doi:
        params = {"filter": "doi:https://doi.org/" + doi.group().rstrip(".,)"), "per-page": 10}
    if settings.openalex_api_key:
        params["api_key"] = settings.openalex_api_key
    if settings.contact_email:
        params["mailto"] = settings.contact_email
    with httpx.Client(timeout=12, trust_env=False) as client:
        response = client.get("https://api.openalex.org/works", params=params)
        response.raise_for_status()
        works = response.json()["results"]
    results = []
    for work in works:
        locations = [loc for loc in [work.get("best_oa_location"), *work.get("locations", []), work.get("primary_location")] if loc]
        locations.sort(key=lambda loc: (bool(loc.get("pdf_url")) and import_license(loc.get("license")), bool(loc.get("pdf_url"))), reverse=True)
        location = locations[0] if locations else (work.get("primary_location") or {})
        pdf_url = location.get("pdf_url")
        license = location.get("license")
        importable = bool(pdf_url and import_license(license) and pdf_url.startswith("https://"))
        source = location.get("source") or {}
        assets, seen_urls = [], set()
        for alternative in locations:
            for field, format_name in [("pdf_url", "PDF"), ("landing_page_url", "HTML")]:
                url = alternative.get(field)
                if url and url.startswith("https://") and url not in seen_urls and (field == "pdf_url" or alternative.get("is_oa")):
                    assets.append({"url": url, "format": format_name, "license": alternative.get("license"), "version": alternative.get("version")})
                    seen_urls.add(url)
        assets.sort(key=lambda asset: (asset["format"] == "PDF", import_license(asset.get("license"))), reverse=True)
        results.append({
            "id": work["id"], "title": work.get("display_name") or "Untitled work",
            "authors": [author["author"].get("display_name", "") for author in work.get("authorships", [])][:6],
            "year": work.get("publication_year"), "source": source.get("display_name") or "OpenAlex",
            "source_url": location.get("landing_page_url") or work.get("doi") or work["id"],
            "pdf_url": pdf_url, "doi": work.get("doi"), "license": license,
            "importable": importable,
            "access_reason": "Open-license PDF available" if importable else ("Readable source; hosting rights need confirmation" if pdf_url else "Source link available; no downloadable copy verified"),
            "summary": _abstract(work.get("abstract_inverted_index")),
            "version": location.get("version"), "provider": "OpenAlex",
            "identity_verified": False, "verification_status": "Provider metadata; compare title, authors, year and version before importing",
            "assets": assets, "kind": "Book" if work.get("type") == "book" else "Paper",
        })
    return results


def _crossref(query, books_only=False):
    from datetime import datetime, timezone

    def link_license(link, licenses):
        version = link.get("content-version")
        if not version or version == "unspecified":
            return None
        for entry in licenses:
            if (entry.get("content-version") != version or not isinstance(entry.get("URL"), str)
                    or not import_license(entry["URL"])):
                continue
            start = entry.get("start") or {}
            if not isinstance(start, dict):
                continue
            try:
                if start.get("date-time"):
                    effective = datetime.fromisoformat(start["date-time"].replace("Z", "+00:00"))
                    if effective.tzinfo is None:
                        continue
                else:
                    parts = (start.get("date-parts") or [[]])[0]
                    if len(parts) != 3:
                        continue
                    effective = datetime(*parts, tzinfo=timezone.utc)
                if effective <= datetime.now(timezone.utc):
                    return entry["URL"]
            except (TypeError, ValueError, IndexError):
                continue
        return None

    lookup_deadline = time.monotonic() + 18
    access_lookups = 0
    params = {"query.bibliographic": query, "rows": 8}
    if books_only:
        params["filter"] = "type:book"
    if settings.contact_email:
        params["mailto"] = settings.contact_email
    with httpx.Client(timeout=8, trust_env=False) as client:
        response = client.get("https://api.crossref.org/works", params=params)
        response.raise_for_status()
        works = response.json()["message"]["items"]
        results = []
        for work in works:
            doi = work.get("DOI")
            licenses = [value for value in (work.get("license") or []) if isinstance(value, dict)]
            assets_by_url = {}
            for link in work.get("link") or []:
                if not isinstance(link, dict) or not str(link.get("URL") or "").startswith("https://"):
                    continue
                assets_by_url[link["URL"]] = {
                    "url": link["URL"], "format": "PDF" if link.get("content-type") == "application/pdf" else "HTML",
                    "mime_type": link.get("content-type"), "license": link_license(link, licenses),
                    "version": link.get("content-version"),
                }
            if doi and settings.unpaywall_email and access_lookups < 2 and time.monotonic() < lookup_deadline:
                access_lookups += 1
                try:
                    access = client.get(f"https://api.unpaywall.org/v2/{quote(doi, safe='/')}", params={"email": settings.unpaywall_email})
                    access.raise_for_status()
                    access_data = access.json()
                    location = access_data.get("best_oa_location") or {}
                    for alternative in [location, *(access_data.get("oa_locations") or [])]:
                        if not isinstance(alternative, dict):
                            continue
                        for field, format_name in [("url_for_pdf", "PDF"), ("url_for_landing_page", "HTML")]:
                            if alternative.get(field, "") and alternative[field].startswith("https://"):
                                url = alternative[field]
                                # A location's rights apply only to that location's asset URL.
                                # Do not let an unlicensed duplicate erase an explicit association.
                                if url not in assets_by_url or alternative.get("license"):
                                    assets_by_url[url] = {"url": url, "format": format_name,
                                                          "license": alternative.get("license"), "version": alternative.get("version")}
                except httpx.HTTPError:
                    pass
            assets = sorted(assets_by_url.values(), key=lambda value: (import_license(value.get("license")), value["format"] == "PDF"), reverse=True)
            primary = next((value for value in assets if value["format"] == "PDF"), assets[0] if assets else {})
            pdf = primary.get("url") if primary.get("format") == "PDF" else None
            license = primary.get("license")
            dates = (work.get("published") or work.get("created") or {}).get("date-parts", [[None]])
            importable = bool(pdf and pdf.startswith("https://") and import_license(license))
            results.append({
                "id": doi or work.get("URL"), "title": (work.get("title") or ["Untitled work"])[0],
                "authors": [" ".join([author.get("given", ""), author.get("family", "")]).strip() for author in work.get("author", [])][:6],
                "year": dates[0][0], "source": (work.get("container-title") or [work.get("publisher", "Crossref")])[0],
                "source_url": work.get("URL") or f"https://doi.org/{doi}", "pdf_url": pdf,
                "doi": doi, "license": license, "importable": importable,
                "access_reason": "Open-license PDF available" if importable else "Source link available; download and hosting rights unverified",
                "provider": "Crossref", "summary": "",
                "identity_verified": False, "verification_status": "Provider metadata; compare title, authors, year and version before importing",
                "assets": assets, "kind": "Book" if books_only or work.get("type") in {"book", "monograph", "edited-book", "reference-book"} else "Paper",
            })
    return results


def discover(query, kind="any"):
    from .acquisition import verify_candidates

    warnings, unavailable, verified, used = [], [], [], []
    deadline = time.monotonic() + 85
    books_only = kind == "book" or (kind == "any" and book_intent(query))
    terms = normalize_query(query)
    title = requested_title(query, terms)
    providers = []
    if books_only:
        from .open_books import discover_open_books
        providers.extend([
            ("Open books", lambda: discover_open_books(query, limit=6)),
            ("OAPEN", lambda: (discover_books(terms, limit=6), [])),
        ])
    providers.extend([
        ("OpenAlex", lambda: (_openalex(terms, books_only=books_only), [])),
        ("Crossref", lambda: (_crossref(terms, books_only=books_only), [])),
    ])
    if kind == "any" and not books_only:
        from .open_books import discover_open_books
        providers.append(("Open books", lambda: discover_open_books(query, limit=6)))
    for name, provider in providers:
        if time.monotonic() >= deadline - 5:
            warnings.append("The search time limit was reached before every provider could be checked. Refine the title or select the document type to target the next search.")
            break
        try:
            candidates, notices = provider()
            used.append(name)
            warnings.extend(notices)
            if title:
                matching = []
                for candidate in candidates:
                    candidate["matched_exactly"] = exact_title_match(title, candidate)
                    if candidate["matched_exactly"]:
                        matching.append(candidate)
                    else:
                        unavailable.append({**candidate, "importable": False, "import_url": None, "read_url": None, "access_status": "different_work", "verification_status": "not-verified", "access_reason": "Related catalog result; its title differs from the requested work"})
                candidates = matching
            remaining = max(1, deadline - time.monotonic())
            good, rejected = verify_candidates(candidates, expected_kind="book" if books_only else None, budget_seconds=min(22, remaining), limit=6)
            verified.extend(good)
            unavailable.extend(rejected)
            if verified:
                break
            if candidates:
                warnings.append(f"{name} returned matches but no usable free full text was verified; checking another source.")
        except (BookDiscoveryUnavailable, httpx.HTTPError, KeyError, ValueError) as exc:
            warnings.append(str(exc) if isinstance(exc, BookDiscoveryUnavailable) else f"{name} could not be checked right now; trying another source.")
    seen = set()
    results = []
    for result in verified:
        key = (result.get("doi") or result.get("title", "").casefold(), result.get("read_url"))
        if key not in seen:
            seen.add(key)
            results.append(result)
    if not results:
        warnings.append("No free full-text copy was verified in this search. Other matches are shown separately; no catalog page has been imported.")
    return {"results": results, "unavailable_results": unavailable, "provider": ", ".join(used) or "Unavailable", "warnings": warnings, "search_terms": terms, "requested_title": title, "kind": "book" if books_only else kind}
