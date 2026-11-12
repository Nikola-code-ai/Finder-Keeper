from test_library import upload

from app.auth import current_email, current_owner
from app.database import Document, Session
from app.main import app


def as_friend(email="friend@example.org", uid="friend-uid"):
    app.dependency_overrides[current_owner] = lambda: uid
    app.dependency_overrides[current_email] = lambda: email


def as_me():
    app.dependency_overrides.clear()


def test_a_reader_gets_a_profile_and_may_change_their_handle(client):
    me = client.get("/api/me/profile").json()
    assert me["handle"] == "local-user" and me["display_name"] == "Local User" and me["owner"] is True
    assert client.get("/api/me/profile").json()["handle"] == "local-user", "asking twice keeps one profile"
    edited = client.patch("/api/me/profile", json={"handle": "Pip", "display_name": "Pip the spider", "bio": "I live in the window."}).json()
    assert edited == {**edited, "handle": "pip", "display_name": "Pip the spider", "bio": "I live in the window."}
    assert client.patch("/api/me/profile", json={"handle": "not ok!"}).status_code == 400
    as_friend()
    friend = client.get("/api/me/profile").json()
    assert friend["handle"] == "friend"
    assert client.patch("/api/me/profile", json={"handle": "pip"}).status_code == 409
    as_me()
    page = client.get("/api/community/readers/pip").json()
    assert page["display_name"] == "Pip the spider" and page["you"] is True and page["follower_count"] == 0
    assert client.get("/api/community/readers/nobody").status_code == 404
    assert {reader["handle"] for reader in client.get("/api/community/readers").json()["readers"]} == {"pip", "friend"}


def test_an_open_shelf_shows_its_catalogue_and_reads_only_open_texts(client):
    folder = client.post("/api/folders", json={"name": "Open shelf"}).json()
    kept = upload(client, b"A note on how small libraries lend a shelf to the neighbourhood without lending the whole room.", folder_id=folder["id"])["document"]
    private = upload(client, b"Something private kept outside the shelf that the commons must never list.")["document"]
    with Session.begin() as session:
        session.get(Document, kept["id"]).license = "CC BY 4.0"
    divider = client.post("/api/folders", json={"name": "Divider", "parent_id": folder["id"]}).json()
    inside = upload(client, b"A divider note under a licence that does not allow redistribution, so only its card is shown.", folder_id=divider["id"])["document"]

    assert client.get("/api/community/shelves").json()["shelves"] == []
    assert client.get(f"/api/community/shelves/{folder['id']}").status_code == 404
    assert client.post(f"/api/folders/{divider['id']}/publish", json={"published": True}).status_code == 400
    opened = client.post(f"/api/folders/{folder['id']}/publish", json={"published": True, "description": "Lent to the street."}).json()
    assert opened["published"] is True and opened["description"] == "Lent to the street."
    assert any(f["id"] == folder["id"] and f["published"] for f in client.get("/api/library").json()["folders"])

    app.dependency_overrides[current_owner] = lambda: (_ for _ in ()).throw(AssertionError("open shelves need no sign-in"))
    listed = client.get("/api/community/shelves").json()["shelves"]
    assert [shelf["id"] for shelf in listed] == [folder["id"]] and listed[0]["author"]["handle"] == "local-user" and listed[0]["count"] == 2
    shelf = client.get(f"/api/community/shelves/{folder['id']}").json()
    cards = {doc["id"]: doc for doc in shelf["documents"]}
    assert set(cards) == {kept["id"], inside["id"]}, "dividers travel with the shelf; the private memo stays home"
    assert cards[kept["id"]]["readable"] is True and cards[inside["id"]]["readable"] is False
    assert client.get(f"/api/community/documents/{kept['id']}").json()["pages"]
    assert client.get(f"/api/community/documents/{kept['id']}/file").status_code == 200
    assert client.get(f"/api/community/documents/{inside['id']}").status_code == 404
    assert client.get(f"/api/community/documents/{private['id']}").status_code == 404
    as_me()
    client.post(f"/api/folders/{folder['id']}/publish", json={"published": False})
    assert client.get(f"/api/community/shelves/{folder['id']}").status_code == 404
    assert client.get(f"/api/community/documents/{kept['id']}").status_code == 404


def test_reviews_meet_on_the_same_work_and_stay_with_their_author(client):
    mine = upload(client, b"The Sea Around Us, chapter one: the grey beginnings of the ocean.", "sea.txt")["document"]
    client.patch(f"/api/documents/{mine['id']}", json={"title": "The Sea Around Us"})
    review = client.post("/api/reviews", json={"document_id": mine["id"], "rating": 5, "body": "Carson writes the ocean like a biography."}).json()
    assert review["rating"] == 5 and review["title"] == "The Sea Around Us" and review["author"]["handle"] == "local-user"
    again = client.post("/api/reviews", json={"document_id": mine["id"], "rating": 4, "body": "On a second reading, four stars."}).json()
    assert again["id"] == review["id"] and again["rating"] == 4, "one review per reader per work"
    assert client.post("/api/reviews", json={"document_id": mine["id"], "rating": 6}).status_code == 422
    as_friend()
    theirs = upload(client, b"A different copy of the same book, kept by a friend.", "sea-friend.txt")["document"]
    client.patch(f"/api/documents/{theirs['id']}", json={"title": "The Sea Around Us"})
    assert client.post("/api/reviews", json={"document_id": mine["id"], "rating": 1}).status_code == 404, "you review what you keep"
    friends = client.post("/api/reviews", json={"document_id": theirs["id"], "rating": 3, "body": "Dated in places."}).json()
    assert friends["work_key"] == review["work_key"]
    assert client.delete(f"/api/reviews/{review['id']}").status_code == 404
    as_me()
    together = client.get(f"/api/community/reviews?work={review['work_key']}").json()["reviews"]
    assert {item["author"]["handle"] for item in together} == {"local-user", "friend"}
    assert [item["id"] for item in client.get("/api/reviews").json()["reviews"]] == [review["id"]]
    client.delete(f"/api/documents/{mine['id']}")
    assert client.get("/api/reviews").json()["reviews"][0]["document_id"] is None, "a review outlives the copy it was written from"
    assert client.delete(f"/api/reviews/{review['id']}").json()["deleted"]


def test_comments_hang_under_open_things_and_the_feed_tells_the_story(client):
    folder = client.post("/api/folders", json={"name": "Reef notes"}).json()
    upload(client, b"Coral reefs recover faster when grazing fish keep algae down.", folder_id=folder["id"])
    assert client.post("/api/comments", json={"target_kind": "shelf", "target_id": folder["id"], "body": "Lovely shelf."}).status_code == 201, "the owner may annotate their own closed shelf"
    as_friend()
    assert client.post("/api/comments", json={"target_kind": "shelf", "target_id": folder["id"], "body": "Peeking."}).status_code == 404
    assert client.get(f"/api/community/comments/shelf/{folder['id']}").status_code == 404
    as_me()
    client.post(f"/api/folders/{folder['id']}/publish", json={"published": True})
    flow = client.post("/api/flows", json={"goal": "reef recovery and grazing fish", "folder_id": folder["id"]}).json()
    client.patch(f"/api/flows/{flow['id']}", json={"published": True})
    as_friend()
    note = client.post("/api/comments", json={"target_kind": "flow", "target_id": flow["id"], "body": "Took the detour, worth it."}).json()
    assert note["author"]["handle"] == "friend"
    client.post("/api/comments", json={"target_kind": "shelf", "target_id": folder["id"], "body": "Thank you for opening this."})
    assert client.post("/api/comments", json={"target_kind": "shelf", "target_id": "nowhere", "body": "?"}).status_code == 404
    assert client.post("/api/follows/local-user").json() == {"following": True, "follower_count": 1}
    assert client.post("/api/follows/friend").status_code == 400
    following = client.get("/api/community/feed?scope=following").json()["items"]
    assert [item["kind"] for item in following] == ["flow", "shelf", "comment"], "newest first, and the friend's own notes are not among the readers they follow"
    as_me()
    shelf_comments = client.get(f"/api/community/comments/shelf/{folder['id']}").json()["comments"]
    assert [comment["body"] for comment in shelf_comments] == ["Lovely shelf.", "Thank you for opening this."]
    assert client.delete(f"/api/comments/{shelf_comments[1]['id']}").json()["deleted"], "the shelf's owner may remove a note under it"
    as_friend()
    assert client.delete(f"/api/comments/{shelf_comments[0]['id']}").status_code == 404, "but not someone else's note under someone else's shelf"
    as_me()
    feed = client.get("/api/community/feed").json()["items"]
    assert {item["kind"] for item in feed} == {"shelf", "flow", "comment"}
    assert feed[0]["kind"] == "comment" and feed[0]["href"] == f"/flows/{flow['id']}"
    reader = client.get("/api/community/readers/local-user").json()
    assert reader["shelf_count"] == 1 and reader["flow_count"] == 1 and reader["follower_count"] == 1 and [item["id"] for item in reader["flows"]] == [flow["id"]]
    as_friend()
    assert client.post("/api/follows/local-user").json()["following"] is False
    assert client.get("/api/community/feed?scope=following").json()["items"] == []
    as_me()
    client.delete(f"/api/flows/{flow['id']}")
    assert client.get(f"/api/community/comments/flow/{flow['id']}").status_code == 404
