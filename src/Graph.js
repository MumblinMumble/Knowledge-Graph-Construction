import { useEffect, useRef } from 'react';
import { Network } from 'vis-network';
import axios from 'axios';

const Graph = () => {
  const networkRef = useRef(null);

  useEffect(() => {
    axios.get('http://localhost:8000/graph')
      .then(({ data }) => {
        // Map nodes from { id, labels, properties } to vis format
        const nodes = data.nodes.map(node => ({
          id: node.id,
          // use the 'name' property if it exists, otherwise join all labels
          label: node.properties.name || node.labels.join(','),
        }));

        // Map edges unchanged
        const edges = data.links.map(link => ({
          from: link.source,
          to: link.target,
          label: link.type,
        }));

        const networkData = { nodes, edges };
        const options = {
          nodes: { shape: 'dot' },
          edges: { arrows: 'to' },
        };

        new Network(networkRef.current, networkData, options);
      })
      .catch(err => console.error('Error fetching graph:', err));
  }, []);

  return <div style={{ height: '600px', border: '1px solid #ddd' }} ref={networkRef} />;
};

export default Graph;
