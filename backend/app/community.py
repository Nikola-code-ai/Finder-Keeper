"""The commons: reading flows, readers' profiles, open shelves, reviews, comments and follows.

Public GETs under /api/community need no sign-in. Everything that writes is yours alone. A document's text leaves
the owner's library only when its licence allows it (open licences, public domain, the starter notes); otherwise
an open shelf shows the catalogue card and where to find the work.
"""
import inspect
import re
import threading
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from . import flows as planner
from .auth import current_email, current_owner
from .database import (
    Comment,
    Document,
    Flow,
    FlowProgress,
    Folder,
    Follow,
    Page,
    Profile,
    Review,
    Session,
    document_dict,
    now,
)
from .embeddings import embeddings

router = APIRouter()
Owner = Annotated[str, Depends(current_owner)]
Email = Annotated[str, Depends(current_email)]
OPEN_LICENCE = re.compile(r"cc0|cc[- ]by|creative commons|public domain|gutenberg|openstax|open access|oapen|starter", re.I)
HANDLE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$")
TARGETS = ("shelf", "flow", "review")


def viewer(request: Request) -> str | None:
    """Who is looking, if anyone. Public pages work signed out; signed in, the commons remembers your ticks."""
    resolve = request.app.dependency_overrides.get(current_owner, current_owner)
    try:
        return resolve(request) if inspect.signature(resolve).parameters else resolve()
    except HTTPException:
        return None


Viewer = Annotated[str | None, Depends(viewer)]


# ---------- readers ----------

def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:40] or "reader"


_profile_lock = threading.Lock()


def ensure_profile(session, owner, email=""):
    """A reader's profile is made the first time it is needed. Two requests arriving together make one."""
    profile = session.scalar(select(Profile).where(Profile.owner_id == owner))
    if profile:
        return profile
    with _profile_lock:
        profile = session.scalar(select(Profile).where(Profile.owner_id == owner))
        if profile:
            return profile
        local = (email.split("@")[0] if email else "") or "reader"
        base = slug(local)
        handle, n = base, 2
        while session.scalar(select(Profile.id).where(Profile.handle == handle)):
            handle, n = f"{base[:36]}-{n}", n + 1
        profile = Profile(owner_id=owner, handle=handle, display_name=re.sub(r"[-._]+", " ", local).strip().title()[:80] or "A reader")
        session.add(profile)
        session.flush()
        return profile


def profile_dict(profile, **extra):
    if not profile:
        return {"handle": None, "display_name": "A reader", "bio": "", **extra}
    return {"handle": profile.handle, "display_name": profile.display_name, "bio": profile.bio, "joined": profile.created_at, **extra}


def profiles_for(session, owner_ids):
    ids = {owner for owner in owner_ids if owner}
    if not ids:
        return {}
    return {profile.owner_id: profile for profile in session.scalars(select(Profile).where(Profile.owner_id.in_(ids))).all()}


class ProfileInput(BaseModel):
    handle: str | None = Field(default=None, min_length=2, max_length=40)
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    bio: str | None = Field(default=None, max_length=600)


@router.get("/api/me/profile")
def my_profile(owner: Owner, email: Email):
    with Session.begin() as session:
        return profile_dict(ensure_profile(session, owner, email), owner=True)


@router.patch("/api/me/profile")
def edit_profile(payload: ProfileInput, owner: Owner, email: Email):
    with Session.begin() as session:
        profile = ensure_profile(session, owner, email)
        if payload.handle is not None:
            handle = payload.handle.strip().lower()
            if not HANDLE.match(handle):
                raise HTTPException(400, "A handle is 2 to 40 letters, digits or hyphens")
            taken = session.scalar(select(Profile).where(Profile.handle == handle, Profile.owner_id != owner))
            if taken:
                raise HTTPException(409, "Another reader already goes by that handle")
            profile.handle = handle
        if payload.display_name is not None:
            if not payload.display_name.strip():
                raise HTTPException(400, "Give yourself a name")
            profile.display_name = payload.display_name.strip()
        if payload.bio is not None:
            profile.bio = payload.bio.strip()
        return profile_dict(profile, owner=True)


# ---------- open shelves (published collections) ----------

def public_readable(document):
    """Whether a document's text may leave its owner's library."""
    get = document.get if isinstance(document, dict) else lambda key, default=None: getattr(document, key, default)
    return bool(get("is_starter")) or bool(OPEN_LICENCE.search(get("license") or ""))


def shelf_ids(session, folder):
    return [folder.id, *session.scalars(select(Folder.id).where(Folder.parent_id == folder.id)).all()]


def shelf_dict(session, folder, profiles=None, with_documents=False):
    ids = shelf_ids(session, folder)
    docs = session.scalars(select(Document).where(Document.folder_id.in_(ids), Document.status == "ready").order_by(Document.created_at.desc())).all()
    comments = session.scalar(select(func.count()).select_from(Comment).where(Comment.target_kind == "shelf", Comment.target_id == folder.id))
    out = {"id": folder.id, "name": folder.name, "color": folder.color, "description": folder.description or "", "published_at": folder.published_at, "count": len(docs), "comment_count": comments,
           "author": profile_dict((profiles or profiles_for(session, [folder.owner_id])).get(folder.owner_id)), "href": f"/shelves/{folder.id}"}
    if with_documents:
        out["documents"] = [{**document_dict(doc), "readable": public_readable(doc)} for doc in docs]
    return out


class PublishInput(BaseModel):
    published: bool
    description: str | None = Field(default=None, max_length=600)


@router.post("/api/folders/{folder_id}/publish")
def publish_folder(folder_id: str, payload: PublishInput, owner: Owner, email: Email):
    with Session.begin() as session:
        folder = session.get(Folder, folder_id)
        if not folder or folder.owner_id != owner:
            raise HTTPException(404, "Folder not found")
        if folder.parent_id:
            raise HTTPException(400, "Open the drawer this divider sits in; dividers travel with it")
        ensure_profile(session, owner, email)
        if payload.published and not folder.published:
            folder.published_at = now()
        folder.published = payload.published
        if payload.description is not None:
            folder.description = payload.description.strip()
        from .main import folder_dict
        return folder_dict(folder, session.scalars(select(Document).where(Document.owner_id == owner)).all())


def published_folder(session, folder_id):
    folder = session.get(Folder, folder_id)
    if not folder or not folder.published:
        raise HTTPException(404, "This shelf is not open")
    return folder


@router.get("/api/community/shelves")
def open_shelves():
    with Session() as session:
        folders = session.scalars(select(Folder).where(Folder.published.is_(True)).order_by(Folder.published_at.desc())).all()
        profiles = profiles_for(session, [folder.owner_id for folder in folders])
        return {"shelves": [shelf_dict(session, folder, profiles) for folder in folders]}


@router.get("/api/community/shelves/{folder_id}")
def open_shelf(folder_id: str):
    with Session() as session:
        return shelf_dict(session, published_folder(session, folder_id), with_documents=True)


def exposed_document(session, document_id):
    """A document someone may read in the commons: on an open shelf or in a published flow, and openly licensed."""
    document = session.get(Document, document_id)
    if not document or document.status != "ready" or not public_readable(document):
        raise HTTPException(404, "This document is not open to read here")
    if document.folder_id:
        folder = session.get(Folder, document.folder_id)
        parent = session.get(Folder, folder.parent_id) if folder and folder.parent_id else None
        if (folder and folder.published) or (parent and parent.published):
            return document
    for flow in session.scalars(select(Flow).where(Flow.published.is_(True), Flow.owner_id == document.owner_id)).all():
        if any((step.get("document") or {}).get("id") == document.id for step in flow.graph.get("steps", [])):
            return document
    raise HTTPException(404, "This document is not open to read here")


@router.get("/api/community/documents/{document_id}")
def open_document(document_id: str):
    with Session() as session:
        document = exposed_document(session, document_id)
        pages = session.scalars(select(Page).where(Page.document_id == document.id).order_by(Page.page_number)).all()
        return {**document_dict(document), "readable": True, "pages": [{"page_number": page.page_number, "text": page.text} for page in pages]}


@router.get("/api/community/documents/{document_id}/file")
def open_document_file(document_id: str, download: bool = False):
    with Session() as session:
        document = exposed_document(session, document_id)
        from .main import document_file_response
        return document_file_response(document, download)


# ---------- reading flows ----------

def flow_dict(flow, session, progress=(), profiles=None):
    steps = flow.graph.get("steps", [])
    checkable = {step["id"] for step in steps if step.get("kind") in planner.CHECKABLE and step.get("kind") != "start"}
    ticked = set(progress)
    comments = session.scalar(select(func.count()).select_from(Comment).where(Comment.target_kind == "flow", Comment.target_id == flow.id))
    readers = session.scalar(select(func.count(func.distinct(FlowProgress.user_id))).where(FlowProgress.flow_id == flow.id))
    graph = {"steps": [{**step, "document": {**step["document"], "readable": public_readable(step["document"])}} if step.get("document") else step for step in steps], "edges": flow.graph.get("edges", [])}
    folder = session.get(Folder, flow.folder_id) if flow.folder_id else None
    return {"id": flow.id, "owner_id": flow.owner_id, "title": flow.title, "goal": flow.goal, "description": flow.description, "folder_id": flow.folder_id, "folder_name": folder.name if folder else None,
            "graph": graph, "source": flow.source, "model": flow.model, "published": flow.published, "published_at": flow.published_at, "created_at": flow.created_at, "updated_at": flow.updated_at,
            "author": profile_dict((profiles or profiles_for(session, [flow.owner_id])).get(flow.owner_id)), "progress": sorted(ticked), "step_count": len(checkable), "done_count": len(ticked & checkable),
            "complete": "finish" in ticked or (bool(checkable) and checkable <= ticked), "comment_count": comments, "reader_count": readers, "href": f"/flows/{flow.id}"}


def ticks(session, flow_id, user):
    if not user:
        return []
    return session.scalars(select(FlowProgress.step_id).where(FlowProgress.flow_id == flow_id, FlowProgress.user_id == user)).all()


def visible_flow(session, flow_id, user):
    flow = session.get(Flow, flow_id)
    if not flow or (flow.owner_id != user and not flow.published):
        raise HTTPException(404, "This flow is not open")
    return flow


class FlowBuildInput(BaseModel):
    goal: str = Field(min_length=3, max_length=500, pattern=r"\S")
    folder_id: str | None = None
    title: str | None = Field(default=None, max_length=200)


class FlowPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    published: bool | None = None
    graph: dict | None = None


@router.post("/api/flows", status_code=201)
def build_flow(payload: FlowBuildInput, owner: Owner, email: Email):
    """The Keeper reads the shelf and lays out a path. Branches are detours found by following each passage's own words."""
    if not embeddings.ready:
        raise HTTPException(503, "The embedding model is warming up. Please try again in a moment.")
    goal = " ".join(payload.goal.split())
    from .main import search_scope
    with Session() as session:
        owners, scope = search_scope(session, owner, email, payload.folder_id)
    graph = planner.plan(goal, owners, scope)
    if not graph:
        raise HTTPException(404, "Nothing in this library speaks to that yet. Add documents about it, or find some online, then ask again.")
    graph, model = planner.embellish(graph, goal)
    title = (payload.title or "").strip() or graph.pop("title", None) or (goal[0].upper() + goal[1:])[:200]
    description = graph.pop("description", None) or f"{sum(step['kind'] == 'read' for step in graph['steps'])} readings with {sum(step['kind'] == 'choice' for step in graph['steps'])} forks, laid out by the Keeper from your own shelf."
    graph.pop("title", None)
    graph.pop("description", None)
    with Session.begin() as session:
        ensure_profile(session, owner, email)
        flow = Flow(owner_id=owner, title=title[:200], goal=goal, description=description, folder_id=payload.folder_id, graph=graph, source="keeper", model=model)
        session.add(flow)
        session.flush()
        return flow_dict(flow, session)


@router.get("/api/flows")
def my_flows(owner: Owner):
    with Session() as session:
        mine = session.scalars(select(Flow).where(Flow.owner_id == owner).order_by(Flow.updated_at.desc())).all()
        followed_ids = {row for row in session.scalars(select(FlowProgress.flow_id).where(FlowProgress.user_id == owner).distinct()).all()} - {flow.id for flow in mine}
        following = session.scalars(select(Flow).where(Flow.id.in_(followed_ids), Flow.published.is_(True)).order_by(Flow.updated_at.desc())).all() if followed_ids else []
        profiles = profiles_for(session, [flow.owner_id for flow in [*mine, *following]])
        return {"flows": [flow_dict(flow, session, ticks(session, flow.id, owner), profiles) for flow in mine], "following": [flow_dict(flow, session, ticks(session, flow.id, owner), profiles) for flow in following]}


@router.get("/api/flows/{flow_id}")
def get_flow(flow_id: str, user: Viewer):
    with Session() as session:
        flow = visible_flow(session, flow_id, user)
        return flow_dict(flow, session, ticks(session, flow.id, user))


@router.get("/api/community/flows")
def published_flows():
    with Session() as session:
        flows = session.scalars(select(Flow).where(Flow.published.is_(True)).order_by(Flow.published_at.desc())).all()
        profiles = profiles_for(session, [flow.owner_id for flow in flows])
        return {"flows": [flow_dict(flow, session, (), profiles) for flow in flows]}


@router.get("/api/community/flows/{flow_id}")
def published_flow(flow_id: str, user: Viewer):
    with Session() as session:
        flow = session.get(Flow, flow_id)
        if not flow or not flow.published:
            raise HTTPException(404, "This flow is not open")
        return flow_dict(flow, session, ticks(session, flow.id, user))


@router.patch("/api/flows/{flow_id}")
def edit_flow(flow_id: str, payload: FlowPatch, owner: Owner, email: Email):
    with Session.begin() as session:
        flow = session.get(Flow, flow_id)
        if not flow or flow.owner_id != owner:
            raise HTTPException(404, "Flow not found")
        if payload.title is not None:
            if not payload.title.strip():
                raise HTTPException(400, "Give the flow a title")
            flow.title = payload.title.strip()
        if payload.description is not None:
            flow.description = payload.description.strip()
        if payload.graph is not None:
            try:
                flow.graph = planner.validate_graph(payload.graph)
            except ValueError as exc:
                raise HTTPException(400, str(exc)) from None
            flow.source = "edited"
        if payload.published is not None:
            if payload.published and not flow.published:
                flow.published_at = now()
                ensure_profile(session, owner, email)
            flow.published = payload.published
        flow.updated_at = now()
        return flow_dict(flow, session, ticks(session, flow.id, owner))


@router.delete("/api/flows/{flow_id}")
def delete_flow(flow_id: str, owner: Owner):
    with Session.begin() as session:
        flow = session.get(Flow, flow_id)
        if not flow or flow.owner_id != owner:
            raise HTTPException(404, "Flow not found")
        session.delete(flow)
        session.execute(Comment.__table__.delete().where(Comment.target_kind == "flow", Comment.target_id == flow_id))
    return {"deleted": True}


@router.post("/api/flows/{flow_id}/steps/{step_id}/toggle")
def toggle_step(flow_id: str, step_id: str, owner: Owner, email: Email):
    """Tick a step, or untick it. On a published flow anyone signed in keeps their own ticks."""
    with Session.begin() as session:
        flow = visible_flow(session, flow_id, owner)
        step = next((item for item in flow.graph.get("steps", []) if item.get("id") == step_id), None)
        if not step or step.get("kind") not in planner.CHECKABLE:
            raise HTTPException(404, "That step cannot be ticked")
        existing = session.scalar(select(FlowProgress).where(FlowProgress.flow_id == flow_id, FlowProgress.user_id == owner, FlowProgress.step_id == step_id))
        if existing:
            session.delete(existing)
        else:
            ensure_profile(session, owner, email)
            session.add(FlowProgress(flow_id=flow_id, user_id=owner, step_id=step_id))
        session.flush()
        return {"done": existing is None, **flow_dict(flow, session, ticks(session, flow.id, owner))}


# ---------- reviews ----------

def work_key(title, authors):
    first = (authors[0] if authors else "").lower()
    return re.sub(r"[^a-z0-9]+", "-", f"{title.lower()} {first}").strip("-")[:200]


def review_dict(review, profiles):
    return {"id": review.id, "document_id": review.document_id, "work_key": review.work_key, "title": review.title, "authors": review.authors, "year": review.year, "rating": review.rating, "body": review.body,
            "created_at": review.created_at, "updated_at": review.updated_at, "author": profile_dict(profiles.get(review.owner_id)), "href": f"/u/{profiles[review.owner_id].handle}" if review.owner_id in profiles else None}


class ReviewInput(BaseModel):
    document_id: str
    rating: int = Field(ge=1, le=5)
    body: str = Field(default="", max_length=4000)


@router.post("/api/reviews", status_code=201)
def write_review(payload: ReviewInput, owner: Owner, email: Email):
    with Session.begin() as session:
        document = session.get(Document, payload.document_id)
        if not document or document.owner_id != owner:
            raise HTTPException(404, "Review a book you keep in your own library")
        ensure_profile(session, owner, email)
        key = work_key(document.title, document.authors or [])
        review = session.scalar(select(Review).where(Review.owner_id == owner, Review.work_key == key))
        if review:
            review.rating, review.body, review.document_id, review.updated_at = payload.rating, payload.body.strip(), document.id, now()
        else:
            review = Review(owner_id=owner, document_id=document.id, work_key=key, title=document.title, authors=document.authors or [], year=document.year, rating=payload.rating, body=payload.body.strip())
            session.add(review)
        session.flush()
        return review_dict(review, profiles_for(session, [owner]))


@router.get("/api/reviews")
def my_reviews(owner: Owner):
    with Session() as session:
        reviews = session.scalars(select(Review).where(Review.owner_id == owner).order_by(Review.updated_at.desc())).all()
        return {"reviews": [review_dict(review, profiles_for(session, [owner])) for review in reviews]}


@router.delete("/api/reviews/{review_id}")
def delete_review(review_id: str, owner: Owner):
    with Session.begin() as session:
        review = session.get(Review, review_id)
        if not review or review.owner_id != owner:
            raise HTTPException(404, "Review not found")
        session.delete(review)
        session.execute(Comment.__table__.delete().where(Comment.target_kind == "review", Comment.target_id == review_id))
    return {"deleted": True}


@router.get("/api/community/reviews")
def public_reviews(work: str | None = None, limit: int = 40):
    with Session() as session:
        query = select(Review).order_by(Review.updated_at.desc()).limit(max(1, min(limit, 100)))
        if work:
            query = query.where(Review.work_key == work)
        reviews = session.scalars(query).all()
        profiles = profiles_for(session, [review.owner_id for review in reviews])
        return {"reviews": [review_dict(review, profiles) for review in reviews]}


# ---------- comments ----------

def comment_target(session, kind, target_id, user=None):
    """The thing a comment hangs under, if it is open to the commons (or your own)."""
    if kind == "shelf":
        folder = session.get(Folder, target_id)
        if folder and (folder.published or folder.owner_id == user):
            return folder.owner_id, folder.name, f"/shelves/{folder.id}"
    elif kind == "flow":
        flow = session.get(Flow, target_id)
        if flow and (flow.published or flow.owner_id == user):
            return flow.owner_id, flow.title, f"/flows/{flow.id}"
    elif kind == "review":
        review = session.get(Review, target_id)
        if review:
            profile = session.scalar(select(Profile).where(Profile.owner_id == review.owner_id))
            return review.owner_id, f"a review of {review.title}", f"/u/{profile.handle}" if profile else "/"
    raise HTTPException(404, "There is nothing to comment on here")


def comment_dict(comment, profiles):
    return {"id": comment.id, "target_kind": comment.target_kind, "target_id": comment.target_id, "body": comment.body, "created_at": comment.created_at, "author": profile_dict(profiles.get(comment.owner_id)), "owner_id": comment.owner_id}


class CommentInput(BaseModel):
    target_kind: Literal["shelf", "flow", "review"]
    target_id: str = Field(min_length=1, max_length=36)
    body: str = Field(min_length=1, max_length=2000, pattern=r"\S")


@router.get("/api/community/comments/{kind}/{target_id}")
def list_comments(kind: str, target_id: str, user: Viewer):
    if kind not in TARGETS:
        raise HTTPException(404, "There is nothing to comment on here")
    with Session() as session:
        comment_target(session, kind, target_id, user)
        comments = session.scalars(select(Comment).where(Comment.target_kind == kind, Comment.target_id == target_id).order_by(Comment.created_at)).all()
        profiles = profiles_for(session, [comment.owner_id for comment in comments])
        return {"comments": [comment_dict(comment, profiles) for comment in comments]}


@router.post("/api/comments", status_code=201)
def leave_comment(payload: CommentInput, owner: Owner, email: Email):
    with Session.begin() as session:
        comment_target(session, payload.target_kind, payload.target_id, owner)
        ensure_profile(session, owner, email)
        comment = Comment(owner_id=owner, target_kind=payload.target_kind, target_id=payload.target_id, body=payload.body.strip())
        session.add(comment)
        session.flush()
        return comment_dict(comment, profiles_for(session, [owner]))


@router.delete("/api/comments/{comment_id}")
def remove_comment(comment_id: str, owner: Owner):
    """The author may take a comment back; so may the owner of the shelf, flow or review it sits under."""
    with Session.begin() as session:
        comment = session.get(Comment, comment_id)
        if not comment:
            raise HTTPException(404, "Comment not found")
        try:
            target_owner = comment_target(session, comment.target_kind, comment.target_id, owner)[0]
        except HTTPException:
            target_owner = None
        if comment.owner_id != owner and target_owner != owner:
            raise HTTPException(404, "Comment not found")
        session.delete(comment)
    return {"deleted": True}


# ---------- readers' pages, follows and the feed ----------

def reader_counts(session, owner):
    return {
        "shelf_count": session.scalar(select(func.count()).select_from(Folder).where(Folder.owner_id == owner, Folder.published.is_(True))),
        "flow_count": session.scalar(select(func.count()).select_from(Flow).where(Flow.owner_id == owner, Flow.published.is_(True))),
        "review_count": session.scalar(select(func.count()).select_from(Review).where(Review.owner_id == owner)),
        "follower_count": session.scalar(select(func.count()).select_from(Follow).where(Follow.followed_id == owner)),
        "following_count": session.scalar(select(func.count()).select_from(Follow).where(Follow.follower_id == owner)),
    }


@router.get("/api/community/readers")
def readers(user: Viewer):
    with Session() as session:
        profiles = session.scalars(select(Profile).order_by(Profile.created_at.desc()).limit(100)).all()
        followed = set(session.scalars(select(Follow.followed_id).where(Follow.follower_id == user)).all()) if user else set()
        return {"readers": [profile_dict(profile, **reader_counts(session, profile.owner_id), following=profile.owner_id in followed, you=profile.owner_id == user) for profile in profiles]}


@router.get("/api/community/readers/{handle}")
def reader(handle: str, user: Viewer):
    with Session() as session:
        profile = session.scalar(select(Profile).where(Profile.handle == handle.lower()))
        if not profile:
            raise HTTPException(404, "No reader goes by that handle")
        owner = profile.owner_id
        following = bool(user) and session.scalar(select(Follow.id).where(Follow.follower_id == user, Follow.followed_id == owner)) is not None
        shelves = session.scalars(select(Folder).where(Folder.owner_id == owner, Folder.published.is_(True)).order_by(Folder.published_at.desc())).all()
        flows = session.scalars(select(Flow).where(Flow.owner_id == owner, Flow.published.is_(True)).order_by(Flow.published_at.desc())).all()
        reviews = session.scalars(select(Review).where(Review.owner_id == owner).order_by(Review.updated_at.desc())).all()
        profiles = {owner: profile}
        return {**profile_dict(profile, **reader_counts(session, owner), following=following, you=owner == user),
                "shelves": [shelf_dict(session, folder, profiles) for folder in shelves], "flows": [flow_dict(flow, session, ticks(session, flow.id, user), profiles) for flow in flows], "reviews": [review_dict(review, profiles) for review in reviews]}


@router.post("/api/follows/{handle}")
def toggle_follow(handle: str, owner: Owner, email: Email):
    with Session.begin() as session:
        profile = session.scalar(select(Profile).where(Profile.handle == handle.lower()))
        if not profile:
            raise HTTPException(404, "No reader goes by that handle")
        if profile.owner_id == owner:
            raise HTTPException(400, "You already keep your own company")
        ensure_profile(session, owner, email)
        existing = session.scalar(select(Follow).where(Follow.follower_id == owner, Follow.followed_id == profile.owner_id))
        if existing:
            session.delete(existing)
        else:
            session.add(Follow(follower_id=owner, followed_id=profile.owner_id))
        session.flush()
        return {"following": existing is None, "follower_count": session.scalar(select(func.count()).select_from(Follow).where(Follow.followed_id == profile.owner_id))}


@router.get("/api/community/feed")
def feed(user: Viewer, scope: Literal["all", "following"] = "all", limit: int = 40):
    """What the commons has been up to: shelves opened, flows published, reviews written, notes left."""
    with Session() as session:
        owners = None
        if scope == "following":
            if not user:
                raise HTTPException(401, "Sign in to follow readers")
            owners = set(session.scalars(select(Follow.followed_id).where(Follow.follower_id == user)).all())
            if not owners:
                return {"items": []}

        def scoped(query, column):
            return query.where(column.in_(owners)) if owners is not None else query

        folders = session.scalars(scoped(select(Folder).where(Folder.published.is_(True)), Folder.owner_id).order_by(Folder.published_at.desc()).limit(limit)).all()
        flows = session.scalars(scoped(select(Flow).where(Flow.published.is_(True)), Flow.owner_id).order_by(Flow.published_at.desc()).limit(limit)).all()
        reviews = session.scalars(scoped(select(Review), Review.owner_id).order_by(Review.updated_at.desc()).limit(limit)).all()
        comments = session.scalars(scoped(select(Comment), Comment.owner_id).order_by(Comment.created_at.desc()).limit(limit)).all()
        profiles = profiles_for(session, [*(f.owner_id for f in folders), *(f.owner_id for f in flows), *(r.owner_id for r in reviews), *(c.owner_id for c in comments)])
        items = []
        for folder in folders:
            items.append({"kind": "shelf", "id": folder.id, "at": folder.published_at or folder.created_at, "title": folder.name, "summary": folder.description or "An open shelf.", "author": profile_dict(profiles.get(folder.owner_id)), "href": f"/shelves/{folder.id}"})
        for flow in flows:
            items.append({"kind": "flow", "id": flow.id, "at": flow.published_at or flow.created_at, "title": flow.title, "summary": flow.description or flow.goal, "author": profile_dict(profiles.get(flow.owner_id)), "href": f"/flows/{flow.id}"})
        for review in reviews:
            items.append({"kind": "review", "id": review.id, "at": review.updated_at, "title": review.title, "summary": review.body[:280], "rating": review.rating, "work_key": review.work_key, "author": profile_dict(profiles.get(review.owner_id)), "href": f"/u/{profiles[review.owner_id].handle}" if review.owner_id in profiles else "/"})
        for comment in comments:
            try:
                _, target_title, href = comment_target(session, comment.target_kind, comment.target_id, None)
            except HTTPException:
                continue
            items.append({"kind": "comment", "id": comment.id, "at": comment.created_at, "title": target_title, "summary": comment.body[:280], "target_kind": comment.target_kind, "author": profile_dict(profiles.get(comment.owner_id)), "href": href})
        items.sort(key=lambda item: item["at"] or now(), reverse=True)
        return {"items": items[:max(1, min(limit, 100))]}
