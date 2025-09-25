// src/components/Graph/io/rdfImport.js
import { toVisNode, toVisEdge } from '../utils/mappers';

export function makeRdfImportHandler({
  network,
  notify,
  setGraphData,
  setFilters,
  stripHidden,
  BATCH_SIZE_NODES,
  BATCH_SIZE_EDGES,
  BIG_IMPORT_THRESHOLD,
  suspendLayoutRef,
  skipVisSyncRef,
}) {
  return (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isTTL = file.name.toLowerCase().endsWith('.ttl');
    const contentType = isTTL ? 'text/turtle' : 'application/n-triples';

    suspendLayoutRef.current = true;
    skipVisSyncRef.current = true;

    network?.setOptions({
      physics: { enabled: false },
      layout: { improvedLayout: false },
      interaction: { hover: false, zoomSpeed: 0.8 },
      edges: { smooth: false },
      nodes: { shadow: false },
    });

    notify('Parsing RDF…', 'info', 4000);

    const worker = new Worker(new URL('../../../workers/rdfWorker.js', import.meta.url));
    worker.onmessage = async (msg) => {
      const { type } = msg.data || {};
      if (type === 'progress') return;
      if (type === 'error') {
        notify(`RDF parse failed: ${msg.data.message}`, 'error', 4000);
        suspendLayoutRef.current = false;
        skipVisSyncRef.current = false;
        network?.setOptions({ physics: { enabled: true }, interaction: { hover: true } });
        worker.terminate();
        return;
      }
      if (type === 'done') {
        const { nodes, edges } = stripHidden(msg.data);
        setFilters([]);
        const isBig = nodes.length + edges.length >= BIG_IMPORT_THRESHOLD;

        if (!network) {
          setGraphData({ nodes, edges });
          notify(
            `RDF imported (${nodes.length} nodes, ${edges.length} edges)`,
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
                `RDF imported (${nodes.length} nodes, ${edges.length} edges)${
                  isBig ? ' (batched)' : ''
                }`,
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
    reader.onload = ({ target }) =>
      worker.postMessage({ text: target.result, contentType });
    reader.readAsText(file);
    e.target.value = '';
  };
}
