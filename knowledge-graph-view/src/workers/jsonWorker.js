/* eslint-disable no-restricted-globals */
// src/workers/jsonWorker.js

// normalize id if numeric-like -> number, else keep as-is
const toIntIfNumeric = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : v;
};

self.onmessage = (e) => {
  try {
    const { text } = e.data;
    const parsed = JSON.parse(text);

    const rawNodes = parsed.nodes ?? [];
    const rawEdges = parsed.edges ?? parsed.links ?? [];

    const nodes = rawNodes.map((n, i) => {
      const id = toIntIfNumeric(n.id ?? i + 1);
      const name = n.name ?? n.label ?? `Node ${id}`;
      return {
        ...n,
        id,
        name,
        label: n.label ?? name,
      };
    });

    const edges = rawEdges.map((ed, i) => ({
      id: ed.id ?? `e_${i}`,
      from: toIntIfNumeric(ed.from ?? ed.source),
      to: toIntIfNumeric(ed.to ?? ed.target),
      label: ed.label ?? ed.rel ?? '',
      ...ed,
    }));

    self.postMessage({ type: 'done', nodes, edges });
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
