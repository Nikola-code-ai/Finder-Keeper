import pytest

from app import acquisition, discovery
from app.acquisition import VerificationFailed, trusted_import_candidate, verify_candidate, verify_document

PARAGRAPH = (
    "Semantic retrieval compares a query with source passages represented as numerical vectors. "
    "A consistent embedding model places related ideas near one another even when their exact wording differs. "
    "The reader should inspect the retrieved evidence and follow its original source location before drawing a conclusion. "
    "Evaluation uses questions with known answers and examines whether the relevant passage appears near the top. "
    "Exact identifiers and names also benefit from keyword matching, so a hybrid system uses both forms of evidence."
)


def article(title="Semantic retrieval", gate="", abstract=False):
    heading = "Abstract" if abstract else "Introduction"
    return (f"<html><head><title>{title}</title></head><body><article><h1>{title}</h1><h2>{heading}</h2>" + gate + "".join(f"<p>{PARAGRAPH}</p>" for _ in range(8)) + "</article></body></html>").encode()


@pytest.fixture(autouse=True)
def clear_verification_cache():
    acquisition._cache.clear()


def candidate(url="https://example.org/full.html", **extra):
    return {"id": "doc", "title": "Semantic retrieval", "source_url": "https://example.org/catalog", "authors": [], "assets": [{"url": url, "format": "HTML", "license": "cc-by"}], **extra}


def test_substantive_html_is_a_supported_fulltext_format():
    result = verify_document(article(), "text/html; charset=utf-8", "https://example.org/full.html", "Semantic retrieval")
    assert result["format"] == "HTML"
    assert result["word_count_checked"] > 450
    assert result["import_supported"]


@pytest.mark.parametrize("gate", ["<p>Subscribe to read the full article.</p>", "<p>Get access through your institution.</p>", '<input type="password" name="password">'])
def test_paywall_or_login_is_rejected_even_with_lots_of_text(gate):
    with pytest.raises(VerificationFailed):
        verify_document(article(gate=gate), "text/html", "https://example.org/full.html")


def test_long_abstract_is_not_promoted_to_full_article():
    with pytest.raises(VerificationFailed, match="landing page, abstract"):
        verify_document(article(abstract=True), "text/html", "https://example.org/abstract")


def test_alternate_copy_is_checked_after_first_copy_is_blocked(monkeypatch):
    calls = []

    def download(url, **kwargs):
        calls.append(url)
        if url.endswith("blocked.pdf"):
            raise ValueError("Source requires sign-in")
        return article(), "text/html", url

    monkeypatch.setattr(discovery, "download_public", download)
    result = verify_candidate(candidate(assets=[{"url": "https://example.org/blocked.pdf", "format": "PDF", "license": "cc-by"}, {"url": "https://example.org/full.html", "format": "HTML", "license": "cc-by"}]))
    assert calls == ["https://example.org/blocked.pdf", "https://example.org/full.html"]
    assert result["access_status"] == "verified_full_text"
    assert result["format"] == "HTML"
    assert result["import_url"] == "https://example.org/full.html"


def test_metadata_only_first_provider_falls_through_to_usable_provider(monkeypatch):
    monkeypatch.setattr(discovery, "_openalex", lambda *args, **kwargs: [candidate("https://example.org/abstract")])
    monkeypatch.setattr(discovery, "_crossref", lambda *args, **kwargs: [candidate("https://example.org/full.html")])
    monkeypatch.setattr(discovery, "download_public", lambda url, **kwargs: (article(abstract=url.endswith("abstract")), "text/html", url))
    result = discovery.discover("Semantic retrieval", kind="paper")
    assert len(result["results"]) == 1
    assert result["results"][0]["access_status"] == "verified_full_text"
    assert len(result["unavailable_results"]) == 1
    assert "Crossref" in result["provider"]


def test_no_usable_candidates_produces_empty_default_results(monkeypatch):
    monkeypatch.setattr(discovery, "_openalex", lambda *args, **kwargs: [candidate()])
    monkeypatch.setattr(discovery, "_crossref", lambda *args, **kwargs: [])
    monkeypatch.setattr(discovery, "download_public", lambda url, **kwargs: (article(gate="<p>Purchase access to the full text.</p>"), "text/html", url))
    result = discovery.discover("Semantic retrieval", kind="paper")
    assert result["results"] == []
    assert result["unavailable_results"][0]["access_status"] == "restricted"


def test_readable_unknown_rights_is_read_only(monkeypatch):
    monkeypatch.setattr(discovery, "download_public", lambda url, **kwargs: (article(), "text/html", url))
    result = verify_candidate(candidate(assets=[{"url": "https://example.org/full.html", "format": "HTML", "license": None}]))
    assert result["access_status"] == "verified_full_text"
    assert result["read_url"] == "https://example.org/full.html"
    assert result["import_url"] == "https://example.org/full.html"
    assert not result["importable"]


def test_wrong_document_identity_and_preview_are_rejected():
    with pytest.raises(VerificationFailed, match="does not plausibly match"):
        verify_document(article(), "text/html", "https://example.org/full.html", expected_title="History of ancient Greek sculpture")
    with pytest.raises(VerificationFailed, match="sample or preview"):
        verify_document(article(title="Semantic retrieval: sample chapter"), "text/html", "https://example.org/full.html")


def test_candidate_trust_requires_verified_specific_asset(monkeypatch):
    monkeypatch.setattr(discovery, "download_public", lambda url, **kwargs: (article(), "text/html", url))
    result = verify_candidate(candidate())
    assert trusted_import_candidate(result, result["import_url"])
    assert not trusted_import_candidate(result, "https://example.org/other.html")
    assert not trusted_import_candidate({**result, "verification_version": 1}, result["import_url"])
    assert not trusted_import_candidate({**result, "assets": []}, result["import_url"])


def test_direct_import_permission_does_not_bypass_gate_check(client, monkeypatch):
    import app.jobs as jobs
    import app.main as main
    monkeypatch.setattr(main, "public_target", lambda _: ("https://93.184.216.34/file", "example.org"))
    monkeypatch.setattr(jobs, "download_public", lambda _: (article(gate="<p>Subscribe to read the full article.</p>"), "text/html", "https://example.org/file"))
    response = client.post("/api/import", json={"url": "https://example.org/file", "rights_confirmed": True})
    assert response.status_code == 202
    job = client.get("/api/jobs/" + response.json()["job_id"]).json()
    assert job["status"] == "failed"
    assert "payment or sign-in" in job["error"]
    assert client.get("/api/library").json()["documents"] == []


def test_cited_resource_license_does_not_license_the_article():
    linked = article(gate='<p>Our data source has <a href="https://creativecommons.org/licenses/by/4.0/">a CC license</a>.</p>')
    assert verify_document(linked, "text/html", "https://example.org/full.html")["license"] is None
    declared = article(gate='<a rel="license" href="https://creativecommons.org/licenses/by/4.0/">Article license</a>')
    assert verify_document(declared, "text/html", "https://example.org/full.html")["license"] == "https://creativecommons.org/licenses/by/4.0/"


def test_different_work_does_not_stop_exact_title_provider_fallback(monkeypatch):
    monkeypatch.setattr(discovery, "_openalex", lambda *args, **kwargs: [candidate(title="Related Work on Retrieval")])
    monkeypatch.setattr(discovery, "_crossref", lambda *args, **kwargs: [candidate(title="Semantic Retrieval")])
    monkeypatch.setattr(discovery, "download_public", lambda url, **kwargs: (article(), "text/html", url))
    result = discovery.discover('Find a paper titled "Semantic Retrieval"', kind="paper")
    assert len(result["results"]) == 1
    assert result["results"][0]["matched_exactly"]
    assert result["unavailable_results"][0]["access_status"] == "different_work"
    assert "Crossref" in result["provider"]


def test_topic_request_does_not_imply_an_exact_title():
    assert discovery.requested_title("Find books about Computer Science", "Computer Science") is None
    assert discovery.requested_title("Introduction to Computer Science", "Introduction to Computer Science")


def test_xhtml_full_article_is_read_as_html():
    result = verify_document(b'<?xml version="1.0"?>' + article(), "application/xhtml+xml", "https://example.org/full.xhtml")
    assert result["format"] == "HTML"


def test_lowercase_intro_title_keeps_exact_work_intent():
    assert discovery.requested_title("an introduction to parallel programming", "an introduction to parallel programming")
