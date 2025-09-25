/* eslint-disable no-restricted-globals */
// src/workers/rdfWorker.js
import { Parser } from 'n3';

// label predicates
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const SKOS_PREF = 'http://www.w3.org/2004/02/skos/core#prefLabel';
const SCHEMA_NAME = 'http://schema.org/name';

const iri2id = new Map(); // IRI/blank-id -> numeric id
const lit2id = new Map(); // literal signature -> id
const nodeMap = new Map(); // id -> node
const edgeMap = new Map(); // key -> edge
const bestLbl = new Map(); // iri -> { value, lang }
let nextId = 1;

const safeDecode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
const iriLocal = (iri = '') => {
  const d = safeDecode(iri);
  const i = Math.max(d.lastIndexOf('#'), d.lastIndexOf('/'), d.lastIndexOf(':'));
  const t = d.slice(i + 1);
  return t.length > 64 ? t.slice(0, 61) + '…' : t;
};
const looksUrlLiteral = (v = '') => /^(https?:\/\/|www\.)/i.test(v);

function upsertIriNode(iri) {
  let id = iri2id.get(iri);
  if (!id) {
    id = nextId++;
    iri2id.set(iri, id);
    const lbl = iriLocal(iri);
    nodeMap.set(id, { id, iri, label: lbl, name: lbl });
  }
  return id;
}
function litKey(v, lang, dt) {
  return `${v}||${lang || ''}||${dt || ''}`;
}
function upsertLiteralNode(value, lang, datatype) {
  const dt = typeof datatype === 'string' ? datatype : datatype?.value || '';
  const key = litKey(value, lang, dt);
  let id = lit2id.get(key);
  if (!id) {
    id = nextId++;
    lit2id.set(key, id);
    nodeMap.set(id, {
      id,
      type: 'Literal',
      value,
      lang: lang || undefined,
      datatype: dt || undefined,
      label: value.length > 64 ? value.slice(0, 61) + '…' : value,
      name: value,
    });
  }
  return id;
}
function upsertEdge(sId, pIri, oId) {
  if (!sId || !oId) return;
  const key = `${sId}|${pIri}|${oId}`;
  if (edgeMap.has(key)) return;
  edgeMap.set(key, {
    id: `e_${edgeMap.size + 1}`,
    from: sId,
    to: oId,
    iri: pIri,
    label: iriLocal(pIri),
  });
}
function applyBestLabels() {
  for (const [iri, info] of bestLbl.entries()) {
    const id = iri2id.get(iri);
    if (!id) continue;
    const n = nodeMap.get(id);
    if (!n) continue;
    const v = info.value;
    n.label = v.length > 64 ? v.slice(0, 61) + '…' : v;
    n.name = v;
  }
}

function parseRDF(text, contentType) {
  // IMPORTANT: use N3's format tokens, not MIME types
  const isNT = /n-?triples/i.test(contentType || '');
  const parser = new Parser({ format: isNT ? 'N-Triples' : 'Turtle' });

  // Use array mode (more robust than callback mode)
  const quads = parser.parse(text);

  // 1st pass: collect labels & ensure subj nodes exist
  for (const q of quads) {
    const { subject: s, predicate: p, object: o } = q;
    if (
      o.termType === 'Literal' &&
      (p.value === RDFS_LABEL || p.value === SKOS_PREF || p.value === SCHEMA_NAME)
    ) {
      if (s.termType === 'NamedNode' || s.termType === 'BlankNode') {
        upsertIriNode(s.value);
        const lang = (o.language || '').toLowerCase();
        const prev = bestLbl.get(s.value);
        if (!prev || (lang === 'en' && prev.lang !== 'en')) {
          bestLbl.set(s.value, { value: o.value, lang });
        }
      }
    }
  }

  // 2nd pass: make nodes/edges
  for (const q of quads) {
    const { subject: s, predicate: p, object: o } = q;

    // skip label triples as edges
    if (
      o.termType === 'Literal' &&
      (p.value === RDFS_LABEL || p.value === SKOS_PREF || p.value === SCHEMA_NAME)
    )
      continue;

    // subject
    let sId = null;
    if (s.termType === 'NamedNode' || s.termType === 'BlankNode')
      sId = upsertIriNode(s.value);
    else continue; // rare literal subject -> skip

    // object
    let oId = null;
    if (o.termType === 'NamedNode' || o.termType === 'BlankNode') {
      oId = upsertIriNode(o.value);
    } else if (o.termType === 'Literal') {
      if (looksUrlLiteral(o.value)) continue; // drop URL-like literals
      oId = upsertLiteralNode(o.value, o.language, o.datatype);
    } else continue;

    upsertEdge(sId, p.value, oId);
  }

  applyBestLabels();

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}

self.onmessage = (ev) => {
  try {
    const { text, contentType } = ev.data || {};
    if (!text) {
      self.postMessage({ type: 'error', message: 'No text provided' });
      return;
    }
    // reset state
    iri2id.clear();
    lit2id.clear();
    nodeMap.clear();
    edgeMap.clear();
    bestLbl.clear();
    nextId = 1;

    const { nodes, edges } = parseRDF(text, contentType || '');
    self.postMessage({ type: 'done', nodes, edges });
  } catch (e) {
    self.postMessage({ type: 'error', message: e?.message || String(e) });
  }
};
