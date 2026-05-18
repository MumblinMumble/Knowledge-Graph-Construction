// src/components/Graph/io/sparql.js

// --- tiny helpers -----------------------------------------------------------
export const iriTail = (iri = '') => {
  try {
    const t = String(iri).split(/[\/#]/).pop() || iri;
    return decodeURIComponent(t);
  } catch {
    return String(iri);
  }
};

const slug = (s = '') =>
  String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'relatedTo';

const looksLikeIri = (x) => typeof x === 'string' && /^https?:\/\//i.test(x);

// --- Stable ID cache (per SPARQL run) --------------------------------------
/**
 * We keep node ids stable inside a single SPARQL run so repeated IRIs/literals
 * map to the same numeric id. Clear this before each run.
 */
const _idCache = {
  iri: new Map(), // iri -> id
  lit: new Map(), // JSON-encoded literal -> id
  next: 1,
};

export function resetSparqlIdCache() {
  _idCache.iri.clear();
  _idCache.lit.clear();
  _idCache.next = 1;
}

const idForIri = (iri) => {
  let id = _idCache.iri.get(iri);
  if (!id) {
    id = _idCache.next++;
    _idCache.iri.set(iri, id);
  }
  return id;
};

const litKey = (lit) =>
  JSON.stringify({
    v: lit?.value ?? '',
    lang: lit?.language || lit?.lang || '',
    dt: lit?.datatype?.value || lit?.datatype || '',
  });

const idForLiteral = (lit) => {
  const key = litKey(lit);
  let id = _idCache.lit.get(key);
  if (!id) {
    id = _idCache.next++;
    _idCache.lit.set(key, id);
  }
  return id;
};

// --- Query parsing (super light) -------------------------------------------
/**
 * We only support local SELECTs over triples already in memory.
 * Anything that looks like SELECT ... WHERE { ?s ?p ?o } will return all edges
 * from the current graph (optionally honoring LIMIT N).
 */
const LIMIT_RE = /limit\s+(\d+)/i;

const parseLimit = (query) => {
  const m = String(query || '').match(LIMIT_RE);
  return m ? Math.max(0, parseInt(m[1], 10)) : null;
};

// --- Local SELECT over the in-memory graph ---------------------------------
/**
 * Returns { vars: ['s','p','o'], rows: [{s, p, o}, ...] }.
 * s/p/o are either IRIs (strings) or literal objects:
 *   { termType:'Literal', value, language, datatype:{ value } }
 */
export async function runSparqlSelectLocal(graphData, query) {
  const limit = parseLimit(query);
  const rows = [];

  // Build node index
  const nodesById = new Map((graphData?.nodes || []).map((n) => [String(n.id), n]));

  // Walk each edge and emit a triple row
  for (const e of graphData?.edges || []) {
    const sNode = nodesById.get(String(e.from));
    const oNode = nodesById.get(String(e.to));

    // Subject IRI
    const sIri =
      sNode?.iri || `http://example.org/node/${encodeURIComponent(String(e.from))}`;

    // Predicate IRI
    const predLabel = e.label || (e.iri ? iriTail(e.iri) : 'relatedTo');
    const pIri = e.iri || `http://example.org/prop/${slug(predLabel)}`;

    // Object: IRI or Literal
    let o;
    if (
      oNode?.type === 'Literal' ||
      Object.prototype.hasOwnProperty.call(oNode || {}, 'value')
    ) {
      o = {
        termType: 'Literal',
        value: oNode?.value ?? oNode?.label ?? '',
        language: oNode?.lang || '',
        datatype: oNode?.datatype ? { value: oNode.datatype } : undefined,
      };
    } else {
      o = oNode?.iri || `http://example.org/node/${encodeURIComponent(String(e.to))}`;
    }

    rows.push({ s: sIri, p: pIri, o });
    if (limit != null && rows.length >= limit) break;
  }

  console.debug('[SPARQL][local] rows:', rows.length);
  return { vars: ['s', 'p', 'o'], rows };
}

// Alias used by Graph.jsx
export const runSparqlSelect = runSparqlSelectLocal;

// --- Rows → Graph -----------------------------------------------------------
/**
 * Convert SELECT rows to a visualization-ready subgraph:
 *   nodes: [{ id, iri|value, label, type? }]
 *   edges: [{ id, from, to, label, iri }]
 *
 * Accepts rows where o can be an IRI string or a literal object.
 */
export function rowsToGraph({ vars, rows }) {
  const nodesById = new Map();
  const edges = [];
  let edgeSeq = 1;

  const addIriNode = (iri) => {
    const id = idForIri(iri);
    if (!nodesById.has(id)) {
      nodesById.set(id, { id, iri, label: iriTail(iri) });
    }
    return id;
  };

  const addLiteralNode = (lit) => {
    const id = idForLiteral(lit);
    if (!nodesById.has(id)) {
      nodesById.set(id, {
        id,
        type: 'Literal',
        value: lit?.value ?? '',
        label: lit?.value ?? '',
        lang: lit?.language || lit?.lang || '',
        datatype: lit?.datatype?.value || lit?.datatype || '',
      });
    }
    return id;
  };

  for (const r of rows || []) {
    const sIri = looksLikeIri(r.s) ? r.s : String(r.s || '');
    const pIri = looksLikeIri(r.p) ? r.p : String(r.p || '');
    const oVal = r.o;

    if (!sIri || !pIri || oVal == null) continue;

    const from = addIriNode(sIri);
    const to =
      typeof oVal === 'string' && looksLikeIri(oVal)
        ? addIriNode(oVal)
        : addLiteralNode(oVal);

    const edgeId = `sp_${edgeSeq++}`;
    edges.push({
      id: edgeId,
      from,
      to,
      label: iriTail(pIri),
      iri: pIri,
    });
  }

  const nodes = Array.from(nodesById.values());
  console.debug('[SPARQL][rowsToGraph] nodes:', nodes.length, 'edges:', edges.length);
  return { nodes, edges };
}
