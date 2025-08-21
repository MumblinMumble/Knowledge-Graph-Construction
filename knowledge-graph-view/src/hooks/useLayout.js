// src/hooks/useLayout.js
import { useCallback } from 'react';

export default function useLayout(networkRef, network, graphData) {
  const applyLayout = useCallback(
    (mode) => {
      if (!network || !networkRef.current) return;

      const rect = networkRef.current.getBoundingClientRect();
      const W = rect.width || 800,
        H = rect.height || 600;
      const toCanvas = (dom) => network.DOMtoCanvas(dom);
      const ids = graphData.nodes.map((n) => String(n.id));

      if (mode === 'force') {
        network.setOptions({
          layout: { hierarchical: { enabled: false } },
          physics: { enabled: true },
        });
        network.stabilize();
        return;
      }
      if (mode === 'hierUD' || mode === 'hierLR') {
        network.setOptions({
          layout: {
            hierarchical: {
              enabled: true,
              direction: mode === 'hierLR' ? 'LR' : 'UD',
              sortMethod: 'hubsize',
              nodeSpacing: 150,
              levelSeparation: 200,
            },
          },
          physics: { enabled: false },
        });
        network.stabilize();
        return;
      }

      network.setOptions({
        layout: { hierarchical: { enabled: false } },
        physics: { enabled: false },
      });

      if (mode === 'circular') {
        const n = Math.max(ids.length, 1),
          R = Math.min(W, H) * 0.4;
        ids.forEach((id, i) => {
          const ang = (2 * Math.PI * i) / n;
          const { x, y } = toCanvas({
            x: W / 2 + R * Math.cos(ang),
            y: H / 2 + R * Math.sin(ang),
          });
          network.moveNode(id, x, y);
        });
        network.redraw();
        return;
      }

      if (mode === 'grid') {
        const n = ids.length,
          cols = Math.ceil(Math.sqrt(n)),
          rows = Math.ceil(n / cols);
        const pad = 40,
          stepX = (W - 2 * pad) / Math.max(1, cols - 1),
          stepY = (H - 2 * pad) / Math.max(1, rows - 1);
        ids.forEach((id, i) => {
          const r = Math.floor(i / cols),
            c = i % cols;
          const { x, y } = toCanvas({ x: pad + c * stepX, y: pad + r * stepY });
          network.moveNode(id, x, y);
        });
        network.redraw();
        return;
      }

      if (mode === 'concentric') {
        const deg = {};
        graphData.nodes.forEach((n) => (deg[n.id] = 0));
        graphData.edges.forEach((e) => {
          deg[e.from] = (deg[e.from] || 0) + 1;
          deg[e.to] = (deg[e.to] || 0) + 1;
        });

        const sorted = [...graphData.nodes].sort(
          (a, b) => (deg[b.id] || 0) - (deg[a.id] || 0),
        );
        const rings = 3,
          perRing = Math.ceil(sorted.length / rings),
          R0 = Math.min(W, H) * 0.15,
          dR = Math.min(W, H) * 0.15;

        sorted.forEach((n, idx) => {
          const ring = Math.floor(idx / perRing),
            pos = idx % perRing,
            count = Math.min(perRing, sorted.length - ring * perRing);
          const R = R0 + ring * dR,
            ang = (2 * Math.PI * pos) / count;
          const { x, y } = toCanvas({
            x: W / 2 + R * Math.cos(ang),
            y: H / 2 + R * Math.sin(ang),
          });
          network.moveNode(String(n.id), x, y);
        });
        network.redraw();
      }
    },
    [network, networkRef, graphData],
  );

  return { applyLayout };
}
