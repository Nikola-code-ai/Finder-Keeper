"""Synthetic provider-contract fixtures; never used as production search results."""

from copy import deepcopy

import httpx
import pytest

from app import open_books


@pytest.fixture(autouse=True)
def reset_catalog_cache():
    open_books._CACHE.clear()
    yield
    open_books._CACHE.clear()


@pytest.fixture
def gutenberg_record():
    return {
        "id": 123, "title": "The Jungle Book", "authors": [{"name": "Example Author"}],
        "media_type": "Text", "copyright": False, "summaries": ["Synthetic test summary."],
        "subjects": ["Animals -- Fiction"], "bookshelves": ["Adventure"],
        "formats": {
            "text/html": "https://www.gutenberg.org/ebooks/123.html.images",
            "application/epub+zip": "https://www.gutenberg.org/ebooks/123.epub3.images",
            "text/plain; charset=utf-8": "https://www.gutenberg.org/ebooks/123.txt.utf-8",
            "application/zip": "https://www.gutenberg.org/files/123/123.zip",
            "image/jpeg": "https://www.gutenberg.org/cache/epub/123/cover.jpg",
        },
    }


@pytest.fixture
def openstax_record():
    return {"id": 42, "slug": "books/example-physics", "book_state": "live", "title": "Example Physics",
            "subjects": ["Science"], "subject_categories": ["Physics"],
            "pdf_url": "https://assets.openstax.org/physics.pdf",
            "webview_rex_link": "https://openstax.org/books/example-physics/pages/1-introduction"}


def test_gutenberg_formats_and_us_rights_are_explicit(gutenberg_record):
    candidate = open_books.parse_gutenberg(gutenberg_record)
    assert [asset["format"] for asset in candidate["assets"]] == ["HTML", "EPUB", "TEXT"]
    assert all(asset["access_status"] == "unverified" for asset in candidate["assets"])
    assert candidate["license"] == "public-domain-US"
    assert candidate["rights_scope"] == "US"
    assert candidate["read_url"] == "https://www.gutenberg.org/ebooks/123"
    assert candidate["importable"] is False
    assert candidate["identity_verified"] is False
    assert candidate["year"] is None  # Author dates are not edition publication dates.


@pytest.mark.parametrize("copyright", [True, None, "false"])
def test_unknown_or_existing_copyright_is_not_public_domain(gutenberg_record, copyright):
    gutenberg_record["copyright"] = copyright
    candidate = open_books.parse_gutenberg(gutenberg_record)
    assert candidate["license"] is None
    assert candidate["rights_scope"] is None


@pytest.mark.parametrize("url", ["https://attacker.example/book.html", "http://www.gutenberg.org/file.txt",
                                 "https://www.gutenberg.org:444/book.html", "https://user:pass@www.gutenberg.org/book.html"])
def test_external_or_unsafe_assets_are_rejected(gutenberg_record, url):
    gutenberg_record["formats"] = {"text/html": url}
    assert open_books.parse_gutenberg(gutenberg_record)["assets"] == []


def test_openstax_reader_is_not_misrepresented_as_a_whole_book_asset(openstax_record):
    detail = {"id": 42, "book_state": "live", "license_url": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
              "publish_date": "2024-05-10", "authors": [{"type": "author", "value": {"name": "Example Scientist"}}]}
    candidate = open_books.parse_openstax(openstax_record, detail)
    assert candidate["license"] == detail["license_url"]
    assert candidate["year"] == 2024
    assert candidate["authors"] == ["Example Scientist"]
    assert candidate["read_url"].endswith("/pages/1-introduction")
    assert candidate["read_scope"] == "multipart-reader"
    assert [asset["format"] for asset in candidate["assets"]] == ["PDF"]
    assert candidate["importable"] is False
    assert open_books.parse_openstax(openstax_record)["license"] is None
    assert open_books.parse_openstax(openstax_record, {**detail, "id": 999}) is None


def test_retired_openstax_titles_are_excluded(openstax_record):
    openstax_record["book_state"] = "retired"
    assert open_books.parse_openstax(openstax_record) is None


def test_optional_provider_fields_can_be_null(gutenberg_record, openstax_record):
    gutenberg_record.update(authors=None, summaries=None, subjects=None, bookshelves=None)
    assert open_books.parse_gutenberg(gutenberg_record)["authors"] == []
    assert open_books.parse_gutenberg({**gutenberg_record, "id": True}) is None
    detail = {"id": 42, "book_state": "live", "authors": None}
    assert open_books.parse_openstax(openstax_record, detail)["authors"] == []


@pytest.mark.parametrize("query, expected, topical", [
    ("Find me a free EPUB book about parallel programming", "parallel programming", True),
    ('Find the book titled "The Jungle Book"', "The Jungle Book", False),
    ("The Jungle Book", "The Jungle Book", False),
    ("The Book of the Thousand Nights and a Night", "The Book of the Thousand Nights and a Night", False),
    ("Find a free copy of The Jungle Book", "The Jungle Book", False),
    ("Find a textbook about physics", "physics", True),
])
def test_query_scaffolding_preserves_title_words(query, expected, topical):
    assert open_books.query_terms(query) == (expected, topical)


def test_technical_topic_never_falls_back_to_unrelated_fiction(monkeypatch, gutenberg_record):
    monkeypatch.setattr(open_books, "_cached_json", lambda *args, **kwargs: {"results": [gutenberg_record]})
    assert open_books._gutenberg("parallel programming", True, 8) == []
    assert open_books._gutenberg("The Jungle Book", False, 8)[0]["title"] == "The Jungle Book"
    fiction = deepcopy(gutenberg_record)
    fiction["subjects"] = ["Physics -- Fiction"]
    monkeypatch.setattr(open_books, "_cached_json", lambda *args, **kwargs: {"results": [fiction]})
    assert open_books._gutenberg("physics", True, 8) == []


def test_exact_technical_title_requires_all_substantive_words(monkeypatch, openstax_record):
    openstax_record["title"] = "Introduction to Computer Science"
    openstax_record["subjects"] = ["Computer Science"]
    monkeypatch.setattr(open_books, "_cached_json", lambda *args, **kwargs: {"books": [openstax_record]})
    results, _ = open_books._openstax("Introduction to Parallel Programming", 8)
    assert results == []


def test_failed_provider_does_not_hide_other_real_catalog_results(monkeypatch, openstax_record):
    candidate = open_books.parse_openstax(openstax_record)
    monkeypatch.setattr(open_books, "_openstax", lambda *args: ([candidate], []))
    def unavailable(*args):
        raise open_books.OpenBookProviderUnavailable("catalog returned HTTP 503")
    monkeypatch.setattr(open_books, "_gutenberg", unavailable)
    results, warnings = open_books.discover_open_books("physics")
    assert results == [candidate]
    assert "Gutendex" in warnings[0] and "503" in warnings[0]


def test_provider_metadata_requests_never_download_files(monkeypatch, openstax_record, gutenberg_record):
    original_client = httpx.Client
    observed = []
    def respond(request):
        observed.append(request)
        if request.url.host == "gutendex.com":
            assert request.url.params["topic"] == "physics"
            return httpx.Response(200, json={"results": [gutenberg_record]})
        if request.url.path.endswith("/books/"):
            return httpx.Response(200, json={"books": [openstax_record]})
        assert request.url.path == "/apps/cms/api/v2/pages/42/"
        return httpx.Response(200, json={"id": 42, "book_state": "live", "license_url": "https://creativecommons.org/licenses/by/4.0/"})
    monkeypatch.setattr(httpx, "Client", lambda **kwargs: original_client(transport=httpx.MockTransport(respond), **kwargs))
    results, warnings = open_books.discover_open_books("Find a book about physics")
    assert warnings == []
    assert len(results) == 1
    assert results[0]["license"] == "https://creativecommons.org/licenses/by/4.0/"
    assert len(observed) == 3
    assert all(request.url.host in {"gutendex.com", "openstax.org"} for request in observed)
    open_books.discover_open_books("Find a book about physics")
    assert len(observed) == 3  # Reuse bounded catalog metadata cache.
