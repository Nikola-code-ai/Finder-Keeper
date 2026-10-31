import socket
from contextlib import contextmanager

import httpx
import pytest

from app.config import Settings
from app.discovery import download_public, import_license, public_target
from app.extraction import chunk_pages, extract_pages


@pytest.mark.parametrize("url", ["http://example.org/file.pdf", "file:///etc/passwd", "https://localhost/a", "https://user:pass@example.org/a", "https://example.org:8443/a"])
def test_unsafe_url_syntax_is_rejected(url):
    with pytest.raises(ValueError):
        public_target(url)


@pytest.mark.parametrize("address", ["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.1.2", "::1", "fc00::1", "::ffff:127.0.0.1"])
def test_dns_to_private_or_metadata_addresses_rejected(monkeypatch, address):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **kw: [(socket.AF_INET, socket.SOCK_STREAM, 0, "", (address, 443))])
    with pytest.raises(ValueError, match="Private"):
        public_target("https://seemingly-public.example/paper.pdf")


def test_public_connection_pins_validated_ip_and_keeps_tls_hostname(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **kw: [(socket.AF_INET, socket.SOCK_STREAM, 0, "", ("93.184.216.34", 443))])
    target, hostname = public_target("https://example.org/paper.pdf?q=1")
    assert target == "https://93.184.216.34/paper.pdf?q=1"
    assert hostname == "example.org"


def test_redirect_to_private_network_is_blocked(monkeypatch):
    def resolve(host, *args, **kwargs):
        address = "127.0.0.1" if host == "127.0.0.1" else "93.184.216.34"
        return [(socket.AF_INET, socket.SOCK_STREAM, 0, "", (address, 443))]
    monkeypatch.setattr(socket, "getaddrinfo", resolve)

    @contextmanager
    def stream(*args, **kwargs):
        assert kwargs["extensions"]["sni_hostname"] == "example.org"
        yield httpx.Response(302, headers={"location": "https://127.0.0.1/private"})

    monkeypatch.setattr(httpx.Client, "stream", stream)
    with pytest.raises(ValueError, match="Private"):
        download_public("https://example.org/paper.pdf")


def test_page_and_character_offsets_survive_chunking():
    page1 = " ".join(f"word{i}" for i in range(600))
    pages = [{"page_number": 1, "text": page1}, {"page_number": 2, "text": "A second physical page has its own evidence."}]
    chunks = chunk_pages(pages)
    assert len(chunks) == 5
    for chunk in chunks:
        source = pages[chunk["page_number"] - 1]["text"]
        assert source[chunk["start_char"]:chunk["end_char"]] == chunk["text"]
    assert chunks[-1]["page_number"] == 2
    assert chunks[-1]["start_char"] == 0


def test_html_extraction_drops_executable_and_navigation_content():
    html = b"<html><nav>irrelevant menu</nav><article><h1>Field note</h1><p>A sufficiently long passage describes the behavior of ocean currents near the coast.</p><script>alert('bad')</script></article></html>"
    text = extract_pages(html, "Article")[0]["text"]
    assert "ocean currents" in text
    assert "alert" not in text
    assert "irrelevant" not in text


def test_license_verification_is_conservative():
    assert import_license("cc-by")
    assert import_license("https://creativecommons.org/licenses/by/4.0/")
    assert not import_license(None)
    assert not import_license("all-rights-reserved")
    assert not import_license("free-to-read")


def test_production_refuses_local_authentication():
    with pytest.raises(RuntimeError, match="AUTH_MODE=firebase"):
        Settings(app_env="production", auth_mode="local").validate_runtime()


def test_caller_license_does_not_bypass_import_provenance(client, monkeypatch):
    import app.main as main
    monkeypatch.setattr(main, "public_target", lambda _: ("https://93.184.216.34/file", "example.org"))
    result = client.post("/api/import", json={"url": "https://example.org/paper.pdf", "license": "cc-by"})
    assert result.status_code == 400
    assert "no verified full-text copy" in result.json()["detail"]


@pytest.mark.parametrize("query, expected", [
    ("Please find me a free PDF book about parallel programming", "parallel programming"),
    ("Find me a paper about cache coherence", "cache coherence"),
    ("Get a free copy of the book titled Deep Learning", "Deep Learning"),
    ("Attention Is All You Need", "Attention Is All You Need"),
    ("The Great Gatsby", "The Great Gatsby"),
    ("Find The Great Gatsby", "The Great Gatsby"),
    ("10.1038/s41586-021-03819-2", "10.1038/s41586-021-03819-2"),
])
def test_query_normalization_preserves_titles(query, expected):
    from app.discovery import normalize_query
    assert normalize_query(query) == expected


def test_streamed_body_limit_applies_without_content_length():
    from fastapi import FastAPI, Request
    from fastapi.testclient import TestClient

    from app.middleware import BodySizeLimitMiddleware
    tiny_app = FastAPI()
    tiny_app.add_middleware(BodySizeLimitMiddleware, max_bytes=15)

    @tiny_app.post("/")
    async def read_body(request: Request):
        return {"length": len(await request.body())}

    response = TestClient(tiny_app).post("/", content=iter([b"0123456789", b"0123456789"]))
    assert response.status_code == 413
