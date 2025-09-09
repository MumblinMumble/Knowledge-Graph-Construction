// src/utils/rdf.js
import { Parser as N3Parser } from 'n3';

const LABEL_PREDS = new Set([
  'http://www.w3.org/2000/01/rdf-schema#label',
  'http://xmlns.com/foaf/0.1/name',
  'http://schema.org/name',
]);

export function compactIri(iri) {
  const i = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'));
  return i >= 0 ? iri.slice(i + 1) : iri;
}

// Stable key for RDFJS Term
function termKey(t) {
  if (!t) return '';
  if (t.termType === 'NamedNode') return 'I|' + t.value;
  if (t.termType === 'BlankNode') return 'B|' + t.value;
  // include language/datatype to avoid literal collisions
  const dt = t.datatype?.value || '';
  const lg = t.language || '';
  return `L|${t.value}|${lg}|${dt}`;
}

/**
 * Parse .nt/.ttl and build {nodes, edges} with O(1) updates.
 * contentType: 'application/n-triples' | 'text/turtle'
 */
export function parseRdfText(rdfText, contentType = 'application/n-triples') {
  const format = contentType === 'text/turtle' ? 'Turtle' : 'N-Triples';
  const quads = new N3Parser({ format }).parse(rdfText);

  const termToId = new Map(); // termKey -> id
  const idToNode = new Map(); // id -> node obj (so we can mutate in O(1))
  const edges = [];
  let nextId = 1;

  const ensureNode = (t) => {
    const key = termKey(t);
    let id = termToId.get(key);
    if (id) return id;

    id = nextId++;
    let node;

    if (t.termType === 'NamedNode') {
      const label = compactIri(t.value);
      node = { id, iri: t.value, type: 'IRI', label, name: label };
    } else if (t.termType === 'BlankNode') {
      const label = '_:' + t.value;
      node = { id, bnode: t.value, type: 'BlankNode', label, name: label };
    } else {
      node = {
        id,
        type: 'Literal',
        value: t.value,
        lang: t.language || '',
        datatype: t.datatype?.value || '',
        label: t.value,
        name: t.value,
      };
    }

    termToId.set(key, id);
    idToNode.set(id, node);
    return id;
  };

  for (let i = 0; i < quads.length; i++) {
    const q = quads[i];
    const sId = ensureNode(q.subject);
    const oId = ensureNode(q.object);
    const pIri = q.predicate.value;

    // Apply human labels in O(1)
    if (LABEL_PREDS.has(pIri) && q.object.termType === 'Literal') {
      const n = idToNode.get(sId);
      if (n) {
        n.label = q.object.value;
        n.name = q.object.value;
      }
    }

    edges.push({
      id: `e_${i}`,
      from: sId,
      to: oId,
      label: compactIri(pIri),
      iri: pIri,
    });
  }

  const nodes = Array.from(idToNode.values());
  console.log('Nodes: ', nodes);
  return { nodes, edges };
}
