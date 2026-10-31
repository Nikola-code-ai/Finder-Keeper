from app.auth import current_email, current_owner
from app.main import app
from test_library import upload


def test_a_friend_reads_and_searches_a_lent_collection_but_nothing_else(client):
    folder = client.post("/api/folders", json={"name": "Reef notes"}).json()
    kept = upload(client, b"Coral reefs recover faster when herbivorous fish keep algae from smothering new coral growth.", folder_id=folder["id"])
    private = upload(client, b"A private memo about whale migration routes that nobody else should see.")
    share = client.post(f"/api/folders/{folder['id']}/shares", json={"email": "Friend@Example.org"}).json()
    assert share["email"] == "friend@example.org" and share["role"] == "viewer"
    assert client.post(f"/api/folders/{folder['id']}/shares", json={"email": "friend@example.org"}).json()["id"] == share["id"]
    assert [s["email"] for s in client.get(f"/api/folders/{folder['id']}/shares").json()["shares"]] == ["friend@example.org"]

    app.dependency_overrides[current_owner] = lambda: "friend-uid"
    app.dependency_overrides[current_email] = lambda: "friend@example.org"
    library = client.get("/api/library").json()
    assert library["documents"] == [] and library["folders"] == []
    assert [s["name"] for s in library["shared"]] == ["Reef notes"]
    assert [d["id"] for d in library["shared"][0]["documents"]] == [kept["document"]["id"]]
    assert client.get("/api/documents/" + kept["document"]["id"]).status_code == 200
    assert client.get("/api/documents/" + kept["document"]["id"] + "/file").status_code == 200
    assert client.get("/api/documents/" + private["document"]["id"]).status_code == 404
    hits = client.post("/api/search", json={"query": "coral reef recovery", "folder_id": folder["id"]}).json()["results"]
    assert hits and hits[0]["document"]["id"] == kept["document"]["id"]
    assert client.post("/api/search", json={"query": "whale migration"}).json()["results"] == []
    assert client.delete("/api/documents/" + kept["document"]["id"]).status_code == 404
    assert client.patch("/api/folders/" + folder["id"], json={"name": "Mine now"}).status_code == 404

    app.dependency_overrides.clear()
    assert client.delete("/api/shares/" + share["id"]).json()["revoked"]
    app.dependency_overrides[current_owner] = lambda: "friend-uid"
    app.dependency_overrides[current_email] = lambda: "friend@example.org"
    assert client.get("/api/library").json()["shared"] == []
    assert client.get("/api/documents/" + kept["document"]["id"]).status_code == 404


def test_a_link_opens_one_collection_read_only_for_anyone(client):
    folder = client.post("/api/folders", json={"name": "Open shelf"}).json()
    kept = upload(client, b"An open note about how small libraries lend a shelf to a neighbour without lending the whole room.", folder_id=folder["id"])
    upload(client, b"Something kept outside the open shelf that the link must never reveal to a visitor.")
    link = client.post(f"/api/folders/{folder['id']}/shares", json={"link": True}).json()
    assert link["link"].startswith("/shared/") and link["email"] is None
    assert client.post(f"/api/folders/{folder['id']}/shares", json={"link": True}).json()["id"] == link["id"]
    token = link["link"].split("/")[-1]
    app.dependency_overrides[current_owner] = lambda: (_ for _ in ()).throw(AssertionError("link reads need no sign-in"))
    page = client.get("/api/shared/" + token).json()
    assert page["name"] == "Open shelf" and [d["id"] for d in page["documents"]] == [kept["document"]["id"]]
    assert client.get("/api/shared/" + token + "/documents/" + kept["document"]["id"]).json()["pages"]
    assert client.get("/api/shared/" + token + "/documents/" + kept["document"]["id"] + "/file").status_code == 200
    assert client.get("/api/shared/nonsense").status_code == 404
    app.dependency_overrides.clear()
    client.delete("/api/shares/" + link["id"])
    assert client.get("/api/shared/" + token).status_code == 404


def test_a_divider_cannot_be_shared_on_its_own(client):
    drawer = client.post("/api/folders", json={"name": "Drawer"}).json()
    divider = client.post("/api/folders", json={"name": "Divider", "parent_id": drawer["id"]}).json()
    assert client.post(f"/api/folders/{divider['id']}/shares", json={"email": "friend@example.org"}).status_code == 400
    assert client.post(f"/api/folders/{drawer['id']}/shares", json={"email": "me"}).status_code == 400
