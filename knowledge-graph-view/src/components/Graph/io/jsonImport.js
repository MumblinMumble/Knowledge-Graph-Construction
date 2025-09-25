// src/components/Graph/io/jsonImport.js
import { toVisNode, toVisEdge } from '../utils/mappers';

export function makeJsonImportHandler({
  network,
  notify,
  setGraphData,
  setFilters,
  stripHidden,
  BATCH_SIZE_NODES,
  BATCH_SIZE_EDGES,
  suspendLayoutRef,
  skipVisSyncRef,
}) {
  return (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    suspendLayoutRef.current = true;
    skipVisSyncRef.current = true;

    network?.setOptions({
      physics: { enabled: false },
      layout: { improvedLayout: false },
      interaction: { hover: false, zoomSpeed: 0.8 },
      edges: { smooth: false },
      nodes: { shadow: false },
    });

    notify('Parsing JSON…', 'info', 3000);

    const worker = new Worker(new URL('../../../workers/jsonWorker.js', import.meta.url));
    worker.onmessage = (msg) => {
      const { type } = msg.data || {};
      if (type === 'error') {
        notify(`JSON parse failed: ${msg.data.message}`, 'error', 4000);
        suspendLayoutRef.current = false;
        skipVisSyncRef.current = false;
        network?.setOptions({ physics: { enabled: true }, interaction: { hover: true } });
        worker.terminate();
        return;
      }
      if (type === 'done') {
        const { nodes, edges } = stripHidden(msg.data);
        setFilters([]);

        if (!network) {
          setGraphData({ nodes, edges });
          notify(
            `JSON imported (${nodes.length} nodes, ${edges.length} edges)`,
            'success',
          );
          suspendLayoutRef.current = false;
          skipVisSyncRef.current = false;
          worker.terminate();
          return;
        }

        network.setData({ nodes: [], edges: [] });

        const dsNodes = network.body.data.nodes;
        const dsEdges = network.body.data.edges;

        let ni = 0,
          ei = 0;

        const feedNodes = () => {
          const slice = nodes.slice(ni, ni + BATCH_SIZE_NODES).map(toVisNode);
          dsNodes.update(slice);
          ni += slice.length;
          if (ni < nodes.length) setTimeout(feedNodes, 0);
          else setTimeout(feedEdges, 0);
        };

        const feedEdges = () => {
          const slice = edges.slice(ei, ei + BATCH_SIZE_EDGES).map(toVisEdge);
          dsEdges.update(slice);
          ei += slice.length;
          if (ei < edges.length) setTimeout(feedEdges, 0);
          else {
            requestAnimationFrame(() => {
              network.fit({ animation: false });
              network.setOptions({
                physics: { enabled: true },
                interaction: { hover: true, zoomSpeed: 0.8 },
              });
              setGraphData({ nodes, edges });
              notify(
                `JSON imported (${nodes.length} nodes, ${edges.length} edges)`,
                'success',
              );
              suspendLayoutRef.current = false;
              skipVisSyncRef.current = false;
              worker.terminate();
            });
          }
        };

        setTimeout(feedNodes, 0);
      }
    };

    const reader = new FileReader();
    reader.onload = ({ target }) => worker.postMessage({ text: target.result });
    reader.readAsText(file);
    e.target.value = '';
  };
}
