// src/hooks/useVisNetwork.js
import { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network';

export default function useVisNetwork() {
  const ref = useRef(null);
  const [net, setNet] = useState(null);

  useEffect(() => {
    if (!ref.current) return;

    const options = {
      autoResize: false,
      height: '100%',
      width: '100%',

      physics: {
        enabled: false, // 🔴 absolutely no physics here
      },

      layout: {
        improvedLayout: true,
      },

      nodes: {
        shape: 'dot',
        size: 12,
        font: { color: '#111' },
      },
      edges: {
        arrows: 'to',
        length: 200,
        smooth: { type: 'dynamic' },
      },
      interaction: {
        multiselect: false,
        selectable: true,
        hover: true,
        dragNodes: true, // you can still drag, but nothing springs back
      },
    };

    const instance = new Network(ref.current, { nodes: [], edges: [] }, options);
    setNet(instance);

    const handleResize = () => {
      instance.setSize('100%', '100%');
      instance.redraw();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      instance.destroy();
    };
  }, []);

  return { networkRef: ref, network: net };
}
