// src/components/Graph/utils/mappers.js
export const iriTail = (iri = '') => {
  try {
    const t = iri.split(/[\/#]/).pop() || iri;
    return decodeURIComponent(t);
  } catch {
    return iri;
  }
};

export const toVisNode = (n) => ({
  ...n,
  id: String(n.id),
  label: n.label ?? n.name ?? n.value ?? (n.iri ? iriTail(n.iri) : String(n.id)),
  title: n.iri || n.type || '',
  hidden: !!n.hidden,
  ...(n.type === 'Literal'
    ? {
        shape: 'box',
        font: { face: 'Inter, ui-sans-serif', size: 12 },
        color: {
          background: '#fde68a',
          border: '#f59e0b',
          highlight: { background: '#fcd34d', border: '#d97706' },
        },
      }
    : {}),
});

export const toVisEdge = (e) => ({
  ...e,
  id: String(e.id ?? `${e.from}->${e.to}-${e.label ?? (e.iri ? iriTail(e.iri) : '')}`),
  from: String(e.from),
  to: String(e.to),
  label: e.label ?? (e.iri ? iriTail(e.iri) : ''),
  arrows: 'to',
  hidden: !!e.hidden,
});
