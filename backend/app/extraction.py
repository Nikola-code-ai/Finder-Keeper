import io
import re

import pdfplumber
from bs4 import BeautifulSoup
from pypdf import PdfReader

from .config import settings
from .epub import check_epub, verify_epub
from .pdf_layout import two_column_text


def detect_type(data: bytes, filename: str, content_type=""):
    if data.startswith(b"%PDF-"):
        return "PDF", "application/pdf", ".pdf"
    if (data.startswith((b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"))
            or filename.lower().endswith(".epub") or "application/epub+zip" in content_type):
        check_epub(data)
        return "EPUB", "application/epub+zip", ".epub"
    head = data[:2000].lstrip().lower()
    if head.startswith((b"<!doctype html", b"<html")) or "text/html" in content_type:
        return "Article", "text/html", ".html"
    if filename.lower().endswith((".txt", ".md")) or "text/plain" in content_type:
        if b"\x00" in data:
            raise ValueError("This file is not supported text")
        data.decode("utf-8")
        return "Note", "text/plain", ".txt"
    raise ValueError("Use a PDF, an unencrypted EPUB, a UTF-8 text file, or an accessible HTML article")


def extract_pages(data: bytes, kind: str):
    if kind == "PDF":
        reader = PdfReader(io.BytesIO(data), strict=False)
        if reader.is_encrypted:
            raise ValueError("Password-protected PDFs are not supported")
        if len(reader.pages) > settings.max_pages:
            raise ValueError(f"This PDF exceeds the {settings.max_pages}-page limit")
        pages = []
        text_size = 0
        with pdfplumber.open(io.BytesIO(data)) as positioned:
            for i, page in enumerate(reader.pages):
                positioned_page = positioned.pages[i]
                try:
                    ordered = two_column_text(positioned_page)
                    if ordered is not None:
                        text = ordered
                    else:
                        raw = page.extract_text(extraction_mode="layout") or ""
                        paragraphs = []
                        for block in re.split(r"\n\s*\n", raw):
                            lines = [line.strip() for line in block.splitlines() if line.strip()]
                            if not lines:
                                continue
                            # Retain semantic paragraphs while removing line wrapping from the PDF page.
                            if len(lines) > 1 and len(lines[0]) < 55 and len(lines[1]) > 55 and not re.search(r"[.!?:]$", lines[0]):
                                paragraphs.extend([lines[0], " ".join(lines[1:])])
                            else:
                                paragraphs.append(" ".join(lines))
                        text = "\n\n".join(paragraphs)
                finally:
                    # Release cached character/word geometry before moving through a long book.
                    positioned_page.close()
                text = text.replace("\x00", "").strip()
                text_size += len(text)
                if text_size > 2_000_000:
                    raise ValueError("Document text exceeds the two-million-character processing limit")
                pages.append({"page_number": i + 1, "text": text})
    elif kind == "EPUB":
        pages = verify_epub(data, max_sections=settings.max_pages)["sections"]
    elif kind == "Article":
        soup = BeautifulSoup(data, "html.parser")
        for node in soup(["script", "style", "nav", "footer", "header", "form", "iframe", "noscript"]):
            node.decompose()
        main = soup.find("article") or soup.find("main") or soup.body or soup
        paragraphs = [node.get_text(" ", strip=True) for node in main.find_all(["h1", "h2", "h3", "p", "li", "pre"])]
        text = "\n\n".join(paragraphs) if paragraphs else main.get_text(" ", strip=True)
        pages = text_sections(text)
    else:
        pages = text_sections(data.decode("utf-8"))
    for page in pages:
        page["text"] = page["text"].replace("\x00", "").strip()
    if sum(len(p["text"].strip()) for p in pages) < 40:
        raise ValueError("No readable text found. Scanned image-only PDFs need OCR before import.")
    if sum(len(p["text"]) for p in pages) > 2_000_000:
        raise ValueError("Document text exceeds the two-million-character processing limit")
    return pages


def text_sections(text):
    # Stable virtual sections for documents that do not have physical pages.
    blocks = []
    current = ""
    for paragraph in re.split(r"\n\s*\n", text):
        if len(current) + len(paragraph) > 6500 and current:
            blocks.append(current)
            current = ""
        current += ("\n\n" if current else "") + paragraph
    if current:
        blocks.append(current)
    return [{"page_number": i + 1, "text": value} for i, value in enumerate(blocks)]


def chunk_pages(pages, max_words=220, overlap_words=35):
    """Keep chunks below the 512-token encoder limit and never cross a page boundary."""
    chunks = []
    for page in pages:
        words = list(re.finditer(r"\S+", page["text"]))
        index = 0
        while index < len(words):
            end = min(index + max_words, len(words))
            start_char, end_char = words[index].start(), words[end - 1].end()
            chunks.append({
                "page_number": page["page_number"], "position": len(chunks),
                "start_char": start_char, "end_char": end_char,
                "text": page["text"][start_char:end_char],
            })
            if end == len(words):
                break
            index = max(index + 1, end - overlap_words)
    return chunks
