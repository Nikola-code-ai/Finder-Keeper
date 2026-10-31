import io
from types import SimpleNamespace
from unittest.mock import MagicMock

import pdfplumber
import pytest
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph

from app.extraction import chunk_pages, extract_pages
from app.pdf_layout import two_column_text
from app.seed import NOTES, make_pdf


def academic_page():
    """A genuine PDF with synchronized baselines, a spanning title, and two prose columns."""
    output = io.BytesIO()
    canvas = Canvas(output, pagesize=(600, 800), invariant=1)
    canvas.setFont("Helvetica-Bold", 15)
    canvas.drawCentredString(300, 750, "A research title spanning both columns")
    style = ParagraphStyle("paper", fontName="Helvetica", fontSize=10, leading=14)
    left = (
        "First left argument explains semantic retrieval from stored vectors. "
        "Its evidence stays together through every wrapped line on this page. "
        "A query and a passage share the same vector space, so related concepts can be retrieved "
        "without matching the exact original words. Evaluation still requires examples whose "
        "correct source passages are known in advance. The final left conclusion explains "
        "why page locations should remain attached to every original source passage."
    )
    right = (
        "First right argument discusses separate model adaptation experiments. "
        "Training only selected parameters can preserve most pretrained representations "
        "while reducing the number of parameters that must be stored for each new language pair. "
        "These experiments compare the resulting translations with a fully tuned baseline. "
        "The authors report observations about adaptation quality and representation alignment. "
        "The final right conclusion belongs after the whole left column, never between "
        "two neighboring lines in that column."
    )
    for x, text in [(50, left), (320, right)]:
        paragraph = Paragraph(text, style)
        _, height = paragraph.wrap(230, 600)
        paragraph.drawOn(canvas, x, 700 - height)
    canvas.showPage()
    canvas.save()
    return output.getvalue()


def test_academic_columns_read_whole_left_before_right():
    pages = extract_pages(academic_page(), "PDF")
    text = pages[0]["text"]
    assert text.index("A research title") < text.index("First left argument")
    assert text.index("final left conclusion") < text.index("First right argument")
    assert "Its evidence stays together through every wrapped line on this page." in text
    assert "The final right conclusion belongs after the whole left column" in text
    for chunk in chunk_pages(pages):
        assert text[chunk["start_char"]:chunk["end_char"]] == chunk["text"]


def test_normal_single_column_is_not_reordered():
    data = make_pdf(NOTES[0])
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        assert two_column_text(pdf.pages[0]) is None
    text = extract_pages(data, "PDF")[0]["text"]
    assert text.index("The invisible roommate") < text.index("A practical example")


def fake_pdf_pages(monkeypatch, count=3):
    import app.extraction as extraction
    source_pages = [MagicMock() for _ in range(count)]
    for page in source_pages:
        page.extract_text.return_value = "A readable paragraph about water moving through the landscape."
    layout_pages = [MagicMock() for _ in range(count)]
    monkeypatch.setattr(extraction, "PdfReader", lambda *args, **kwargs: SimpleNamespace(is_encrypted=False, pages=source_pages))
    context = MagicMock()
    context.__enter__.return_value = SimpleNamespace(pages=layout_pages)
    monkeypatch.setattr(extraction.pdfplumber, "open", lambda *args: context)
    return extraction, source_pages, layout_pages


@pytest.mark.parametrize("ordered", [None, "A readable paragraph with its columns ordered before the next page."])
def test_pdf_layout_cache_is_released_for_every_reading_path(monkeypatch, ordered):
    extraction, _, layout_pages = fake_pdf_pages(monkeypatch)
    monkeypatch.setattr(extraction, "two_column_text", lambda _: ordered)
    assert len(extract_pages(b"fake pdf", "PDF")) == 3
    for page in layout_pages:
        page.close.assert_called_once()


@pytest.mark.parametrize("failure", ["layout", "text"])
def test_pdf_layout_cache_is_released_when_extraction_fails(monkeypatch, failure):
    extraction, source_pages, layout_pages = fake_pdf_pages(monkeypatch)
    layout = MagicMock(return_value=None)
    if failure == "layout":
        layout.side_effect = ValueError("broken layout")
    else:
        source_pages[0].extract_text.side_effect = ValueError("broken text")
    monkeypatch.setattr(extraction, "two_column_text", layout)
    with pytest.raises(ValueError, match="broken"):
        extract_pages(b"fake pdf", "PDF")
    layout_pages[0].close.assert_called_once()
    layout_pages[1].close.assert_not_called()


def test_pdf_character_limit_stops_before_reading_rest_of_book(monkeypatch):
    extraction, _, layout_pages = fake_pdf_pages(monkeypatch)
    layout = MagicMock(return_value="x" * 1_000_001)
    monkeypatch.setattr(extraction, "two_column_text", layout)
    with pytest.raises(ValueError, match="two-million-character"):
        extract_pages(b"fake pdf", "PDF")
    assert layout.call_count == 2
    layout_pages[0].close.assert_called_once()
    layout_pages[1].close.assert_called_once()
    layout_pages[2].close.assert_not_called()
