// src/components/Graph/utils/theme.js
export function applyVisTheme(network) {
  network.setOptions({
    nodes: {
      shape: 'dot',
      size: 18,
      borderWidth: 2,
      font: {
        color: '#0f172a',
        size: 14,
        face: 'Inter, ui-sans-serif',
        strokeWidth: 2,
        strokeColor: '#ffffff',
      },
      color: {
        background: '#0ea5e9',
        border: '#0284c7',
        highlight: { background: '#22c55e', border: '#16a34a' },
        hover: { background: '#38bdf8', border: '#0284c7' },
      },
    },
    edges: {
      width: 1.5,
      selectionWidth: 2,
      smooth: false,
      color: {
        color: '#64748b',
        highlight: '#22c55e',
        hover: '#38bdf8',
        inherit: false,
      },
      font: {
        color: '#334155',
        size: 12,
        face: 'Inter, ui-sans-serif',
        strokeWidth: 2,
        strokeColor: '#ffffff',
        background: 'rgba(255,255,255,0.65)',
      },
      arrows: { to: { enabled: true, scaleFactor: 0.8 } },
    },
    interaction: { hover: true, tooltipDelay: 100 },
    physics: { enabled: true },
  });
}
