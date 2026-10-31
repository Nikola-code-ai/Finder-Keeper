"""Synthetic API-contract fixtures; these are not live OAPEN results."""

from copy import deepcopy

import httpx
import pytest

from app.book_discovery import BookDiscoveryUnavailable, book_intent, discover_books, parse_book


@pytest.fixture
def book_record():
    return {
        "uuid": "synthetic-book", "handle": "20.500.12657/12345", "name": "Example title",
        "metadata": [
            {"key": "dc.title", "value": "Synthetic book used only in tests"},
            {"key": "dc.type", "value": "book"},
            {"key": "dc.contributor.author", "value": "Example Author"},
            {"key": "dc.date.issued", "value": "2024-04-01"},
            {"key": "dc.rights.uri", "value": "https://creativecommons.org/licenses/by/4.0/"},
        ],
        "bitstreams": [
            {"bundleName": "THUMBNAIL", "mimeType": "image/jpeg", "retrieveLink": "/rest/bitstreams/thumbnail/retrieve"},
            {"bundleName": "ORIGINAL", "mimeType": "application/pdf", "retrieveLink": "/rest/bitstreams/synthetic/retrieve"},
        ],
    }


def test_book_metadata_keeps_source_license_and_pdf_distinct(book_record):
    result = parse_book(book_record)
    assert result["importable"] is True
    assert result["source_url"] == "https://library.oapen.org/handle/20.500.12657/12345"
    assert result["pdf_url"] == "https://library.oapen.org/rest/bitstreams/synthetic/retrieve"
    assert result["license"] == "https://creativecommons.org/licenses/by/4.0/"
    assert result["year"] == 2024
    assert result["identity_verified"] is False


@pytest.mark.parametrize("url", ["https://attacker.example/file.pdf", "//127.0.0.1/private", "http://library.oapen.org/file.pdf", "https://library.oapen.org:444/file", "https://[invalid"])
def test_untrusted_bitstream_is_not_importable(book_record, url):
    book_record["bitstreams"][1]["retrieveLink"] = url
    result = parse_book(book_record)
    assert result["pdf_url"] is None
    assert result["importable"] is False


def test_readable_is_not_automatically_reusable(book_record):
    book_record["metadata"][-1]["value"] = "All rights reserved"
    assert parse_book(book_record)["importable"] is False
    book_record["metadata"][-1]["value"] = "https://evil.example/creativecommons.org/licenses/by/4.0/"
    assert parse_book(book_record)["importable"] is False


def test_book_search_excludes_chapters_and_withdrawn_items(book_record):
    chapter = deepcopy(book_record)
    chapter["metadata"][1]["value"] = "book chapter"
    assert parse_book(chapter) is None
    book_record["withdrawn"] = "true"
    assert parse_book(book_record) is None


def test_explicit_book_intent():
    assert book_intent("Find a free PDF book about distributed systems")
    assert book_intent("an ebook on ecology")
    assert not book_intent("a research paper about bookkeeping")


def test_live_provider_denial_is_a_visible_failure(monkeypatch):
    original_client = httpx.Client
    transport = httpx.MockTransport(lambda request: httpx.Response(403, text="Forbidden"))
    monkeypatch.setattr(httpx, "Client", lambda **kwargs: original_client(transport=transport, **kwargs))
    with pytest.raises(BookDiscoveryUnavailable, match="HTTP 403"):
        discover_books("a PDF book about ecology")


def test_contract_request_accepts_json_and_does_not_fetch_book_files(monkeypatch, book_record):
    original_client = httpx.Client
    observed = []

    def respond(request):
        observed.append(request)
        return httpx.Response(200, json=[book_record])

    monkeypatch.setattr(httpx, "Client", lambda **kwargs: original_client(transport=httpx.MockTransport(respond), **kwargs))
    results = discover_books("Find me an open access PDF book about ecology")
    assert len(results) == 1
    assert len(observed) == 1
    assert observed[0].headers["accept"] == "application/json"
    assert observed[0].url.params["query"] == "ecology"
    assert observed[0].url.params["expand"] == "metadata,bitstreams"
