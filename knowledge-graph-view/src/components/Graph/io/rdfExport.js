// src/components/Graph/io/rdfExport.js
import { Writer, DataFactory } from 'n3';
const { namedNode, literal, quad } = DataFactory;

export async function serializeGraphToRDF(
  graphData,
  { slug, nodeToTerm, literalFromNode },
  format = 'ttl',
) {
  const prefixes = {
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    schema: 'http://schema.org/',
    ex: 'http://example.org/',
    exprop: 'http://example.org/prop/',
  };

  const writer = new Writer({
    prefixes,
    format: format === 'nt' ? 'N-Triples' : undefined,
  });

  const nodesById = new Map(graphData.nodes.map((n) => [String(n.id), n]));

  for (const n of graphData.nodes) {
    const s = nodeToTerm(n);
    if (!s) continue;

    if (n.label && n.label !== n.iri) {
      writer.addQuad(quad(s, namedNode(prefixes.rdfs + 'label'), literal(n.label)));
    }

    if (n.props && n.props.description) {
      writer.addQuad(
        quad(s, namedNode(prefixes.schema + 'description'), literal(n.props.description)),
      );
    }

    if (n.props) {
      for (const [k, v] of Object.entries(n.props)) {
        if (k === 'description') continue;
        const p = namedNode(prefixes.exprop + slug(k));
        writer.addQuad(quad(s, p, literal(String(v))));
      }
    }
  }

  for (const e of graphData.edges) {
    const sNode = nodesById.get(String(e.from));
    const oNode = nodesById.get(String(e.to));
    const s = nodeToTerm(sNode);
    if (!s) continue;
    const p = e.iri ? namedNode(e.iri) : namedNode(prefixes.exprop + slug(e.label));
    let o = nodeToTerm(oNode);
    if (oNode && (oNode.type === 'Literal' || 'value' in oNode)) {
      o = literalFromNode(oNode);
    }
    if (!o) continue;
    writer.addQuad(quad(s, p, o));
  }

  return new Promise((resolve, reject) => {
    writer.end((err, result) => (err ? reject(err) : resolve(result)));
  });
}
