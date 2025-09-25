// src/components/Graph/utils/stripHidden.js
export const stripHidden = ({ nodes, edges }) => ({
  nodes: (nodes ?? []).map((n) => ({ ...n, hidden: false })),
  edges: (edges ?? []).map((e) => ({ ...e, hidden: false })),
});
