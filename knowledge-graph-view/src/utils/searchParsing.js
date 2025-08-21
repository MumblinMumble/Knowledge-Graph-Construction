// src/utils/searchParsing.js
export const eqCI = (a, b) =>
  String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();

export const parseNodeSearch = (s) =>
  s.match(/^node\s*:\s*([^=:\s]+)\s*=\s*(.+)$/i)
    ? { key: RegExp.$1, value: RegExp.$2 }
    : null;
export const parseEdgeSearch = (s) =>
  s.match(/^edge\s*:\s*([^=:\s]+)\s*=\s*(.+)$/i)
    ? { key: RegExp.$1, value: RegExp.$2 }
    : null;
export const parseFilterNode = (s) =>
  s.match(/^filter\s+node\s*:\s*([^=:\s]+)\s*=\s*(.+)$/i)
    ? { key: RegExp.$1, value: RegExp.$2 }
    : null;
export const parseFilterEdge = (s) =>
  s.match(/^filter\s+edge\s*:\s*([^=:\s]+)\s*=\s*(.+)$/i)
    ? { key: RegExp.$1, value: RegExp.$2 }
    : null;
