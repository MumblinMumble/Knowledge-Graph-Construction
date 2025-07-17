import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from pydantic import BaseModel

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GRAPH_FILE = 'graph.json'

class GraphData(BaseModel):
    nodes: list
    links: list

@app.get("/graph")
async def read_graph():
    if not os.path.exists(GRAPH_FILE):
        raise HTTPException(status_code=404, detail="Graph file not found")
    with open(GRAPH_FILE, 'r') as f:
        data = json.load(f)
    # Map legacy 'links' to 'edges' for frontend
    return { 'nodes': data.get('nodes', []), 'edges': data.get('links', []) }

@app.post("/graph")
async def write_graph(graph: GraphData):
    out = { 'nodes': graph.nodes, 'links': graph.links }
    with open(GRAPH_FILE, 'w') as f:
        json.dump(out, f, indent=2)
    return "Graph saved to graph.json"
