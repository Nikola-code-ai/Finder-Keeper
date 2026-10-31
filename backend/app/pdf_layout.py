"""Conservative reading-order recovery for ordinary two-column research papers."""

import re
from statistics import median


def _lines(words):
    lines = []
    for word in sorted(words, key=lambda item: (item["top"], item["x0"])):
        if not lines or abs(word["top"] - lines[-1]["top"]) > 3:
            lines.append({"top": word["top"], "bottom": word["bottom"], "words": [word]})
        else:
            lines[-1]["words"].append(word)
            lines[-1]["bottom"] = max(lines[-1]["bottom"], word["bottom"])
    for line in lines:
        line["words"].sort(key=lambda word: word["x0"])
        line["text"] = " ".join(word["text"] for word in line["words"])
        line["x0"] = min(word["x0"] for word in line["words"])
    return lines


def _paragraphs(words):
    lines = _lines(words)
    if not lines:
        return ""
    gaps = [b["top"] - a["top"] for a, b in zip(lines, lines[1:]) if 5 < b["top"] - a["top"] < 25]
    leading = median(gaps) if gaps else 13
    left = min(line["x0"] for line in lines)
    paragraphs, current = [], ""
    previous = None
    for line in lines:
        value = line["text"].strip()
        new_paragraph = previous is not None and (
            line["top"] - previous["top"] > leading * 1.4
            or (line["x0"] > left + 7 and previous["x0"] <= left + 4 and current.endswith((".", "?", ")")))
        )
        if new_paragraph and current:
            paragraphs.append(current)
            current = ""
        if current.endswith("-") and re.match(r"^[a-z]", value):
            # Keep intentional compounds such as cross-attention; remove line breaks, not evidence.
            current += value
        else:
            current += (" " if current else "") + value
        previous = line
    if current:
        paragraphs.append(current)
    return "\n\n".join(paragraphs)


def two_column_text(page):
    """Return column-ordered text, or None when there is no convincing central gutter.

    Full-width titles/captions split the page into vertical bands. Within each band,
    read the entire left column before the right column. Thus captions remain in
    place and text is never interleaved merely because two lines share a baseline.
    """
    words = page.extract_words(x_tolerance=1.5, y_tolerance=3, expand_ligatures=True)
    if len(words) < 120:
        return None
    candidates = range(int(page.width * 0.44), int(page.width * 0.56), 2)
    scores = [(sum(word["x0"] < x + 3 and word["x1"] > x - 3 for word in words), abs(x - page.width / 2), x) for x in candidates]
    crossing_count, _, split = min(scores)
    if crossing_count > max(6, len(words) * 0.025):
        return None
    left = [word for word in words if word["x1"] <= split]
    right = [word for word in words if word["x0"] >= split]
    if min(len(left), len(right)) < 50:
        return None
    overlap_top = max(min(word["top"] for word in left), min(word["top"] for word in right))
    overlap_bottom = min(max(word["bottom"] for word in left), max(word["bottom"] for word in right))
    if overlap_bottom - overlap_top < 80:
        return None

    crossing = [word for word in words if word["x0"] < split + 3 and word["x1"] > split - 3]
    bands = []
    for word in sorted(crossing, key=lambda item: item["top"]):
        if bands and word["top"] <= bands[-1][1] + 8:
            bands[-1][1] = max(bands[-1][1], word["bottom"] + 2)
        else:
            bands.append([word["top"] - 2, word["bottom"] + 2])

    output = []
    remaining = list(words)
    for top, bottom in [*bands, [page.height + 1, page.height + 2]]:
        before = [word for word in remaining if (word["top"] + word["bottom"]) / 2 < top]
        spanning = [word for word in remaining if top <= (word["top"] + word["bottom"]) / 2 <= bottom]
        remaining = [word for word in remaining if (word["top"] + word["bottom"]) / 2 > bottom]
        for column in ([word for word in before if (word["x0"] + word["x1"]) / 2 < split], [word for word in before if (word["x0"] + word["x1"]) / 2 >= split], spanning):
            text = _paragraphs(column)
            if text:
                output.append(text)
    return "\n\n".join(output)
