"""Rights must be tied to the actual returned copy, not just its scholarly work."""

import httpx
import pytest

from app import discovery

CC_BY = "https://creativecommons.org/licenses/by/4.0/"
PUBLISHER_PDF = "https://publisher.example/final.pdf"


def record(license_version="am", link_version="vor", start=None):
    return {"DOI": "10.1234/example", "title": ["Example research"], "publisher": "Example Press",
            "published": {"date-parts": [[2020]]},
            "license": [{"URL": CC_BY, "content-version": license_version,
                         "start": {"date-time": "2020-01-01T00:00:00Z"} if start is None else start}],
            "link": [{"URL": PUBLISHER_PDF, "content-type": "application/pdf", "content-version": link_version}]}


def search(monkeypatch, work, oa=None):
    original_client = httpx.Client
    def respond(request):
        if request.url.host == "api.crossref.org":
            return httpx.Response(200, json={"message": {"items": [work]}})
        assert request.url.host == "api.unpaywall.org"
        return httpx.Response(200, json=oa)
    monkeypatch.setattr(discovery.settings, "unpaywall_email", "example@example.org" if oa is not None else "")
    monkeypatch.setattr(httpx, "Client", lambda **kwargs: original_client(transport=httpx.MockTransport(respond), **kwargs))
    return discovery._crossref("Example research")[0]


def test_accepted_manuscript_license_never_authorizes_publisher_version(monkeypatch):
    result = search(monkeypatch, record())
    assert result["pdf_url"] == PUBLISHER_PDF
    assert result["license"] is None
    assert result["assets"][0]["license"] is None
    assert result["importable"] is False


@pytest.mark.parametrize("version,start", [
    ("vor", {"date-time": "2999-01-01T00:00:00Z"}),
    ("vor", {}),
    ("vor", {"date-time": "2020-01-01"}),
    ("vor", {"date-parts": [[2020]]}),
    ("unspecified", {"date-time": "2020-01-01T00:00:00Z"}),
    (None, {"date-time": "2020-01-01T00:00:00Z"}),
])
def test_future_or_ambiguous_rights_stay_unknown(monkeypatch, version, start):
    result = search(monkeypatch, record(version, version, start))
    assert result["license"] is None
    assert not result["importable"]


@pytest.mark.parametrize("start", [{"date-time": "2020-01-01T00:00:00Z"}, {"date-parts": [[2020, 1, 1]]}])
def test_matching_effective_license_binds_only_to_that_version(monkeypatch, start):
    work = record("am", "am", start)
    work["link"].append({"URL": PUBLISHER_PDF.replace("final", "other-version"), "content-type": "application/pdf", "content-version": "vor"})
    result = search(monkeypatch, work)
    by_url = {asset["url"]: asset["license"] for asset in result["assets"]}
    assert by_url[PUBLISHER_PDF] == CC_BY
    assert by_url[PUBLISHER_PDF.replace("final", "other-version")] is None
    assert result["importable"] is True


def test_unpaywall_rights_stay_with_repository_copy(monkeypatch):
    repository = "https://repository.example/manuscript.pdf"
    oa = {"best_oa_location": {"url_for_pdf": repository, "license": "cc-by", "version": "acceptedVersion"}}
    result = search(monkeypatch, record(), oa)
    assets = {asset["url"]: asset["license"] for asset in result["assets"]}
    assert assets[PUBLISHER_PDF] is None
    assert assets[repository] == "cc-by"
    assert result["pdf_url"] == repository
    assert result["license"] == "cc-by"


def test_unpaywall_license_does_not_spill_onto_unlicensed_pdf(monkeypatch):
    work = record("am", "am")
    repository = "https://repository.example/unknown.pdf"
    oa = {"best_oa_location": {"url_for_pdf": repository, "license": None}}
    result = search(monkeypatch, work, oa)
    assets = {asset["url"]: asset["license"] for asset in result["assets"]}
    assert assets[repository] is None
    assert result["pdf_url"] == PUBLISHER_PDF
    assert result["license"] == CC_BY


def test_unpaywall_enriches_same_url_without_duplicate_shadowing(monkeypatch):
    oa = {"best_oa_location": {"url_for_pdf": PUBLISHER_PDF, "license": "cc-by"}}
    result = search(monkeypatch, record(), oa)
    assert len(result["assets"]) == 1
    assert result["assets"][0]["license"] == "cc-by"
