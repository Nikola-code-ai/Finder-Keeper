from app import discovery
from app.book_discovery import BookDiscoveryUnavailable


def test_book_provider_failure_falls_back_to_book_catalog(monkeypatch):
    def unavailable(_):
        raise BookDiscoveryUnavailable("OAPEN book discovery is unavailable (HTTP 403).")

    calls = []
    monkeypatch.setattr(discovery, "discover_books", lambda *args, **kwargs: unavailable(args[0]))
    from app import acquisition, open_books
    monkeypatch.setattr(open_books, "discover_open_books", lambda *args, **kwargs: ([], []))
    monkeypatch.setattr(acquisition, "verify_candidates", lambda candidates, **kwargs: (candidates, []))
    monkeypatch.setattr(discovery, "_openalex", lambda query, books_only=False: calls.append((query, books_only)) or [{"title": "A real-provider candidate shape"}])
    response = discovery.discover("Please find me a free PDF book about parallel programming")
    assert calls == [("parallel programming", True)]
    assert "OpenAlex" in response["provider"]
    assert len(response["results"]) == 1
    assert any("403" in warning for warning in response["warnings"])


def test_paper_query_does_not_call_book_provider(monkeypatch):
    def unexpected(_):
        raise AssertionError("A paper query must not use OAPEN")

    monkeypatch.setattr(discovery, "discover_books", unexpected)
    calls = []
    monkeypatch.setattr(discovery, "_openalex", lambda query, books_only=False: calls.append((query, books_only)) or [])
    monkeypatch.setattr(discovery, "_crossref", lambda *args, **kwargs: [])
    discovery.discover("Find me a paper about cache coherence", kind="paper")
    assert calls == [("cache coherence", False)]


def test_license_url_cannot_spoof_creative_commons_hostname():
    assert not discovery.import_license("https://evil.example/?url=creativecommons.org/licenses/by/4.0/")
