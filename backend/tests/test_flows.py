from test_library import upload

from app.auth import current_email, current_owner
from app.flows import distinctive_terms, plan, validate_graph
from app.main import app

REEF = b"""Coral reefs recover faster when herbivorous fish keep algae from smothering new coral growth. Parrotfish graze the reef flat
every morning and their grazing keeps the turf algae short. Where parrotfish were fished out, algae overgrew the dead coral and the
reef did not come back. Recovery after bleaching therefore depends on the grazing fish as much as on the water temperature."""
GRAZING = b"""Parrotfish grazing is a daily rhythm. Parrotfish bite the limestone itself and excrete fine sand; a single parrotfish turns
limestone into hundreds of kilograms of sand each year. Grazing pressure from parrotfish and surgeonfish shapes the whole reef
flat, and marine reserves that protect parrotfish show denser coral cover within a decade."""
BLEACHING = b"""Coral bleaching happens when warm water makes the coral expel the algae that live inside its tissue. A bleached coral is
not dead; if the water cools within weeks the coral can recover its algae. Repeated bleaching years leave less time for recovery,
and recovery is slower where the reef is already overgrown by turf algae."""
WHALES = b"""Humpback whales migrate between polar feeding grounds and tropical breeding lagoons. The migration routes follow deep
channels and the whales sing on the breeding grounds. Nothing here concerns reefs or coral."""


def library(client):
    folder = client.post("/api/folders", json={"name": "Reef notes"}).json()
    docs = {name: upload(client, data, f"{name}.txt", folder_id=folder["id"])["document"] for name, data in [("reef", REEF), ("grazing", GRAZING), ("bleaching", BLEACHING)]}
    docs["whales"] = upload(client, WHALES, "whales.txt")["document"]
    return folder, docs


def as_friend():
    app.dependency_overrides[current_owner] = lambda: "friend-uid"
    app.dependency_overrides[current_email] = lambda: "friend@example.org"


def test_the_keeper_lays_out_a_branching_path_through_the_library(client):
    folder, docs = library(client)
    flow = client.post("/api/flows", json={"goal": "how coral reefs recover after bleaching", "folder_id": folder["id"]}).json()
    steps, edges = flow["graph"]["steps"], flow["graph"]["edges"]
    kinds = [step["kind"] for step in steps]
    assert kinds[0] == "start" and kinds[-1] == "synthesize"
    reads = [step for step in steps if step["kind"] == "read"]
    assert reads, "the path reads real documents"
    assert {step["document"]["id"] for step in reads} <= {docs["reef"]["id"], docs["grazing"]["id"], docs["bleaching"]["id"]}, "the whale memo is outside the collection"
    assert all(step["excerpt"] and step["page"] >= 1 for step in reads), "every reading step points at a real passage"
    ids = {step["id"] for step in steps}
    assert all(edge["from"] in ids and edge["to"] in ids for edge in edges)
    # Every step other than the start can be reached from the start, and the finish is reached by every branch.
    reachable, frontier = {"start"}, ["start"]
    while frontier:
        current = frontier.pop()
        for edge in edges:
            if edge["from"] == current and edge["to"] not in reachable:
                reachable.add(edge["to"])
                frontier.append(edge["to"])
    assert reachable == ids
    choices = [step for step in steps if step["kind"] == "choice"]
    if choices:
        fork = choices[0]
        out = [edge for edge in edges if edge["from"] == fork["id"]]
        assert len(out) == 2 and {edge["label"] for edge in out} == {"Carry on", "Go deeper"}
        detour = next(step for step in steps if step["id"] == next(edge["to"] for edge in out if edge["label"] == "Go deeper"))
        assert detour["kind"] == "read" and detour.get("detour") is True
    assert flow["step_count"] == len(reads) + 1 and flow["done_count"] == 0 and flow["published"] is False
    assert flow["source"] == "keeper" and flow["model"] is None, "no language model in tests: the deterministic planner alone"
    assert flow["folder_name"] == "Reef notes"


def test_a_goal_the_library_knows_nothing_about_is_turned_away(client):
    library(client)
    response = client.post("/api/flows", json={"goal": "medieval cathedral stonemasonry guild wages"})
    assert response.status_code == 404
    assert "find some online" in response.json()["detail"]


def test_ticking_steps_is_per_reader_and_published_flows_can_be_followed(client):
    folder, docs = library(client)
    flow = client.post("/api/flows", json={"goal": "parrotfish grazing and reef recovery", "folder_id": folder["id"]}).json()
    first_read = next(step for step in flow["graph"]["steps"] if step["kind"] == "read")
    ticked = client.post(f"/api/flows/{flow['id']}/steps/{first_read['id']}/toggle").json()
    assert ticked["done"] is True and ticked["progress"] == [first_read["id"]] and ticked["done_count"] == 1
    assert client.post(f"/api/flows/{flow['id']}/steps/nonsense/toggle").status_code == 404
    choice = next((step for step in flow["graph"]["steps"] if step["kind"] == "choice"), None)
    if choice:
        assert client.post(f"/api/flows/{flow['id']}/steps/{choice['id']}/toggle").status_code == 404, "a fork is a question, not a task"
    finished = client.post(f"/api/flows/{flow['id']}/steps/finish/toggle").json()
    assert finished["complete"] is True
    assert client.post(f"/api/flows/{flow['id']}/steps/finish/toggle").json()["done"] is False

    # Unpublished: nobody else sees it. Published: anyone reads it and keeps their own ticks.
    as_friend()
    assert client.get(f"/api/flows/{flow['id']}").status_code == 404
    assert client.get(f"/api/community/flows/{flow['id']}").status_code == 404
    app.dependency_overrides.clear()
    published = client.patch(f"/api/flows/{flow['id']}", json={"published": True}).json()
    assert published["published"] is True and published["published_at"]
    assert [item["id"] for item in client.get("/api/community/flows").json()["flows"]] == [flow["id"]]
    as_friend()
    seen = client.get(f"/api/community/flows/{flow['id']}").json()
    assert seen["progress"] == [] and seen["author"]["handle"] == "local-user"
    assert client.patch(f"/api/flows/{flow['id']}", json={"title": "Mine now"}).status_code == 404
    assert client.delete(f"/api/flows/{flow['id']}").status_code == 404
    mine = client.post(f"/api/flows/{flow['id']}/steps/{first_read['id']}/toggle").json()
    assert mine["progress"] == [first_read["id"]]
    followed = client.get("/api/flows").json()
    assert followed["flows"] == [] and [item["id"] for item in followed["following"]] == [flow["id"]]
    assert followed["following"][0]["reader_count"] == 2
    app.dependency_overrides.clear()
    assert client.get(f"/api/flows/{flow['id']}").json()["progress"] == [first_read["id"]], "the owner's ticks are untouched by the friend's"
    # The whale memo is private and not in the flow, so its text stays closed; a step's document is readable only under an open licence.
    assert client.get(f"/api/community/documents/{first_read['document']['id']}").status_code == 404
    assert client.get(f"/api/community/documents/{docs['whales']['id']}").status_code == 404


def test_a_flow_can_be_edited_by_hand_and_deleted(client):
    folder, docs = library(client)
    flow = client.post("/api/flows", json={"goal": "coral bleaching recovery", "folder_id": folder["id"], "title": "Reef path"}).json()
    assert flow["title"] == "Reef path"
    graph = {"steps": [{"id": "start", "kind": "start", "title": "Begin"}, {"id": "a", "kind": "read", "title": "Read the reef note", "document": {"id": docs["reef"]["id"], "title": "reef"}, "page": 1, "excerpt": "Coral reefs recover faster"},
                       {"id": "q", "kind": "choice", "title": "Curious about whales?"}, {"id": "w", "kind": "read", "title": "Whales", "document": {"id": docs["whales"]["id"], "title": "whales"}, "page": 1},
                       {"id": "finish", "kind": "synthesize", "title": "Done", "query": "coral"}],
             "edges": [{"from": "start", "to": "a"}, {"from": "a", "to": "q"}, {"from": "q", "to": "finish", "label": "Carry on"}, {"from": "q", "to": "w", "label": "Go deeper"}, {"from": "w", "to": "finish"}]}
    edited = client.patch(f"/api/flows/{flow['id']}", json={"graph": graph, "description": "Hand drawn."}).json()
    assert [step["id"] for step in edited["graph"]["steps"]] == ["start", "a", "q", "w", "finish"] and edited["source"] == "edited" and edited["description"] == "Hand drawn."
    assert client.patch(f"/api/flows/{flow['id']}", json={"graph": {"steps": [{"id": "x", "kind": "read", "title": "X"}], "edges": [{"from": "x", "to": "y"}]}}).status_code == 400
    assert client.patch(f"/api/flows/{flow['id']}", json={"graph": {"steps": [{"id": "x", "kind": "mystery", "title": "X"}], "edges": []}}).status_code == 400
    assert client.patch(f"/api/flows/{flow['id']}", json={"title": "   "}).status_code == 400
    assert client.delete(f"/api/flows/{flow['id']}").json()["deleted"]
    assert client.get(f"/api/flows/{flow['id']}").status_code == 404
    assert client.get("/api/flows").json()["flows"] == []


def test_the_planner_is_grounded_in_the_passages_it_is_handed():
    reef = {"id": "d1", "title": "Reef", "authors": [], "year": None, "kind": "PDF", "page_count": 3, "license": "CC0", "source_url": None, "is_starter": False}
    grazing = {"id": "d2", "title": "Grazing", "authors": [], "year": None, "kind": "PDF", "page_count": 2, "license": None, "source_url": None, "is_starter": False}
    hit = lambda doc, page, score, text: {"document": doc, "page_number": page, "score": score, "excerpt": text, "passage": text, "match_type": "semantic", "location_label": f"Page {page}"}  # noqa: E731

    def search(query, owners, scope, limit=8):
        if "parrotfish" in query:
            return [hit(grazing, 1, .7, "Parrotfish grazing keeps turf algae short on the reef flat; parrotfish graze every morning.")]
        return [hit(reef, 2, .9, "Parrotfish graze the reef and keep algae short, so coral recovers after bleaching when parrotfish survive.")]

    graph = plan("how coral recovers", ["me"], None, search=search)
    kinds = [step["kind"] for step in graph["steps"]]
    assert kinds == ["start", "read", "choice", "read", "synthesize"]
    assert graph["steps"][1]["document"]["id"] == "d1" and graph["steps"][3]["document"]["id"] == "d2" and graph["steps"][3]["detour"]
    labels = {(edge["from"], edge["to"]): edge.get("label") for edge in graph["edges"]}
    assert labels[("start", "s1")] == "Start here" and labels[("c1", "finish")] == "Carry on" and labels[("c1", "s2")] == "Go deeper" and ("s2", "finish") in labels
    assert plan("anything", ["me"], None, search=lambda *a, **k: []) is None
    assert distinctive_terms("Parrotfish graze the reef and parrotfish keep algae short; grazing shapes the reef flat.", {"reef"})[0] == "parrotfish"
    assert validate_graph({"steps": [{"id": "a", "kind": "read", "title": "A", "note": "n", "document": {"id": "d", "title": "D", "secret": 1}}], "edges": []})["steps"][0]["document"] == {"id": "d", "title": "D", "authors": None, "year": None, "kind": None, "page_count": None, "license": None, "source_url": None, "is_starter": None}
