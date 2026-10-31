"""Original, clearly labeled starter notes. These are demonstrations, not published papers."""
import io
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer
from sqlalchemy import select

from .database import Folder, Job, Session
from .jobs import process_document, store_document

NOTES = [
    {
        "slug": "false-sharing", "title": "When threads share a cache line", "folder": "Computer science",
        "subtitle": "False sharing, locality, and small changes that matter",
        "paragraphs": [
            ("The invisible roommate", "Two threads can write to different variables and still slow one another down. Processors keep memory in caches, and coherence operates on a cache line rather than one individual variable. If two frequently written variables occupy the same line, each core's write can invalidate the other core's cached copy. The threads are logically independent but physically share a cache line. This performance problem is called false sharing."),
            ("A practical example", "Imagine each worker updating its own counter in a tightly packed array. The counters do not need a lock because each worker owns a separate element. Yet neighboring counters may fit in one cache line. Repeated writes cause cache-line ownership to move between cores. More threads can increase this coherence traffic instead of increasing throughput."),
            ("Make ownership local", "One remedy is to accumulate a counter in a thread-local variable and write the final result only once. Another is to separate frequently written values so they do not occupy the same cache line. Padding can help, but the relevant cache-line size and layout must be checked on the target machine. Padding every structure indiscriminately can waste cache capacity."),
            ("Measure before concluding", "Keep the amount of useful work constant when comparing versions. Measure several runs and report variability. Pinning threads and controlling competing workloads can improve repeatability. A faster padded version is evidence consistent with false sharing; hardware performance counters can help distinguish coherence traffic from other bottlenecks."),
        ],
    },
    {
        "slug": "semantic-search", "title": "Finding meaning, not just words", "folder": "Computer science",
        "subtitle": "A small guide to embeddings and retrieval",
        "paragraphs": [
            ("Beyond exact wording", "A reader may remember an idea without remembering its wording. Semantic search represents each passage as a numerical vector called an embedding. A query is encoded by a compatible model, and nearby vectors identify passages with related meaning. A question about keeping workers from interfering can retrieve a passage about cache coherence even when those words do not match exactly."),
            ("Preserve the evidence", "Split long documents into passages that preserve enough local context. Keep the source document, physical page number, and character boundaries alongside each passage. Retrieval is useful when the reader can inspect the actual passage rather than trusting an unexplained answer. An embedding is a search representation; it does not train a language model on the document."),
            ("Use more than one signal", "Exact identifiers, titles, names, and technical phrases benefit from keyword matching. Combining lexical signals with vector similarity makes a library more robust. The ranking score is not a probability that the answer is correct. A high similarity can still point to an irrelevant passage, so evaluate real questions with known answers."),
            ("Know when to stop", "An answering model should use retrieved passages as evidence and include citations that return the reader to the original document. If the library does not contain the requested fact, the system should say that evidence is missing. It should never fill the gap by pretending that an unrelated passage supports a claim."),
        ],
    },
    {
        "slug": "quiet-interfaces", "title": "Designing a quieter interface", "folder": "Design & ideas",
        "subtitle": "Contrast, translucency, and room to think",
        "paragraphs": [
            ("Give attention a place to rest", "An interface can feel calm when its hierarchy is clear. Let one action be prominent and keep secondary controls discoverable. Generous spacing and a small number of purposeful colors help a reader distinguish navigation, content, and status. Empty space is useful when it gives important information room to breathe."),
            ("Glass still needs contrast", "Translucent surfaces can suggest layering without hiding the underlying scene. Their success depends on predictable contrast. A fine border, an opaque enough base, and restrained background blur keep labels readable. Strongly patterned backgrounds often require more surface opacity. Test readability in the actual composition, including different window sizes."),
            ("Motion should explain a change", "An animated character can turn a waiting state into a small narrative. Its movement should respond to the real task: departing when discovery starts and returning when work finishes. The application must show useful results as soon as they are ready. Decorative animation should never impose an artificial delay on the reader."),
            ("Offer a still alternative", "Some people prefer or require less motion. Respect a reduced-motion preference and show an understandable text status in place of elaborate movement. Keyboard navigation, visible focus, and buttons with meaningful names remain essential even in an expressive visual design."),
        ],
    },
    {
        "slug": "reading-notes", "title": "A small practice of reading", "folder": "Reading room",
        "subtitle": "Make a library you can actually return to",
        "paragraphs": [
            ("Save a reason", "A personal library becomes more useful when each saved document has a reason for being there. Write one sentence about the question it helped answer. A clear title, a source link, and a few deliberate folders often help more than an elaborate tagging system that is difficult to maintain."),
            ("Read with a question", "Before opening a long article, write down what you are trying to learn. Skim its structure, identify the relevant section, and then read that section carefully. A useful note separates the author's claim, the evidence offered, and your own interpretation. This makes later synthesis easier and reduces the chance of mistaking a remembered impression for a fact."),
            ("Leave a trail", "Record the page number and preserve a short exact quotation when wording matters. A summary is useful for orientation, but it is not a substitute for the source. When returning to an old note, check whether the document version and context still match the decision you need to make."),
            ("Review instead of collecting", "Set aside a little time to revisit what you saved. Move useful material into a small working collection and remove accidental duplicates. A research library should support thinking; its value is measured by the questions it helps answer, not by the number of files it contains."),
        ],
    },
    {
        "slug": "open-research", "title": "A field guide to open research", "folder": "Reading room",
        "subtitle": "Identity, versions, and accessible copies",
        "paragraphs": [
            ("Find the right work", "A title search may return several documents with similar names. Compare authors, publication year, venue, and persistent identifiers before saving a candidate. A DOI identifies a scholarly work or version, while a repository may hold an accepted manuscript or preprint. Keep that distinction visible."),
            ("Access and reuse differ", "A document can be readable without granting permission to redistribute it. Open licenses state reuse conditions, while public-domain status depends on the work and jurisdiction. Preserve the source's license information and link to the original landing page. When hosting rights are uncertain, a source link can still be useful."),
            ("Track the version", "A preprint can differ from the final published article. Corrections, revised analyses, or retractions may appear later. Save the retrieval date and available version information so a reader can check the document's history. Do not present an early manuscript as the final version unless verified."),
            ("Describe what was verified", "A discovery tool should distinguish finding metadata from downloading a usable document. A working link is not proof of relevance, and a successful download is not proof of scientific quality. Clear states help the reader understand what the tool actually accomplished."),
        ],
    },
    {
        "slug": "recoverable-systems", "title": "Small systems that recover gracefully", "folder": "Computer science",
        "subtitle": "Retries, durable state, and honest progress",
        "paragraphs": [
            ("Expect interruption", "A document import crosses several boundaries: a remote server, local storage, a parser, and an embedding model. Any step may fail. Persist a job record before starting work so that a process restart does not erase the user's request. Separate queued, processing, ready, and failed states."),
            ("Retry without duplicating", "Repeated requests should not create multiple copies of the same file. Hash the original bytes and enforce uniqueness within each user's library. If processing is retried, replace the document's derived passages as one transaction. A retry should either preserve the previous complete result or publish a new complete result."),
            ("Isolate each owner", "Every document, folder, and search candidate belongs to an authenticated owner. Apply ownership filters before returning files or ranking passages. Hiding another user's document in the interface is insufficient if the download endpoint or vector query can still expose it."),
            ("Bound the work", "Set limits on file size, page count, concurrent imports, and model requests. These limits make latency and spending easier to predict. A small local application can demonstrate real retrieval without a continuously running cloud database; cloud services can be added when the expected workload justifies their cost."),
        ],
    },
]


def make_pdf(note):
    output = io.BytesIO()
    fonts = Path(__file__).resolve().parent.parent / "assets" / "fonts"
    for name, filename in [("KeeperSans", "DejaVuSans.ttf"), ("KeeperBold", "DejaVuSans-Bold.ttf"), ("KeeperSerif", "DejaVuSerif.ttf")]:
        if name not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont(name, str(fonts / filename)))
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="NoteTitle", fontName="KeeperSerif", fontSize=25, leading=31, textColor=colors.HexColor("#262A27"), spaceAfter=12))
    styles.add(ParagraphStyle(name="NoteBody", fontName="KeeperSans", fontSize=10.5, leading=17, spaceAfter=18))
    styles.add(ParagraphStyle(name="NoteLabel", fontName="KeeperSans", fontSize=8, leading=12, textColor=colors.HexColor("#788272"), spaceAfter=18))
    styles.add(ParagraphStyle(name="NoteHeading", fontName="KeeperBold", fontSize=11, leading=15, spaceBefore=8, spaceAfter=9, keepWithNext=True))
    doc = SimpleDocTemplate(output, pagesize=(6.6 * inch, 9 * inch), leftMargin=46, rightMargin=46, topMargin=44, bottomMargin=42, title=note["title"], author="Finder-Keeper starter collection", invariant=1)
    story = [Paragraph("FINDER-KEEPER / STARTER NOTE", styles["NoteLabel"]), Paragraph(note["title"], styles["NoteTitle"]), Paragraph(note["subtitle"], styles["NoteBody"]), Spacer(1, 12)]
    for i, (heading, paragraph) in enumerate(note["paragraphs"]):
        if i == 2:
            story.extend([PageBreak(), Paragraph("FINDER-KEEPER / CONTINUED", styles["NoteLabel"]), Paragraph(note["title"], styles["NoteTitle"]), Spacer(1, 14)])
        story.extend([Paragraph(heading, styles["NoteHeading"]), Paragraph(paragraph, styles["NoteBody"])])
    story.extend([Spacer(1, 12), Paragraph("Original educational demonstration text. This is a starter note, not a published research paper. Created for Finder-Keeper; CC0. Verify technical decisions against authoritative sources.", styles["NoteLabel"])])

    def footer(canvas, document):
        canvas.setFont("KeeperSans", 7)
        canvas.setFillColor(colors.HexColor("#788272"))
        canvas.drawString(46, 25, "STARTER NOTE / ORIGINAL DEMONSTRATION TEXT")
        canvas.drawRightString(6.6 * inch - 46, 25, str(document.page))

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()


def seed_library():
    from .config import settings
    # Deletions stay deleted. Seeding happens once per local data directory, never for real accounts.
    marker = settings.data_dir / ".starter-seeded"
    if settings.auth_mode != "local" or not settings.seed_library or marker.exists():
        return
    owner = "local-user"
    folders = {}
    with Session.begin() as session:
        for name, color in [("Computer science", "sage"), ("Design & ideas", "lilac"), ("Reading room", "sand")]:
            folder = session.scalar(select(Folder).where(Folder.name == name, Folder.owner_id == owner))
            if not folder:
                folder = Folder(name=name, color=color, owner_id=owner)
                session.add(folder)
                session.flush()
            folders[name] = folder.id
    for note in NOTES:
        document, duplicate = store_document(make_pdf(note), note["slug"] + ".pdf", owner, folders[note["folder"]], title=note["title"], metadata={"is_starter": True, "authors": ["Finder-Keeper starter collection"], "year": 2026, "license": "CC0"})
        if duplicate and document.status == "ready":
            continue
        with Session.begin() as session:
            job = Job(owner_id=owner, document_id=document.id, status="processing", payload={"operation": "upload"})
            session.add(job)
            session.flush()
            job_id = job.id
        process_document(document.id, job_id)
    marker.write_text("Original starter notes were added once.\n")
