// src/components/Graph.js
import { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network';

const Graph = () => {
  const networkRef = useRef(null);
  const [network, setNetwork] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [deleteNodeId, setDeleteNodeId] = useState('');
  const [selectedProps, setSelectedProps] = useState(null);
  const [edgeFrom, setEdgeFrom] = useState('');
  const [edgeTo, setEdgeTo] = useState('');
  const [edgeLabel, setEdgeLabel] = useState('');
  const [deleteEdgeId, setDeleteEdgeId] = useState('');

  // Styling for toolbar buttons
  const btn = { padding: '6px 12px', borderRadius: '4px', border: '1px solid #ccc', background: '#f9f9f9', cursor: 'pointer' };
  const inp = { padding: '6px', border: '1px solid #ccc', borderRadius: '4px', width: '100px' };


  // Initialize network
  useEffect(() => {
    const options = {
      nodes: { shape: 'dot', title: node => `Node ID: ${node.id}` },
      edges: { arrows: 'to', length: 200, title: edge => `Edge ID: ${edge.id}` },
      physics: { barnesHut: { gravitationalConstant: -8000, springLength: 200, springConstant: 0.04 }, stabilization: { iterations: 250 } }
    };
    const net = new Network(networkRef.current, graphData, options);
    setNetwork(net);
  }, []);

  // Update on data change
  useEffect(() => {
    if (network) network.setData(graphData);
  }, [graphData, network]);

  // Load data
  const fetchFile = () => {
    fetch('http://localhost:8000/graph')
      .then(res => res.json())
      .then(data => setGraphData(data))
      .catch(err => console.error(err));
  };

  const onFileChange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const json = JSON.parse(evt.target.result);
        const nodes = json.nodes || [];
        const edges = json.edges || json.links || [];
        setGraphData({ nodes, edges });
      } catch {
        alert('Invalid JSON');
      }
    };
    reader.readAsText(file);
  };

  // Save/export
  const saveFile = () => {
    fetch('http://localhost:8000/graph', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes: graphData.nodes, links: graphData.edges }),
    })
      .then(res => res.text())
      .then(msg => alert(msg))
      .catch(err => console.error(err));
  };
  const downloadJSON = () => {
    const payload = { nodes: graphData.nodes, links: graphData.edges };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'graph.json'; a.click();
    URL.revokeObjectURL(url);
  };
  const copyToClipboard = () => {
    const payload = { nodes: graphData.nodes, links: graphData.edges };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      .then(() => alert('Copied to clipboard'))
      .catch(err => console.error(err));
  };

  // Manual node operations
  const handleAddNode = () => {
    if (!newNodeLabel.trim()) return;
    const id = graphData.nodes.length ? Math.max(...graphData.nodes.map(n => n.id)) + 1 : 1;
    setGraphData(prev => ({ nodes: [...prev.nodes, { id, label: newNodeLabel }], edges: prev.edges }));
    setNewNodeLabel('');
  };
  const handleDeleteNode = () => {
    const id = parseInt(deleteNodeId, 10);
    if (isNaN(id)) return;
    setGraphData(prev => ({ nodes: prev.nodes.filter(n => n.id !== id), edges: prev.edges.filter(e => e.from !== id && e.to !== id) }));
    setDeleteNodeId('');
  };

  //Manual edge operations
  const handleAddEdge = () => {
    const from = parseInt(edgeFrom, 10);
    const to = parseInt(edgeTo, 10);
    if (isNaN(from) || isNaN(to) || !edgeLabel.trim()) return;
    const id = `e${graphData.edges.length + 1}`;
    setGraphData(prev => ({ nodes: prev.nodes, edges: [...prev.edges, { id, from, to, label: edgeLabel }] }));
    setEdgeFrom(''); setEdgeTo(''); setEdgeLabel('');
  };
  const handleDeleteEdge = () => {
    const id = deleteEdgeId.trim();
    setGraphData(prev => ({ nodes: prev.nodes, edges: prev.edges.filter(e => e.id !== id) }));
    setDeleteEdgeId('');
  };

  //Show Properties
  useEffect(() => {
    if (!network) return;
    const handler = params => {
      if (params.nodes.length) {
        const id = params.nodes[0];
        setSelectedProps({ type: 'Node', data: graphData.nodes.find(n => n.id === id) });
      } else if (params.edges.length) {
        const id = params.edges[0];
        setSelectedProps({ type: 'Edge', data: graphData.edges.find(e => e.id === id) });
      } else {
        setSelectedProps(null);
      }
    };
    network.off('click', handler);
    network.on('click', handler);
    return () => network.off('click', handler);
  }, [network, graphData]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0', gap: '16px' }}>
        {/* Manual graph controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input style={inp} placeholder="New node label" value={newNodeLabel} onChange={e => setNewNodeLabel(e.target.value)} />
          <button style={btn} onClick={handleAddNode}>Add Node</button>
          <input style={inp} placeholder="Node ID to del" value={deleteNodeId} onChange={e => setDeleteNodeId(e.target.value)} />
          <button style={btn} onClick={handleDeleteNode}>Del Node</button>

          <input style={inp} placeholder="From ID" value={edgeFrom} onChange={e => setEdgeFrom(e.target.value)} />
          <input style={inp} placeholder="To ID" value={edgeTo} onChange={e => setEdgeTo(e.target.value)} />
          <input style={inp} placeholder="Edge label" value={edgeLabel} onChange={e => setEdgeLabel(e.target.value)} />
          <button style={btn} onClick={handleAddEdge}>Add Edge</button>
          <input style={inp} placeholder="Edge ID to del" value={deleteEdgeId} onChange={e => setDeleteEdgeId(e.target.value)} />
          <button style={btn} onClick={handleDeleteEdge}>Del Edge</button>
        </div>

        {/* Right toolbar: file operations */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button style={btn} onClick={fetchFile}>Load</button>
          <label style={{ ...btn, display: 'inline-flex', alignItems: 'center' }}>
            Choose File
            <input type="file" accept=".json" onChange={onFileChange} style={{ display: 'none' }} />
          </label>
          <button style={btn} onClick={saveFile}>Save</button>
          <button style={btn} onClick={downloadJSON}>Download</button>
          <button style={btn} onClick={copyToClipboard}>Copy</button>
        </div>
      </div>

      <div ref={networkRef} style={{ height: '600px', border: '1px solid #ddd', borderRadius: '4px' }} />

      {/* Properties panel */}
      {selectedProps && (
        <div style={{ position: 'absolute', bottom: '12px', right: '12px', background: 'rgba(255,255,255,0.9)', border: '1px solid #ccc', borderRadius: '4px', padding: '8px', maxWidth: '200px', fontSize: '12px' }}>
          <strong>{selectedProps.type} PROPERTIES</strong>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(selectedProps.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default Graph;