/* eslint-disable no-restricted-globals */
import { Parser } from 'n3';

// Predicates treated as annotations (no literal nodes/edges created)
const LABEL_PREDS = new Set([
  'http://www.w3.org/2000/01/rdf-schema#label',
  'http://schema.org/name',
  'http://xmlns.com/foaf/0.1/name',
  'http://www.w3.org/2004/02/skos/core#prefLabel',
]);

const DESC_PREDS = new Set([
  'http://schema.org/description',
  'http://purl.org/dc/terms/description',
]);

// Keep in sync with your exporter (Graph.jsx BASE_IRI/exprop)
const EXPROP_PREFIX = 'http://example.org/prop/';

const localName = (iri) =>
  iri.slice(Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/')) + 1);

// Stable numeric id per RDF term key
const idFor = (() => {
  let next = 1;
  const map = new Map(); // termKey -> numeric id
  return (key) => {
    if (!map.has(key)) map.set(key, next++);
    return map.get(key);
  };
})();

self.onmessage = (e) => {
  const { text, contentType } = e.data || {};
  try {
    const parser = new Parser({
      format: contentType === 'text/turtle' ? 'text/turtle' : 'application/n-triples',
    });

    const quads = parser.parse(text);

    const nodesMap = new Map(); // idStr -> node
    const edges = [];

    // Create or return an existing node object for any RDF term
    const ensureNode = (term) => {
      const key =
        term.termType === 'NamedNode'
          ? `iri:${term.value}`
          : term.termType === 'BlankNode'
          ? `bnode:${term.value}`
          : term.termType === 'Literal'
          ? `lit:${term.value}|${term.language || ''}|${term.datatype?.value || ''}`
          : `unk:${term.value || term.id || Math.random()}`;

      const id = idFor(key);
      const idStr = String(id);

      if (!nodesMap.has(idStr)) {
        const base = { id, hidden: false };
        if (term.termType === 'NamedNode') {
          nodesMap.set(idStr, { ...base, iri: term.value, label: term.value });
        } else if (term.termType === 'BlankNode') {
          nodesMap.set(idStr, { ...base, bnode: term.value, label: `_:${term.value}` });
        } else if (term.termType === 'Literal') {
          nodesMap.set(idStr, {
            ...base,
            type: 'Literal',
            value: term.value,
            lang: term.language || undefined,
            datatype: term.datatype?.value || undefined,
            label: term.value,
          });
        } else {
          nodesMap.set(idStr, { ...base, label: idStr });
        }
      }
      return nodesMap.get(idStr);
    };

    // ---------- PASS 1: collect labels/descriptions/props on the subject ----------
    for (const q of quads) {
      const s = ensureNode(q.subject);
      const pIri = q.predicate.value;

      // rdfs:label → subject.label (no literal node, no edge)
      if (LABEL_PREDS.has(pIri) && q.object.termType === 'Literal') {
        s.label = q.object.value;
        if (q.object.language) s.lang = q.object.language;
        continue;
      }

      // description → subject.props.description (no literal node, no edge)
      if (DESC_PREDS.has(pIri) && q.object.termType === 'Literal') {
        s.props = s.props || {};
        s.props.description = q.object.value;
        continue;
      }

      // OPTIONAL: collapse exprop:* literal triples back into props
      if (pIri.startsWith(EXPROP_PREFIX) && q.object.termType === 'Literal') {
        const key = localName(pIri).replace(/_/g, ' ');
        s.props = s.props || {};
        s.props[key] = q.object.value;
        continue;
      }

      // For other predicates we don't need to touch object here; edges handled in Pass 2
    }

    // ---------- PASS 2: create edges (resources + non-collapsed literals) ----------
    let ei = 0;
    for (const q of quads) {
      const pIri = q.predicate.value;

      // Skip edges we collapsed in Pass 1
      if (
        (LABEL_PREDS.has(pIri) || DESC_PREDS.has(pIri)) &&
        q.object.termType === 'Literal'
      ) {
        continue;
      }
      if (pIri.startsWith(EXPROP_PREFIX) && q.object.termType === 'Literal') {
        continue;
      }

      const s = ensureNode(q.subject);
      const o = ensureNode(q.object);

      edges.push({
        id: `e_${++ei}`,
        from: s.id,
        to: o.id,
        iri: pIri,
        label: pIri, // you can shorten to CURIE in the UI if desired
      });
    }

    const nodes = Array.from(nodesMap.values());
    self.postMessage({ type: 'done', nodes, edges });
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
