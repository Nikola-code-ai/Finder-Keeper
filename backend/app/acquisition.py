"""Verify public full text before presenting a source as readable or importing it.

Verification is deliberately conservative. A catalog response, successful status
code, or a page containing an abstract is not evidence of complete accessible text.
"""

import copy
import hashlib
import io
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from pypdf import PdfReader

from .config import settings

VERIFICATION_VERSION = 2
_cache = {}
_cache_lock = threading.Lock()
_verification_pool = ThreadPoolExecutor(max_workers=3, thread_name_prefix="source-check")
STOP = set("a an the and or of in on for to with from by is are all its this that book edition volume introduction".split())
GATE = re.compile(r"(?:sign\s*in|log\s*in|subscribe|purchase|pay\s*to|institutional\s+access|buy\s+(?:this|the))[^.!?]{0,65}(?:full\s*text|full\s*article|access|continue\s+reading|read\s+(?:the|this)|download)|(?:get|purchase|buy)\s+access|access\s+through\s+your\s+institution|subscription\s+required|you\s+(?:do\s+not|don't)\s+have\s+access", re.I)
PREVIEW = re.compile(r"\b(?:sample\s+(?:chapter|pages|copy)|limited\s+preview|preview\s+copy|free\s+sample|excerpt\s+from\s+(?:the|this)\s+book)\b", re.I)


class VerificationFailed(ValueError):
    def __init__(self, reason, status="unverified"):
        super().__init__(reason)
        self.status = status


def _title_tokens(value):
    return set(re.findall(r"[\w]+", (value or "").casefold())) - STOP


def identity_matches(expected_title, actual_title, text, expected_doi=None):
    haystack = re.sub(r"\s+", " ", (actual_title or "") + " " + text[:18000]).casefold()
    if expected_doi and expected_doi.lower().removeprefix("https://doi.org/") in haystack:
        return True
    wanted = _title_tokens(expected_title)
    if not wanted:
        return True
    found = _title_tokens(haystack)
    return len(wanted & found) / len(wanted) >= (1 if len(wanted) <= 2 else 0.65)


def _check_preview(text, title=""):
    if PREVIEW.search((title or "") + " " + text[:1800]):
        raise VerificationFailed("This resource is labeled as a sample or preview, not a complete copy", "preview")


def verify_document(data, content_type, url, expected_title=None, expected_doi=None, expected_kind=None):
    """Inspect the downloaded resource itself; never infer access from a URL or license."""
    mime = content_type.split(";", 1)[0].strip().lower()
    head = data[:2048].lstrip().lower()
    title, page_count, license_value = None, None, None
    if data.startswith(b"%PDF-"):
        if mime not in {"application/pdf", "application/octet-stream", "binary/octet-stream", ""}:
            raise VerificationFailed("The reported file type does not match the PDF content")
        if b"%%EOF" not in data[-4096:]:
            raise VerificationFailed("The PDF download appears incomplete")
        try:
            reader = PdfReader(io.BytesIO(data), strict=False)
            if reader.is_encrypted:
                raise VerificationFailed("The PDF is password-protected", "restricted")
            page_count = len(reader.pages)
            indices = list(range(min(page_count, 6)))
            if page_count > 6:
                indices.extend(sorted({page_count // 2, page_count - 1} - set(indices)))
            text = "\n".join(reader.pages[index].extract_text() or "" for index in indices)
            title = (reader.metadata or {}).get("/Title")
        except VerificationFailed:
            raise
        except Exception as exc:
            raise VerificationFailed("The downloaded PDF could not be opened") from exc
        if len(re.findall(r"\w+", text)) < 250:
            raise VerificationFailed("The PDF does not expose enough readable text to verify a full document")
        if expected_kind == "book" and page_count < 12:
            raise VerificationFailed("This short PDF could be a chapter, abstract, or preview; a complete book was not verified", "preview")
        _check_preview(text, title)
        format_name, canonical_mime = "PDF", "application/pdf"
    elif data.startswith(b"PK"):
        from .epub import verify_epub
        try:
            verified = verify_epub(data)
        except ValueError as exc:
            raise VerificationFailed(str(exc)) from exc
        text, title = verified["text"], verified.get("title")
        if len(re.findall(r"\w+", text)) < 500:
            raise VerificationFailed("The EPUB does not contain enough substantive text to verify a complete book")
        _check_preview(text, title)
        format_name, canonical_mime = "EPUB", "application/epub+zip"
    elif head.startswith((b"<!doctype html", b"<html")) or mime in {"text/html", "application/xhtml+xml"}:
        soup = BeautifulSoup(data, "html.parser")
        title = soup.title.get_text(" ", strip=True) if soup.title else None
        citation_title = soup.find("meta", attrs={"name": "citation_title"})
        if citation_title and citation_title.get("content"):
            title = citation_title["content"]
        if soup.select_one('input[type="password"]') or re.search(r"^(?:sign\s*in|log\s*in|access\s+denied|just\s+a\s+moment)", title or "", re.I):
            raise VerificationFailed("This resource is a login or access-check page", "restricted")
        for node in soup(["script", "style", "nav", "footer", "header", "form", "iframe", "noscript", "aside"]):
            node.decompose()
        main = soup.find("article") or soup.find("main") or soup.body or soup
        text = main.get_text(" ", strip=True)
        if GATE.search(text):
            raise VerificationFailed("This page asks for payment or sign-in to access the full text", "restricted")
        _check_preview(text, title)
        paragraphs = [node.get_text(" ", strip=True) for node in main.find_all(["p", "pre"])]
        substantive = [paragraph for paragraph in paragraphs if len(re.findall(r"\w+", paragraph)) >= 20]
        prose = "\n\n".join(substantive)
        words = len(re.findall(r"\w+", prose))
        headings = " ".join(node.get_text(" ", strip=True) for node in main.find_all(["h1", "h2", "h3"]))
        sections = bool(re.search(r"\b(?:introduction|methods?|results?|discussion|conclusions?|chapter\s+\d+)\b", headings, re.I))
        abstract_only = bool(re.search(r"\babstract\b", headings, re.I)) and not sections
        if words < 450 or len(substantive) < 4 or abstract_only or (not sections and words < 750):
            raise VerificationFailed("Only a landing page, abstract, or insufficient article text was found", "catalog_only")
        if expected_kind == "book" and words < 5000:
            raise VerificationFailed("This HTML page does not contain a complete book; it may be a chapter or catalog page", "catalog_only")
        # A cited dataset or figure may have a different license from this article.
        # Only an explicit document-level rel=license assertion supplies rights.
        for link in soup.find_all(["a", "link"], href=True):
            href = link["href"]
            if "license" in link.get("rel", []) and urlparse(href).hostname in {"creativecommons.org", "www.creativecommons.org"}:
                license_value = href
                break
        format_name, canonical_mime = "HTML", "text/html"
    elif mime.startswith("text/plain") or urlparse(url).path.lower().endswith((".txt", ".md")):
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise VerificationFailed("The text encoding could not be verified") from exc
        if "\x00" in text or len(re.findall(r"\w+", text)) < (1000 if expected_kind == "book" else 250):
            raise VerificationFailed("The resource does not contain enough readable document text")
        if GATE.search(text[:3000]):
            raise VerificationFailed("This text asks for sign-in or payment", "restricted")
        _check_preview(text)
        title_match = re.search(r"^Title:\s*(.+)$", text[:10000], re.M)
        title = title_match.group(1).strip() if title_match else None
        if "project gutenberg" in text[:10000].lower() and not (re.search(r"\*\*\*\s*START OF", text, re.I) and re.search(r"\*\*\*\s*END OF", text, re.I)):
            raise VerificationFailed("The Gutenberg text does not contain both publication boundary markers")
        format_name, canonical_mime = "TEXT", "text/plain"
    else:
        raise VerificationFailed("The response is not a readable PDF, HTML article, EPUB, or text document")
    if not identity_matches(expected_title, title, text, expected_doi):
        raise VerificationFailed("The downloaded text does not plausibly match the requested document's title or identifier", "identity_mismatch")
    return {
        "format": format_name, "mime_type": canonical_mime, "detected_title": title,
        "word_count_checked": len(re.findall(r"\w+", text)), "page_count": page_count,
        "content_hash": hashlib.sha256(data).hexdigest(), "license": license_value,
        "verification_scope": "Downloaded resource checked for usable text, access gates, previews, and plausible identity; edition completeness is not independently certified",
        "import_supported": page_count is None or page_count <= settings.max_pages,
    }


def _assets(candidate):
    assets, seen = [], set()
    for asset in candidate.get("assets", []):
        if asset.get("url") and asset["url"] not in seen:
            assets.append(dict(asset))
            seen.add(asset["url"])
    for key, format_name in [("pdf_url", "PDF"), ("import_url", None), ("read_url", None)]:
        url = candidate.get(key)
        if url and url not in seen:
            assets.append({"url": url, "format": format_name, "license": candidate.get("license"), "scope": candidate.get("read_scope") if key == "read_url" else None})
            seen.add(url)
    if not assets and candidate.get("source_url"):
        assets.append({"url": candidate["source_url"], "format": "HTML", "license": candidate.get("license")})
    return assets


def trusted_import_candidate(candidate, url):
    from .discovery import import_license
    if candidate.get("verification_version") != VERIFICATION_VERSION or candidate.get("access_status") != "verified_full_text":
        return False
    if candidate.get("import_url") != url or not candidate.get("importable"):
        return False
    return any(asset.get("url") == url and asset.get("access_status") == "verified_full_text" and asset.get("import_supported") and import_license(asset.get("license")) for asset in candidate.get("assets", []))


def verify_candidate(candidate, expected_kind=None, deadline=None):
    from .discovery import download_public, import_license

    result = copy.deepcopy(candidate)
    expected_kind = "book" if candidate.get("kind", "").lower() == "book" else expected_kind
    result.update({"importable": False, "import_url": None, "read_url": None, "access_status": "unverified", "verification_status": "not-verified", "assets": []})
    reasons = []
    for asset in _assets(candidate)[:4]:
        if deadline is not None and time.monotonic() >= deadline:
            reasons.append("The bounded verification time was reached; remaining copies were not checked")
            break
        url = asset["url"]
        if asset.get("scope") == "catalog" or (asset.get("scope") in {"chapter", "preview", "multipart-reader"} and expected_kind == "book"):
            reasons.append("This link is a chapter or multipart reader, not one complete downloadable book")
            continue
        cache_key = (url, candidate.get("title"), candidate.get("doi"), expected_kind)
        with _cache_lock:
            cached = _cache.get(cache_key)
        try:
            if cached and cached[0] > time.monotonic():
                checked = copy.deepcopy(cached[1])
            else:
                remaining = max(1, min(12, (deadline - time.monotonic()) if deadline else 12))
                data, mime, final_url = download_public(url, timeout_seconds=remaining)
                checked = verify_document(data, mime, final_url, candidate.get("title"), candidate.get("doi"), expected_kind)
                checked["url"] = final_url
                with _cache_lock:
                    if len(_cache) > 128:
                        _cache.clear()
                    _cache[cache_key] = (time.monotonic() + 600, copy.deepcopy(checked))
            license_value = asset.get("license") or checked.get("license")
            verified_asset = {**asset, **checked, "license": license_value, "access_status": "verified_full_text"}
            result["assets"].append(verified_asset)
            can_import = checked["import_supported"] and import_license(license_value)
            # Prefer a reusable asset. A verified readable copy remains valuable if rights are unknown.
            if result["read_url"] is None or can_import:
                result.update({
                    "read_url": checked["url"], "import_url": checked["url"] if checked["import_supported"] else None,
                    "read_scope": "full-document",
                    "format": checked["format"], "license": license_value, "importable": can_import,
                    "access_status": "verified_full_text", "verification_status": "content-verified",
                    "verification_version": VERIFICATION_VERSION,
                    "verified_at": datetime.now(timezone.utc).isoformat(),
                    "verification_scope": checked["verification_scope"], "identity_verified": True,
                    "access_reason": "Free full text verified; ready to keep privately" if can_import else ("Free full text verified; permission is needed to store this copy" if checked["import_supported"] else f"Free full text verified; this copy exceeds the {settings.max_pages}-page import limit"),
                })
                result["pdf_url"] = checked["url"] if checked["format"] == "PDF" else None
            if can_import:
                break
        except (ValueError, httpx.HTTPError, TimeoutError) as exc:
            reason = str(exc) if isinstance(exc, ValueError) else "This copy could not be downloaded within the verification limits"
            reasons.append(reason)
            result["assets"].append({**asset, "access_status": getattr(exc, "status", "unverified"), "verification_error": reason})
    if result["access_status"] != "verified_full_text":
        result["access_status"] = next((asset.get("access_status") for asset in result["assets"] if asset.get("access_status") in {"restricted", "preview", "identity_mismatch", "catalog_only"}), "unverified")
        result["access_reason"] = reasons[0] if reasons else "No usable full-text asset was available to verify"
    result["verification_notes"] = reasons
    return result


def verify_candidates(candidates, expected_kind=None, budget_seconds=30, limit=6):
    deadline = time.monotonic() + budget_seconds
    futures = [(candidate, _verification_pool.submit(verify_candidate, candidate, expected_kind, deadline)) for candidate in candidates[:limit]]
    verified, unavailable = [], []
    for candidate, future in futures:
        try:
            result = future.result(timeout=max(1, deadline - time.monotonic() + 2))
            (verified if result["access_status"] == "verified_full_text" else unavailable).append(result)
        except TimeoutError:
            future.cancel()
            unavailable.append({**candidate, "importable": False, "import_url": None, "read_url": None, "access_status": "not_checked", "verification_status": "not-verified", "access_reason": "The verification time limit was reached before this copy could be checked"})
    for candidate in candidates[limit:]:
        unavailable.append({**candidate, "importable": False, "import_url": None, "read_url": None, "access_status": "not_checked", "verification_status": "not-verified", "access_reason": "Not checked in this bounded search; refine your query to target this work"})
    return verified, unavailable
