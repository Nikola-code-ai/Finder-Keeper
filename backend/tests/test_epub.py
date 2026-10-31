import io
import stat
import struct
import warnings
import zipfile

import pytest

from app import epub
from app.epub import check_epub, verify_epub
from app.extraction import chunk_pages, detect_type, extract_pages

CONTAINER = b'''<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>'''


def book(*, version="3.0", spine=None, chapter=None, extra=None, package_replace=None,
         container=CONTAINER, mimetype=b"application/epub+zip", compression=zipfile.ZIP_DEFLATED):
    spine = spine if spine is not None else '<itemref idref="second"/><itemref idref="nav"/><itemref idref="first"/>'
    package = f'''<package xmlns="http://www.idpf.org/2007/opf" version="{version}" unique-identifier="id">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>The Inland Sea</dc:title></metadata>
    <manifest>
    <item id="first" href="first.xhtml" media-type="application/xhtml+xml"/>
    <item id="second" href="chapters/second.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    </manifest><spine>{spine}</spine></package>'''
    if package_replace:
        package = package.replace(*package_replace)
    chapter = chapter or '''<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Lake water</title></head>
    <body><h1>Second Chapter: Lakes</h1><p>Inland lakes store fresh water through changing seasons and support a variety of ecosystems.</p>
    <nav><p>Navigation should never become chapter evidence.</p></nav><script>Dangerous script body</script></body></html>'''
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=compression) as archive:
        archive.writestr("mimetype", mimetype, compress_type=zipfile.ZIP_STORED)
        archive.writestr("META-INF/container.xml", container)
        archive.writestr("OEBPS/book.opf", package)
        archive.writestr("OEBPS/first.xhtml", "<html><head><title>First Chapter: Rivers</title></head><body><p>River currents carry freshwater downstream and deposit fine sediment along the banks.</p></body></html>")
        archive.writestr("OEBPS/chapters/second.xhtml", chapter)
        archive.writestr("OEBPS/nav.xhtml", "<html><body><h1>TABLE OF CONTENTS ONLY</h1><p>Ignore this index.</p></body></html>")
        for path, content in extra or []:
            archive.writestr(path, content)
    return output.getvalue()


@pytest.mark.parametrize("version", ["2.0", "3.0"])
def test_reads_epub_spine_order_and_ignores_navigation(version):
    data = book(version=version)
    assert detect_type(data, "download.bin", "application/octet-stream") == ("EPUB", "application/epub+zip", ".epub")
    result = verify_epub(data)
    assert result["title"] == "The Inland Sea"
    assert [section["page_number"] for section in result["sections"]] == [1, 2]
    assert result["sections"][0]["text"].startswith("Second Chapter: Lakes\n\nInland")
    assert result["sections"][1]["text"].startswith("First Chapter: Rivers\n\nRiver")
    assert "Navigation" not in result["text"]
    assert "TABLE OF CONTENTS" not in result["text"]
    assert "Dangerous script" not in result["text"]
    assert extract_pages(data, "EPUB") == result["sections"]


def test_long_chapters_get_bounded_sections_with_grounded_titles_and_offsets():
    paragraphs = "".join(f"<p>Observation {i}: the lake stores water that supports seasonal streams and shoreline ecosystems.</p>" for i in range(150))
    result = verify_epub(book(chapter=f"<html><body><h1>Lake observations</h1>{paragraphs}</body></html>"))
    assert len(result["sections"]) >= 3
    for section in result["sections"][:-1]:
        assert section["text"].startswith("Lake observations\n\n")
        assert len(section["text"]) <= epub.SECTION_CHARACTERS
    for chunk in chunk_pages(result["sections"]):
        section = result["sections"][chunk["page_number"] - 1]
        assert section["text"][chunk["start_char"]:chunk["end_char"]] == chunk["text"]


def test_external_citation_hyperlinks_are_text_not_fetches():
    chapter = '<html><body><h1>References</h1><p>The freshwater evidence is described in an <a href="https://example.org/paper">external scientific publication</a> about lake ecosystems.</p></body></html>'
    assert "external scientific publication" in verify_epub(book(chapter=chapter))["text"]


def test_plain_text_beginning_with_pk_is_not_mistaken_for_zip():
    assert detect_type(b"PK means primary key in this database note.", "keys.txt")[0] == "Note"


@pytest.mark.parametrize("path", ["../escape", "/absolute", "folder/../../escape", "C:/escape", "folder\\escape", "a/./b"])
def test_unsafe_archive_paths_are_rejected(path):
    with pytest.raises(ValueError, match="unsafe archive path"):
        check_epub(book(extra=[(path, "text")]))


def test_archive_links_and_duplicates_are_rejected():
    link = zipfile.ZipInfo("OEBPS/link")
    link.create_system = 3
    link.external_attr = (stat.S_IFLNK | 0o777) << 16
    with pytest.raises(ValueError, match="archive links"):
        check_epub(book(extra=[(link, "../../outside")]))
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        duplicate = book(extra=[("OEBPS/first.xhtml", "replacement")])
    with pytest.raises(ValueError, match="duplicate archive paths"):
        check_epub(duplicate)


@pytest.mark.parametrize("path", ["META-INF/encryption.xml", "META-INF/rights.xml"])
def test_drm_and_encryption_metadata_are_rejected(path):
    with pytest.raises(ValueError, match="DRM-protected"):
        check_epub(book(extra=[(path, "<encryption/>")]))


def test_zip_encryption_flag_is_rejected_before_decompression():
    data = bytearray(book())
    position = data.index(b"PK\x01\x02")
    flags = struct.unpack_from("<H", data, position + 8)[0]
    struct.pack_into("<H", data, position + 8, flags | 1)
    with pytest.raises(ValueError, match="Encrypted"):
        check_epub(bytes(data))


@pytest.mark.parametrize("href", ["https://example.org/chapter.xhtml", "//example.org/chapter.xhtml", "../../escape.xhtml", "%2e%2e/%2e%2e/escape.xhtml"])
def test_manifest_cannot_reference_external_or_escaping_resources(href):
    with pytest.raises(ValueError, match="local files|outside the book"):
        check_epub(book(package_replace=('href="first.xhtml"', f'href="{href}"')))


@pytest.mark.parametrize("content", [
    '<img src="https://example.org/track.png"/>',
    '<link href="https://example.org/style.css" rel="stylesheet"/>',
    '<img srcset="local.png 1x, https://example.org/track.png 2x"/>',
])
def test_undeclared_remote_resources_are_rejected(content):
    with pytest.raises(ValueError, match="local files"):
        verify_epub(book(chapter=f"<html><body>{content}<p>Readable content about lake ecosystems and freshwater circulation.</p></body></html>"))


def test_remote_resources_property_is_rejected():
    with pytest.raises(ValueError, match="local files"):
        check_epub(book(package_replace=('id="first"', 'id="first" properties="remote-resources"')))


@pytest.mark.parametrize("encoding", ["utf-8", "utf-16", "utf-32"])
def test_entity_definitions_are_rejected_even_with_non_utf8_xml(encoding):
    xml = '<!DOCTYPE container [<!ENTITY unsafe "attack">]>' + CONTAINER.decode().split('?>', 1)[1]
    with pytest.raises(ValueError, match="DTD or entity"):
        check_epub(book(container=xml.encode(encoding)))


def test_archive_limits_are_checked_before_expanding_resources(monkeypatch):
    data = book(extra=[("unused.dat", "a" * 40_000)])
    monkeypatch.setattr(epub, "MAX_EXPANDED_BYTES", 20_000)
    with pytest.raises(ValueError, match="expanded archive size"):
        check_epub(data)
    monkeypatch.setattr(epub, "MAX_EXPANDED_BYTES", 100_000)
    with pytest.raises(ValueError, match="compression-ratio"):
        check_epub(data)
    monkeypatch.setattr(epub, "MAX_FILES", 3)
    with pytest.raises(ValueError, match="3-file"):
        check_epub(book())


def test_chapter_and_section_limits_are_enforced(monkeypatch):
    monkeypatch.setattr(epub, "MAX_CHAPTERS", 2)
    with pytest.raises(ValueError, match="2-chapter"):
        check_epub(book())
    monkeypatch.setattr(epub, "MAX_CHAPTERS", 300)
    with pytest.raises(ValueError, match="1-section"):
        verify_epub(book(), max_sections=1)


@pytest.mark.parametrize("data", [b"not a zip", b"PK\x03\x04broken", b"<html>not an epub</html>"])
def test_invalid_epub_payloads_fail_cleanly(data):
    with pytest.raises(ValueError, match="valid EPUB archive"):
        detect_type(data, "download.epub")


def test_mimetype_is_content_verified_and_missing_spine_files_fail():
    with pytest.raises(ValueError, match="valid EPUB mimetype"):
        check_epub(book(mimetype=b"application/zip"))
    with pytest.raises(ValueError, match="missing a declared"):
        check_epub(book(package_replace=('href="first.xhtml"', 'href="missing.xhtml"')))
    with pytest.raises(ValueError, match="invalid reading-order"):
        check_epub(book(spine='<itemref idref="not-in-manifest"/>'))


def test_image_only_epub_is_not_reported_as_readable():
    with pytest.raises(ValueError, match="No readable text"):
        verify_epub(book(spine='<itemref idref="second"/>', chapter='<html><body><h1>Cover</h1><img src="cover.png"/></body></html>'))
