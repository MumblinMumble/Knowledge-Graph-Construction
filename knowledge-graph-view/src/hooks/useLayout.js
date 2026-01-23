// src/hooks/useLayout.js
import { useCallback, useRef } from 'react';

export default function useLayout(networkRef, network /*, graphData */) {
  const stopTimeoutRef = useRef(null);

  const stopPhysics = useCallback(
    (ds, ids) => {
      if (!network || !ds?.update) return;

      try {
        ds.update(
          ids.map((id) => ({
            id,
            physics: false,
          })),
        );

        network.setOptions({
          physics: { enabled: false },
        });

        if (network.stopSimulation) {
          network.stopSimulation();
        }
      } catch {
        // ignore
      }
    },
    [network],
  );

  const applyLayout = useCallback(
    (mode) => {
      if (!network) return;

      const ds = network.body?.data?.nodes;

      // ─────────────── FORCE-DIRECTED (animated, then freeze) ───────────────
      if (mode === 'force') {
        if (!ds?.getIds || !ds.update) return;

        const ids = ds.getIds();
        if (!ids.length) return;

        // clear any previous stop timer
        if (stopTimeoutRef.current) {
          clearTimeout(stopTimeoutRef.current);
          stopTimeoutRef.current = null;
        }

        const positions = network.getPositions(ids);
        const jitter = 40; // small random push so they can escape the ring

        // Unlock + lightly jitter positions so physics can actually move them
        ds.update(
          ids.map((id) => {
            const p = positions[id] || { x: 0, y: 0 };
            return {
              id,
              x: p.x + (Math.random() - 0.5) * jitter,
              y: p.y + (Math.random() - 0.5) * jitter,
              fixed: false,
              physics: true,
            };
          }),
        );

        // Physics tuned more for "push apart then chill" than endless bouncing
        network.setOptions({
          layout: {
            hierarchical: false,
            improvedLayout: false, // better perf on big graphs
          },
          physics: {
            enabled: true,
            solver: 'forceAtlas2Based',
            forceAtlas2Based: {
              gravitationalConstant: -40,
              centralGravity: 0.01,
              springLength: 150,
              springConstant: 0.05,
              avoidOverlap: 0.8,
            },
            timestep: 0.5,
            stabilization: {
              enabled: false, // we’ll stop manually via timeout
            },
          },
        });

        // Let big graphs run a bit longer, but cap it so it doesn't go wild
        const durationMs = 1500 + ids.length * 2;

        stopTimeoutRef.current = window.setTimeout(() => {
          stopPhysics(ds, ids);
        }, durationMs);

        return;
      }

      // ─────────────── HIERARCHICAL LAYOUTS ───────────────
      const baseOptions = {
        physics: { enabled: false },
      };

      if (mode === 'hierUD') {
        network.setOptions({
          ...baseOptions,
          layout: {
            hierarchical: {
              enabled: true,
              direction: 'UD',
              sortMethod: 'hubsize',
              nodeSpacing: 200,
              levelSeparation: 150,
            },
          },
        });
      } else if (mode === 'hierLR') {
        network.setOptions({
          ...baseOptions,
          layout: {
            hierarchical: {
              enabled: true,
              direction: 'LR',
              sortMethod: 'hubsize',
              nodeSpacing: 200,
              levelSeparation: 150,
            },
          },
        });
      } else {
        // fallback: just turn physics off
        network.setOptions(baseOptions);
      }

      try {
        network.fit({ animation: false });
      } catch {
        // ignore
      }
    },
    [network, stopPhysics],
  );

  return { applyLayout };
}
