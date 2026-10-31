"""Bounded, offline EPUB 2/3 text ingestion; never extract or execute archive files."""

import io
import posixpath
import re
import stat
import xml.etree.ElementTree as ET
import zipfile
import zlib
from urllib.parse import unquote, urlsplit

from bs4 import BeautifulSoup

EPUB_MIME = "application/epub+zip"
MAX_FILES = 2_000
MAX_EXPANDED_BYTES = 100 * 1024 * 1024
MAX_ENTRY_BYTES = 10 * 1024 * 1024
MAX_METADATA_BYTES = 2 * 1024 * 1024
MAX_COMPRESSION_RATIO = 200
MAX_CHAPTERS = 300
MAX_TEXT_CHARACTERS = 2_000_000
SECTION_CHARACTERS = 6_500
OPF = "{http://www.idpf.org/2007/opf}"
CONTAINER = "{urn:oasis:names:tc:opendocument:xmlns:container}"
DC = "{http://purl.org/dc/elements/1.1/}"


def _local_path(base: str, reference: str) -> str:
    """Resolve a publication URL inside the archive, never on disk or the network."""
    if not reference or reference != reference.strip() or any(ord(c) < 32 for c in reference):
        raise ValueError("This EPUB contains an invalid resource path")
    try:
        parsed = urlsplit(reference)
        path = unquote(parsed.path, errors="strict")
    except (ValueError, UnicodeError) as exc:
        raise ValueError("This EPUB contains an invalid resource path") from exc
    if parsed.scheme or parsed.netloc or parsed.query or path.startswith("/") or "\\" in path or ":" in path:
        raise ValueError("EPUB resources must be local files inside the book")
    if any(ord(c) < 32 for c in path):
        raise ValueError("This EPUB contains an invalid resource path")
    resolved = posixpath.normpath(posixpath.join(base, path))
    if resolved in {".", ".."} or resolved.startswith("../"):
        raise ValueError("This EPUB contains a resource path outside the book")
    return resolved


def _xml(data: bytes, label: str):
    # Removing zero bytes catches UTF-16/32 declarations before ElementTree sees them.
    declaration = data.replace(b"\x00", b"").upper()
    if b"<!DOCTYPE" in declaration or b"<!ENTITY" in declaration:
        raise ValueError("EPUB metadata cannot contain DTD or entity declarations")
    try:
        return ET.fromstring(data)
    except ET.ParseError as exc:
        raise ValueError(f"This EPUB has invalid {label}") from exc


class _Archive:
    def __init__(self, data: bytes):
        try:
            self.zip = zipfile.ZipFile(io.BytesIO(data))
        except (zipfile.BadZipFile, OSError) as exc:
            raise ValueError("This file is not a valid EPUB archive") from exc
        try:
            self._validate()
        except Exception:
            self.zip.close()
            raise

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.zip.close()

    def _validate(self):
        infos = self.zip.infolist()
        if not infos or len(infos) > MAX_FILES:
            raise ValueError(f"This EPUB exceeds the {MAX_FILES}-file archive limit")
        self.files = {}
        total = 0
        for info in infos:
            name = info.orig_filename
            if (name != info.filename or not name or name.startswith("/") or "\\" in name
                    or ":" in name or any(ord(c) < 32 for c in name)
                    or any(part in {".", "..", ""} for part in name.rstrip("/").split("/"))):
                raise ValueError("This EPUB contains an unsafe archive path")
            if name in self.files:
                raise ValueError("This EPUB contains duplicate archive paths")
            if info.flag_bits & 1 or stat.S_ISLNK(info.external_attr >> 16):
                raise ValueError("Encrypted EPUBs and archive links are not supported")
            if info.compress_type not in {zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED}:
                raise ValueError("This EPUB uses an unsupported compression method")
            total += info.file_size
            if info.file_size > MAX_ENTRY_BYTES or total > MAX_EXPANDED_BYTES:
                raise ValueError("This EPUB exceeds the expanded archive size limit")
            if info.file_size > max(info.compress_size, 1) * MAX_COMPRESSION_RATIO:
                raise ValueError("This EPUB exceeds the safe compression-ratio limit")
            self.files[name] = info
        if any(name.lower() in {"meta-inf/encryption.xml", "meta-inf/rights.xml"} for name in self.files):
            raise ValueError("Encrypted or DRM-protected EPUBs are not supported")
        if (infos[0].filename != "mimetype" or infos[0].compress_type != zipfile.ZIP_STORED
                or self.read("mimetype", 64) != EPUB_MIME.encode("ascii")):
            raise ValueError("This ZIP does not have a valid EPUB mimetype")
        container = _xml(self.read("META-INF/container.xml", MAX_METADATA_BYTES), "container metadata")
        if container.tag != f"{CONTAINER}container":
            raise ValueError("This EPUB has invalid container metadata")
        roots = container.findall(f"{CONTAINER}rootfiles/{CONTAINER}rootfile")
        root = next((node for node in roots if node.get("media-type") == "application/oebps-package+xml"), None)
        if root is None:
            raise ValueError("This EPUB does not identify a reading package")
        package_path = _local_path("", root.get("full-path", ""))
        package = _xml(self.read(package_path, MAX_METADATA_BYTES), "package metadata")
        if package.tag != f"{OPF}package" or package.get("version") not in {"2.0", "3.0", "3.1", "3.2", "3.3"}:
            raise ValueError("This EPUB has an unsupported reading package")
        metadata = package.find(f"{OPF}metadata")
        title = metadata.find(f"{DC}title") if metadata is not None else None
        self.title = " ".join("".join(title.itertext()).split())[:500] if title is not None else None
        manifest = package.find(f"{OPF}manifest")
        spine = package.find(f"{OPF}spine")
        if manifest is None or spine is None:
            raise ValueError("This EPUB is missing its manifest or reading order")
        items = {}
        for item in manifest.findall(f"{OPF}item"):
            key = item.get("id")
            if not key or key in items:
                raise ValueError("This EPUB has invalid manifest identifiers")
            properties = set(item.get("properties", "").split())
            if "remote-resources" in properties:
                raise ValueError("EPUB resources must be local files inside the book")
            path = _local_path(posixpath.dirname(package_path), item.get("href", ""))
            if path not in self.files or self.files[path].is_dir():
                raise ValueError("This EPUB is missing a declared book resource")
            items[key] = (path, item.get("media-type"), properties)
        refs = spine.findall(f"{OPF}itemref")
        if not refs or len(refs) > MAX_CHAPTERS:
            raise ValueError(f"This EPUB exceeds the {MAX_CHAPTERS}-chapter limit or has no reading order")
        self.chapters = []
        seen = set()
        for reference in refs:
            key = reference.get("idref")
            if key not in items or key in seen:
                raise ValueError("This EPUB has an invalid reading-order reference")
            seen.add(key)
            path, mime, properties = items[key]
            if "nav" in properties or mime == "application/x-dtbncx+xml":
                continue
            if mime not in {"application/xhtml+xml", "text/html"}:
                raise ValueError("This EPUB has a chapter without supported readable text")
            # Nonlinear appendix/footnote chapters remain useful searchable content.
            self.chapters.append(path)

    def read(self, name: str, maximum=MAX_ENTRY_BYTES) -> bytes:
        info = self.files.get(name)
        if info is None or info.is_dir():
            raise ValueError("This EPUB is missing a required book resource")
        if info.file_size > maximum:
            raise ValueError("This EPUB resource exceeds the processing size limit")
        try:
            with self.zip.open(info) as stream:
                data = stream.read(maximum + 1)
        except (zipfile.BadZipFile, RuntimeError, NotImplementedError, OSError, EOFError, zlib.error) as exc:
            raise ValueError("This EPUB contains an unreadable or encrypted resource") from exc
        if len(data) > maximum or len(data) != info.file_size:
            raise ValueError("This EPUB resource exceeds the processing size limit")
        return data


def check_epub(data: bytes) -> None:
    """Validate the archive and its package, without expanding chapter text."""
    with _Archive(data):
        pass


def _chapter_text(data: bytes, path: str) -> tuple[str, str]:
    if b"<!ENTITY" in data.replace(b"\x00", b"").upper():
        raise ValueError("EPUB chapters cannot contain entity declarations")
    soup = BeautifulSoup(data, "html.parser")
    for node in soup.find_all(True):
        # External hyperlinks are citations, not loaded resources; retain their text.
        for attribute in ("src", "poster", "data", "srcset"):
            value = node.get(attribute)
            if value:
                for source in str(value).split(",") if attribute == "srcset" else [str(value)]:
                    parts = source.strip().split()
                    if parts:
                        _local_path(posixpath.dirname(path), parts[0])
        if node.name in {"link", "base"} and node.get("href"):
            _local_path(posixpath.dirname(path), node["href"])
    document_title = soup.title.get_text(" ", strip=True) if soup.title else ""
    for node in soup(["script", "style", "nav", "footer", "header", "form", "iframe", "noscript", "head"]):
        node.decompose()
    main = soup.body or soup
    heading = main.find(["h1", "h2", "h3"])
    title = heading.get_text(" ", strip=True) if heading else document_title
    title = " ".join(title.split())[:500] or posixpath.splitext(posixpath.basename(path))[0].replace("_", " ")
    tags = {"h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "pre", "blockquote", "td", "dt", "dd", "figcaption"}
    paragraphs = []
    for node in main.find_all(list(tags)):
        if any(parent.name in tags for parent in node.parents):
            continue
        value = " ".join(node.get_text(" ", strip=True).split())
        if value:
            paragraphs.append(value)
    text = "\n\n".join(paragraphs) if paragraphs else main.get_text(" ", strip=True)
    return title, text.replace("\x00", "").strip()


def _sections(title: str, text: str):
    # Preserve chapter boundaries and repeat the actual title on continued sections.
    paragraphs = re.split(r"\n\s*\n", text)
    if paragraphs and paragraphs[0] == title:
        paragraphs = paragraphs[1:]
    current = title
    for paragraph in paragraphs:
        pieces = []
        while len(paragraph) > SECTION_CHARACTERS - len(title) - 2:
            split_at = paragraph.rfind(" ", 0, SECTION_CHARACTERS - len(title) - 2)
            if split_at < 1:
                split_at = SECTION_CHARACTERS - len(title) - 2
            pieces.append(paragraph[:split_at])
            paragraph = paragraph[split_at:].lstrip()
        pieces.append(paragraph)
        for piece in pieces:
            if len(current) + len(piece) + 2 > SECTION_CHARACTERS and current != title:
                yield current
                current = title
            if piece:
                current += "\n\n" + piece
    if current != title:
        yield current


def verify_epub(data: bytes, *, max_sections: int = MAX_CHAPTERS) -> dict:
    """Return actual package title, text and stable numbered sections, or ValueError.

    No filesystem extraction, subprocess, entity expansion or remote fetch is used.
    Sections are virtual reading locations, not physical EPUB page numbers.
    """
    with _Archive(data) as archive:
        pages = []
        text_size = 0
        for path in archive.chapters:
            title, text = _chapter_text(archive.read(path), path)
            if not text:
                continue
            for section in _sections(title, text):
                text_size += len(section)
                if text_size > MAX_TEXT_CHARACTERS:
                    raise ValueError("Document text exceeds the two-million-character processing limit")
                if len(pages) >= max_sections:
                    raise ValueError(f"This EPUB exceeds the {max_sections}-section processing limit")
                pages.append({"page_number": len(pages) + 1, "text": section})
        if text_size < 40:
            raise ValueError("No readable text found in this EPUB's chapters")
        return {"title": archive.title, "text": "\n\n".join(page["text"] for page in pages), "sections": pages}
