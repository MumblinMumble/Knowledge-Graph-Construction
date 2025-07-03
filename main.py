from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from neo4j import GraphDatabase
from dotenv import load_dotenv
import os

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    uri = os.getenv("NEO4J_URI")
    user = os.getenv("NEO4J_USER")
    password = os.getenv("NEO4J_PASSWORD")
    return GraphDatabase.driver(uri, auth=(user, password))

@app.get("/graph")
def read_graph():
    driver = get_db()
    query = "MATCH (n)-[r]->(m) RETURN n,r,m LIMIT 100"
    with driver.session() as session:
        result = session.run(query)
        nodes_by_id = {}
        links = []

        for record in result:
            n = record["n"]
            m = record["m"]
            rel = record["r"]

            # Add or update node n
            if n.id not in nodes_by_id:
                nodes_by_id[n.id] = {
                    "id": n.id,
                    "labels": list(n.labels),
                    "properties": dict(n)
                }
            # Add or update node m
            if m.id not in nodes_by_id:
                nodes_by_id[m.id] = {
                    "id": m.id,
                    "labels": list(m.labels),
                    "properties": dict(m)
                }

            # Add the relationship
            links.append({
                "source": n.id,
                "target": m.id,
                "type": rel.type,
                "properties": dict(rel)
            })

    # Return a list of node objects plus links
    return {
        "nodes": list(nodes_by_id.values()),
        "links": links
    }
