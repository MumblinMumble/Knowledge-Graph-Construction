// src/hooks/useVisNetwork.js
import { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network';

export default function useVisNetwork() {
  const ref = useRef(null);
  const [net, setNet] = useState(null);

  useEffect(() => {
    const options = {
      nodes: { shape: 'dot', size: 12, font: { color: '#111' } },
      edges: { arrows: 'to', length: 200, smooth: { type: 'dynamic' } },
      physics: {
        barnesHut: {
          gravitationalConstant: -8000,
          springLength: 200,
          springConstant: 0.04,
        },
        stabilization: { iterations: 250 },
      },
      interaction: { multiselect: true, hover: true },
    };
    const instance = new Network(ref.current, { nodes: [], edges: [] }, options);
    setNet(instance);

    const ro = new ResizeObserver(() => instance.redraw());
    ref.current && ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return { networkRef: ref, network: net };
}
