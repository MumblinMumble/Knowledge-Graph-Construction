// Graph.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Network } from 'vis-network';
import React from 'react';

const Graph = () => {
  const networkRef = useRef(null);
  const [network, setNetwork] = useState(null);

  // data (your canonical KG format)
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });

  // selection + popup panel
  const [selectedProps, setSelectedProps] = useState(null); // { type:'Node'|'Edge', data }
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const PANEL_W = 360;
  const PANEL_OFFSET = 12;

  // panel editing
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [editError, setEditError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // toolbar
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');

  // layout mode
  const [layoutMode, setLayoutMode] = useState('force'); // 'force'|'hierUD'|'hierLR'|'circular'|'grid'|'concentric'

  // right-click edge mode
  const [edgeFrom, setEdgeFrom] = useState(null); // node id or null

  // quick-add node popover
  const [quickAdd, setQuickAdd] = useState(null); // { dom:{x,y}, canvas:{x,y} }
  const [quickLabel, setQuickLabel] = useState('');

  // quick edge label popover
  const [quickEdge, setQuickEdge] = useState(null); // { dom:{x,y}, from, to }
  const [quickEdgeLabel, setQuickEdgeLabel] = useState('');

  // Add-menu "Edge…" modal
  const [edgeFormOpen, setEdgeFormOpen] = useState(false);
  const [edgeForm, setEdgeForm] = useState({ from: '', to: '', label: '' });

  // toast
  const [toast, setToast] = useState(null); // {msg, level}
  const notifyTimer = useRef(null);
  const notify = useCallback((msg, level = 'info', ms = 2000) => {
    setToast({ msg, level });
    window.clearTimeout(notifyTimer.current);
    notifyTimer.current = window.setTimeout(() => setToast(null), ms);
  }, []);

  // ===== Filters state (chips) =====
  // Each filter: { id, kind, label, payload }
  // kinds: 'filterNodePropEq', 'filterEdgePropEq'
  const [filters, setFilters] = useState([]);
  const addFilter = (f) =>
    setFilters((prev) => [
      ...prev,
      { ...f, id: `${Date.now()}_${Math.random().toString(36).slice(2)}` },
    ]);
  const removeFilter = (id) => setFilters((prev) => prev.filter((f) => f.id !== id));
  const clearAllFilters = () => setFilters([]);

  // --- styles ---
  const btn = {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #d0d7de',
    background: '#f6f8fa',
    cursor: 'pointer',
  };
  const btnPrimary = {
    ...btn,
    background: '#0969da',
    color: '#fff',
    borderColor: '#0969da',
  };
  const btnDanger = {
    ...btn,
    background: '#d1242f',
    color: '#fff',
    borderColor: '#d1242f',
  };
  const btnGhost = { ...btn, background: '#fff' };
  const inp = {
    padding: '6px',
    border: '1px solid #ccc',
    borderRadius: '6px',
    width: '120px',
    boxSizing: 'border-box',
  };
  const group = { display: 'flex', alignItems: 'center', gap: 8, position: 'relative' };
  const menu = {
    position: 'absolute',
    top: '110%',
    right: 0,
    background: '#fff',
    border: '1px solid #d0d7de',
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
    padding: 8,
    zIndex: 10,
    minWidth: 180,
  };
  const menuLeft = { ...menu, left: 0, right: 'auto' };
  const menuItem = { ...btn, width: '100%', textAlign: 'left', background: '#fff' };

  const chip = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderRadius: 999,
    border: '1px solid #d0d7de',
    background: '#eef6ff',
    fontSize: 12,
  };
  const chipX = {
    padding: '0 6px',
    lineHeight: '18px',
    borderRadius: 999,
    border: '1px solid transparent',
    background: '#e1e4e8',
    cursor: 'pointer',
  };

  // ---------- vis-network setup ----------
  // map your graphData -> what vis expects (ids as strings)
  const visNodes = useMemo(
    () =>
      graphData.nodes.map((n) => ({
        id: String(n.id),
        label: n.label ?? n.name ?? String(n.id),
        title: n.type ?? '',
        hidden: n.hidden || false,
        ...n, // keep originals for the side panel
      })),
    [graphData.nodes],
  );

  const visEdges = useMemo(
    () =>
      graphData.edges.map((e) => ({
        id: String(e.id ?? `${e.from}->${e.to}-${e.label ?? ''}`),
        from: String(e.from),
        to: String(e.to),
        label: e.label ?? '',
        arrows: 'to',
        hidden: e.hidden || false,
        ...e,
      })),
    [graphData.edges],
  );

  // create the network once
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
    const net = new Network(networkRef.current, { nodes: [], edges: [] }, options);
    setNetwork(net);
  }, []);

  // keep vis in sync with mapped arrays
  useEffect(() => {
    if (!network) return;
    network.setData({ nodes: visNodes, edges: visEdges });
  }, [network, visNodes, visEdges]);

  // —— positioning helpers ——
  const clampToContainer = (x, y) => {
    const c = networkRef.current;
    const w = c?.clientWidth ?? 0;
    const h = c?.clientHeight ?? 0;
    const clampedX = Math.min(
      Math.max(x + PANEL_OFFSET, 8),
      Math.max(8, w - PANEL_W - 8),
    );
    const clampedY = Math.min(Math.max(y + PANEL_OFFSET, 8), Math.max(8, h - 220));
    return { x: clampedX, y: clampedY };
  };

  const setPopupNearNode = useCallback(
    (nodeId) => {
      if (!network) return;
      const idStr = String(nodeId);
      const pos = network.getPositions([idStr])[idStr];
      if (!pos) return;
      const dom = network.canvasToDOM(pos);
      setPanelPos(clampToContainer(dom.x, dom.y));
    },
    [network],
  );

  const setPopupNearEdge = useCallback(
    (edge) => {
      if (!network) return;
      const fromId = String(edge.from);
      const toId = String(edge.to);
      const pFrom = network.getPositions([fromId])[fromId];
      const pTo = network.getPositions([toId])[toId];
      if (!pFrom || !pTo) return;
      const mid = { x: (pFrom.x + pTo.x) / 2, y: (pFrom.y + pTo.y) / 2 };
      const dom = network.canvasToDOM(mid);
      setPanelPos(clampToContainer(dom.x, dom.y));
    },
    [network],
  );

  const repositionPopup = useCallback(() => {
    if (!selectedProps) return;
    if (selectedProps.type === 'Node') setPopupNearNode(selectedProps.data.id);
    else setPopupNearEdge(selectedProps.data);
  }, [selectedProps, setPopupNearEdge, setPopupNearNode]);

  // --------- Layout switching ----------
  const applyLayout = useCallback(
    (mode) => {
      if (!network || !networkRef.current) return;

      const rect = networkRef.current.getBoundingClientRect();
      const W = rect.width || 800;
      const H = rect.height || 600;
      const toCanvas = (dom) => network.DOMtoCanvas(dom);
      const ids = graphData.nodes.map((n) => String(n.id));

      // Force-directed (physics on)
      if (mode === 'force') {
        network.setOptions({
          layout: { hierarchical: { enabled: false } },
          physics: { enabled: true },
        });
        network.stabilize();
        return;
      }

      // Hierarchical (built-in)
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

      // Manual placements (physics off)
      network.setOptions({
        layout: { hierarchical: { enabled: false } },
        physics: { enabled: false },
      });

      if (mode === 'circular') {
        const n = Math.max(ids.length, 1);
        const R = Math.min(W, H) * 0.4;
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
        const n = ids.length;
        const cols = Math.ceil(Math.sqrt(n));
        const rows = Math.ceil(n / cols);
        const pad = 40;
        const stepX = (W - 2 * pad) / Math.max(1, cols - 1);
        const stepY = (H - 2 * pad) / Math.max(1, rows - 1);
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
        // ring by node degree (hubs inside)
        const deg = {};
        graphData.nodes.forEach((n) => (deg[n.id] = 0));
        graphData.edges.forEach((e) => {
          deg[e.from] = (deg[e.from] || 0) + 1;
          deg[e.to] = (deg[e.to] || 0) + 1;
        });

        const sorted = [...graphData.nodes].sort(
          (a, b) => (deg[b.id] || 0) - (deg[a.id] || 0),
        );
        const rings = 3;
        const perRing = Math.ceil(sorted.length / rings);
        const R0 = Math.min(W, H) * 0.15;
        const dR = Math.min(W, H) * 0.15;

        sorted.forEach((n, idx) => {
          const ring = Math.floor(idx / perRing);
          const posInRing = idx % perRing;
          const count = Math.min(perRing, sorted.length - ring * perRing);
          const R = R0 + ring * dR;
          const ang = (2 * Math.PI * posInRing) / count;
          const { x, y } = toCanvas({
            x: W / 2 + R * Math.cos(ang),
            y: H / 2 + R * Math.sin(ang),
          });
          network.moveNode(String(n.id), x, y);
        });
        network.redraw();
      }
    },
    [network, networkRef, graphData.nodes, graphData.edges],
  );

  useEffect(() => {
    applyLayout(layoutMode);
  }, [applyLayout, layoutMode, visNodes.length]);

  // selection + add interactions
  useEffect(() => {
    if (!network) return;

    // left-click select
    const onClick = (params) => {
      setConfirmDelete(false);
      setEditError('');

      if (params.nodes?.length) {
        const id = params.nodes[0]; // vis id (string)
        const node = graphData.nodes.find((n) => String(n.id) === String(id));
        if (node) {
          setSelectedProps({ type: 'Node', data: node });
          setIsEditing(false);
          setTimeout(() => setPopupNearNode(node.id), 0);
        }
        return;
      }
      if (params.edges?.length) {
        const eid = params.edges[0]; // vis edge id (string)
        const edge = graphData.edges.find((e) => String(e.id) === String(eid));
        if (edge) {
          setSelectedProps({ type: 'Edge', data: edge });
          setIsEditing(false);
          setTimeout(() => setPopupNearEdge(edge), 0);
        }
        return;
      }

      setSelectedProps(null);
      setIsEditing(false);
    };

    // double-click empty space -> open node label popover
    const onDblClick = (params) => {
      if ((params.nodes && params.nodes.length) || (params.edges && params.edges.length))
        return;
      const { DOM, canvas } = params.pointer;
      setQuickAdd({ dom: DOM, canvas });
      setQuickLabel('');
    };

    // right-click for edges
    const onContext = (params) => {
      params.event?.preventDefault?.();

      const domPos = params.pointer?.DOM;
      const clicked = domPos ? network.getNodeAt(domPos) : null;

      if (clicked == null) {
        if (edgeFrom != null) {
          setEdgeFrom(null);
          network.unselectAll();
          notify('Edge mode canceled', 'info');
        }
        return;
      }

      if (edgeFrom == null) {
        setEdgeFrom(clicked);
        network.selectNodes([clicked], false);
        notify('Edge mode: right-click target node', 'info');
      } else if (edgeFrom !== clicked) {
        const pFrom = network.getPositions([String(edgeFrom)])[String(edgeFrom)];
        const pTo = network.getPositions([String(clicked)])[String(clicked)];
        let dom = domPos;
        if (pFrom && pTo) {
          const mid = { x: (pFrom.x + pTo.x) / 2, y: (pFrom.y + pTo.y) / 2 };
          const d = network.canvasToDOM(mid);
          dom = { x: d.x, y: d.y };
        }
        setQuickEdge({ dom, from: edgeFrom, to: clicked });
        setQuickEdgeLabel('');
        setEdgeFrom(null);
        network.unselectAll();
      } else {
        setEdgeFrom(null);
        network.unselectAll();
        notify('Edge mode canceled', 'info');
      }
    };

    const follow = () => repositionPopup();

    network.on('click', onClick);
    network.on('doubleClick', onDblClick);
    network.on('oncontext', onContext);
    network.on('dragging', follow);
    network.on('zoom', follow);
    network.on('stabilized', follow);
    window.addEventListener('resize', follow);

    return () => {
      network.off('click', onClick);
      network.off('doubleClick', onDblClick);
      network.off('oncontext', onContext);
      network.off('dragging', follow);
      network.off('zoom', follow);
      network.off('stabilized', follow);
      window.removeEventListener('resize', follow);
    };
  }, [
    network,
    graphData,
    edgeFrom,
    selectedProps?.type,
    selectedProps?.data?.id,
    setPopupNearEdge,
    setPopupNearNode,
    repositionPopup,
    notify,
  ]);

  // snapshot on edit start
  useEffect(() => {
    if (isEditing && selectedProps) {
      const clone = JSON.parse(JSON.stringify(selectedProps.data));
      setEditData(clone);
      setJsonMode(false);
      setJsonText(JSON.stringify(clone, null, 2));
      setEditError('');
    }
  }, [isEditing, selectedProps]);

  // vis redraw on flex resize
  useEffect(() => {
    if (!networkRef.current) return;
    const ro = new ResizeObserver(() => network?.redraw());
    ro.observe(networkRef.current);
    return () => ro.disconnect();
  }, [network]);

  // ====== SEARCH DROPDOWN STATE ======
  const searchInputRef = useRef(null);
  const searchGroupRef = useRef(null);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const [searchMenuItems, setSearchMenuItems] = useState([]); // items with {kind:'node'|'edge'|'filter-node'|'filter-edge', id|from|to|key|value, label, subtitle}
  const [searchMenuIndex, setSearchMenuIndex] = useState(0);

  // Info/help modal
  const [helpOpen, setHelpOpen] = useState(false);

  const openSearchMenu = (items) => {
    if (!items?.length) return;
    setSearchMenuItems(items.slice(0, 12));
    setSearchMenuIndex(0);
    setSearchMenuOpen(true);
  };
  const closeSearchMenu = () => {
    setSearchMenuOpen(false);
    setSearchMenuItems([]);
  };

  // close dropdown when clicking outside
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!searchGroupRef.current) return;
      if (!searchGroupRef.current.contains(e.target)) closeSearchMenu();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const selectNodesAndEdges = (nodeIds, edgeIds = []) => {
    if (!network) return;
    network.unselectAll();
    network.selectNodes(nodeIds.map(String), false);
    if (edgeIds.length) network.selectEdges(edgeIds.map(String));
    if (nodeIds.length) {
      network.focus(String(nodeIds[0]), { scale: 1, animation: { duration: 300 } });
    }
  };

  // --- show panel helpers ---
  const showPanelForNode = (id) => {
    const node = graphData.nodes.find((n) => String(n.id) === String(id));
    if (!node) return;
    setSelectedProps({ type: 'Node', data: node });
    setTimeout(() => setPopupNearNode(node.id), 0);
  };

  const showPanelForEdge = (edgeId) => {
    const edge = graphData.edges.find((e) => String(e.id) === String(edgeId));
    if (!edge) return;
    setSelectedProps({ type: 'Edge', data: edge });
    setTimeout(() => setPopupNearEdge(edge), 0);
  };

  // Esc cancels edge mode, popovers, confirm bar, edge form, and search menu
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (edgeFrom != null) {
          setEdgeFrom(null);
          network?.unselectAll();
          notify('Edge mode canceled', 'info');
        }
        if (quickAdd) setQuickAdd(null);
        if (quickEdge) setQuickEdge(null);
        if (confirmDelete) setConfirmDelete(false);
        if (edgeFormOpen) setEdgeFormOpen(false);
        if (searchMenuOpen) closeSearchMenu();
        if (helpOpen) setHelpOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    edgeFrom,
    network,
    quickAdd,
    quickEdge,
    confirmDelete,
    edgeFormOpen,
    notify,
    searchMenuOpen,
    helpOpen,
  ]);

  // --- File / IO ---
  const toIntIfNumeric = (v) => {
    const n = Number(v);
    return Number.isInteger(n) ? n : v;
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        const rawNodes = parsed.nodes ?? [];
        const rawEdges = parsed.edges ?? parsed.links ?? [];

        const nodes = rawNodes.map((n, i) => {
          const id = toIntIfNumeric(n.id ?? i + 1);
          const name = n.name ?? n.label ?? `Node ${id}`;
          const label = n.label ?? name;
          return { ...n, id, name, label };
        });

        const edges = rawEdges.map((ed, i) => {
          const from = toIntIfNumeric(ed.from ?? ed.source);
          const to = toIntIfNumeric(ed.to ?? ed.target);
          return {
            id: ed.id ?? `e_${i}`,
            from,
            to,
            label: ed.label ?? ed.rel ?? '',
            ...ed,
          };
        });

        setGraphData({ nodes, edges });
        notify('JSON imported', 'success');
      } catch {
        notify('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
  };

  const downloadJSON = () => {
    const payload = { nodes: graphData.nodes, links: graphData.edges };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graph.json';
    a.click();
    URL.revokeObjectURL(url);
    notify('Downloaded graph.json', 'success');
  };

  const copyToClipboard = () => {
    const payload = { nodes: graphData.nodes, links: graphData.edges };
    navigator.clipboard
      .writeText(JSON.stringify(payload, null, 2))
      .then(() => notify('Copied JSON to clipboard', 'success'))
      .catch(() => notify('Copy failed', 'error'));
  };

  // --- helpers ---
  const fitToScreen = () =>
    network &&
    network.fit({ animation: { duration: 300, easingFunction: 'easeInOutQuad' } });

  // ====== Filter application (chips -> hidden flags) ======
  const applyActiveFilters = useCallback((filtersList) => {
    setGraphData((prev) => {
      const allNodeIds = prev.nodes.map((n) => n.id);
      const allEdgeIds = prev.edges.map((e) => String(e.id));

      // Start by keeping everything
      let keepNodes = new Set(allNodeIds);
      let keepEdges = new Set(allEdgeIds);

      const intersectSet = (a, b) => new Set([...a].filter((x) => b.has(x)));

      // Apply each filter as an intersection
      filtersList.forEach((f) => {
        if (f.kind === 'filterNodePropEq') {
          const { key, value } = f.payload;
          const vl = String(value).toLowerCase();
          const matchNodes = new Set(
            prev.nodes
              .filter((n) => String(n[key] ?? '').toLowerCase() === vl)
              .map((n) => n.id),
          );
          const incidentEdges = new Set(
            prev.edges
              .filter((e) => matchNodes.has(e.from) || matchNodes.has(e.to))
              .map((e) => String(e.id)),
          );
          // node neighborhood = matched nodes + their neighbors via incident edges
          const neighborhoodNodes = new Set([...matchNodes]);
          prev.edges.forEach((e) => {
            if (incidentEdges.has(String(e.id))) {
              neighborhoodNodes.add(e.from);
              neighborhoodNodes.add(e.to);
            }
          });
          keepNodes = intersectSet(keepNodes, neighborhoodNodes);
          keepEdges = intersectSet(keepEdges, incidentEdges);
        } else if (f.kind === 'filterEdgePropEq') {
          const { key, value } = f.payload;
          const vl = String(value).toLowerCase();
          const matchEdges = new Set(
            prev.edges
              .filter((e) => String(e[key] ?? '').toLowerCase() === vl)
              .map((e) => String(e.id)),
          );
          const endpointNodes = new Set();
          prev.edges.forEach((e) => {
            if (matchEdges.has(String(e.id))) {
              endpointNodes.add(e.from);
              endpointNodes.add(e.to);
            }
          });
          keepEdges = intersectSet(keepEdges, matchEdges);
          keepNodes = intersectSet(keepNodes, endpointNodes);
        }
      });

      // If no filters, show everything
      if (filtersList.length === 0) {
        return {
          nodes: prev.nodes.map((n) => ({ ...n, hidden: false })),
          edges: prev.edges.map((e) => ({ ...e, hidden: false })),
        };
      }

      // Otherwise, apply visibility based on keep sets
      const next = {
        nodes: prev.nodes.map((n) => ({ ...n, hidden: !keepNodes.has(n.id) })),
        edges: prev.edges.map((e) => ({
          ...e,
          hidden:
            !keepEdges.has(String(e.id)) ||
            !keepNodes.has(e.from) ||
            !keepNodes.has(e.to),
        })),
      };
      return next;
    });
  }, []);

  // Re-apply filters whenever they change
  useEffect(() => {
    applyActiveFilters(filters);
    if (network) {
      setTimeout(() => network.fit({ animation: { duration: 300 } }), 0);
    }
  }, [filters, applyActiveFilters, network]);

  // Run an example query string immediately
  const runExample = (cmd) => {
    setSearchQ(cmd);
    setTimeout(() => handleQuery(), 0);
  };

  // ====== SEARCH / FILTER PARSING HELPERS ======
  const eqCI = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();

  const parseNodeSearch = (s) => {
    const m = s.match(/^node\s*:\s*([^=:\s]+)\s*=\s*(.+)$/i);
    return m ? { key: m[1], value: m[2] } : null;
  };
  const parseEdgeSearch = (s) => {
    const m = s.match(/^edge\s*:\s*([^=:\s]+)\s*=\s*(.+)$/i);
    return m ? { key: m[1], value: m[2] } : null;
  };
  const parseFilterNode = (s) => {
    const m = s.match(/^filter\s+node\s*:\s*([^=:\s]+)\s*=\s*(.+)$/i);
    return m ? { key: m[1], value: m[2] } : null;
  };
  const parseFilterEdge = (s) => {
    const m = s.match(/^filter\s+edge\s*:\s*([^=:\s]+)\s*=\s*(.+)$/i);
    return m ? { key: m[1], value: m[2] } : null;
  };

  // ====== SEARCH HANDLER (strict property-based) ======
  const handleQuery = () => {
    const raw = searchQ.trim();
    if (!raw) return;

    // reset command
    if (raw.toLowerCase() === 'reset') {
      clearAllFilters();
      notify('Filters cleared', 'success');
      closeSearchMenu();
      return;
    }

    // help command (shows cheat-sheet)
    if (['help', '?'].includes(raw.toLowerCase())) {
      setHelpOpen(true);
      closeSearchMenu();
      return;
    }

    // Strictly require node:, edge:, or filter node:/edge:
    const nodeSearch = parseNodeSearch(raw);
    const edgeSearch = parseEdgeSearch(raw);
    const filterNode = parseFilterNode(raw);
    const filterEdge = parseFilterEdge(raw);

    if (!nodeSearch && !edgeSearch && !filterNode && !filterEdge) {
      notify(
        'Use node:key=value, edge:key=value, filter node:key=value, or filter edge:key=value',
        'error',
        3500,
      );
      closeSearchMenu();
      return;
    }

    // NODE SEARCH (highlight only)
    if (nodeSearch) {
      const { key, value } = nodeSearch;
      if (!key || !value) {
        notify('node: requires key=value', 'error');
        return;
      }
      const exact = graphData.nodes.filter((n) => eqCI(n[key], value));
      if (exact.length === 1) {
        selectNodesAndEdges([exact[0].id]);
        showPanelForNode(exact[0].id);
        closeSearchMenu();
        return;
      }
      if (exact.length > 1) {
        const items = exact.map((n) => ({
          kind: 'node',
          id: n.id,
          label: n.label ?? n.name ?? String(n.id),
          subtitle: `${key}=${n[key]} • id ${n.id}`,
        }));
        openSearchMenu(items);
        notify(`${exact.length} nodes matched — pick one`, 'info');
        return;
      }
      // no exact -> suggest contains
      const contains = graphData.nodes.filter((n) =>
        String(n[key] ?? '')
          .toLowerCase()
          .includes(String(value).toLowerCase()),
      );
      if (!contains.length) {
        notify('No nodes match that property', 'error');
        closeSearchMenu();
        return;
      }
      const items = contains.slice(0, 12).map((n) => ({
        kind: 'node',
        id: n.id,
        label: n.label ?? n.name ?? String(n.id),
        subtitle: `${key}=${n[key]} • id ${n.id}`,
      }));
      openSearchMenu(items);
      notify('No exact match — showing contains() suggestions', 'info');
      return;
    }

    // EDGE SEARCH (highlight only)
    if (edgeSearch) {
      const { key, value } = edgeSearch;
      if (!key || !value) {
        notify('edge: requires key=value', 'error');
        return;
      }
      const exact = graphData.edges.filter((e) => eqCI(e[key], value));
      if (exact.length === 1) {
        const e0 = exact[0];
        selectNodesAndEdges([e0.from, e0.to], [e0.id]);
        showPanelForEdge(e0.id);
        const pFrom = network?.getPositions([String(e0.from)])[String(e0.from)];
        const pTo = network?.getPositions([String(e0.to)])[String(e0.to)];
        if (pFrom && pTo) closeSearchMenu();
        return;
      }
      if (exact.length > 1) {
        const items = exact.map((e) => ({
          kind: 'edge',
          id: e.id,
          from: e.from,
          to: e.to,
          label: `edge ${e.id}`,
          subtitle: `${key}=${e[key]} • ${e.from} → ${e.to}${
            e.label ? ' • ' + e.label : ''
          }`,
        }));
        openSearchMenu(items);
        notify(`${exact.length} edges matched — pick one`, 'info');
        return;
      }
      // no exact -> suggest contains
      const contains = graphData.edges.filter((e) =>
        String(e[key] ?? '')
          .toLowerCase()
          .includes(String(value).toLowerCase()),
      );
      if (!contains.length) {
        notify('No edges match that property', 'error');
        closeSearchMenu();
        return;
      }
      const items = contains.slice(0, 12).map((e) => ({
        kind: 'edge',
        id: e.id,
        from: e.from,
        to: e.to,
        label: `edge ${e.id}`,
        subtitle: `${key}=${e[key]} • ${e.from} → ${e.to}${
          e.label ? ' • ' + e.label : ''
        }`,
      }));
      openSearchMenu(items);
      notify('No exact match — showing contains() suggestions', 'info');
      return;
    }

    // FILTERS (add chips; hide others)
    if (filterNode) {
      const { key, value } = filterNode;
      const vl = String(value).toLowerCase();
      const match = graphData.nodes.filter(
        (n) => String(n[key] ?? '').toLowerCase() === vl,
      );
      if (!match.length) {
        // optionally suggest values that contain
        const contains = graphData.nodes.filter((n) =>
          String(n[key] ?? '')
            .toLowerCase()
            .includes(vl),
        );
        if (contains.length) {
          // Suggest picking a concrete value to filter by
          const counts = new Map();
          contains.forEach((n) => {
            const val = String(n[key]);
            counts.set(val, (counts.get(val) || 0) + 1);
          });
          const items = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .map(([val, cnt]) => ({
              kind: 'filter-node',
              key,
              value: val,
              label: `Filter nodes: ${key}=${val}`,
              subtitle: `${cnt} node${cnt === 1 ? '' : 's'}`,
            }));
          openSearchMenu(items);
          notify('No exact node filter match — pick a suggested value', 'info');
        } else {
          notify('No nodes match that property for filtering', 'error');
          closeSearchMenu();
        }
        return;
      }
      addFilter({
        kind: 'filterNodePropEq',
        label: `node: ${key}=${value}`,
        payload: { key, value },
      });
      notify(`Filter added: node ${key}=${value}`, 'success');
      closeSearchMenu();
      return;
    }

    if (filterEdge) {
      const { key, value } = filterEdge;
      const vl = String(value).toLowerCase();
      const match = graphData.edges.filter(
        (e) => String(e[key] ?? '').toLowerCase() === vl,
      );
      if (!match.length) {
        const contains = graphData.edges.filter((e) =>
          String(e[key] ?? '')
            .toLowerCase()
            .includes(vl),
        );
        if (contains.length) {
          const counts = new Map();
          contains.forEach((e) => {
            const val = String(e[key]);
            counts.set(val, (counts.get(val) || 0) + 1);
          });
          const items = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .map(([val, cnt]) => ({
              kind: 'filter-edge',
              key,
              value: val,
              label: `Filter edges: ${key}=${val}`,
              subtitle: `${cnt} edge${cnt === 1 ? '' : 's'}`,
            }));
          openSearchMenu(items);
          notify('No exact edge filter match — pick a suggested value', 'info');
        } else {
          notify('No edges match that property for filtering', 'error');
          closeSearchMenu();
        }
        return;
      }
      addFilter({
        kind: 'filterEdgePropEq',
        label: `edge: ${key}=${value}`,
        payload: { key, value },
      });
      notify(`Filter added: edge ${key}=${value}`, 'success');
      closeSearchMenu();
      return;
    }
  };

  // --- edit / delete ---
  const closePanel = () => {
    setSelectedProps(null);
    setIsEditing(false);
    setEditData(null);
    setJsonMode(false);
    setJsonText('');
    setEditError('');
    setConfirmDelete(false);
  };

  const applyEdits = () => {
    if (!selectedProps) return;

    let data = editData;
    if (jsonMode) {
      try {
        data = JSON.parse(jsonText);
      } catch {
        setEditError('Invalid JSON');
        return;
      }
    }

    if (selectedProps.type === 'Node') {
      const newId = Number(data.id);
      if (!Number.isInteger(newId)) {
        setEditError('Node "id" must be an integer');
        return;
      }
      const idChanged = newId !== selectedProps.data.id;
      if (idChanged && graphData.nodes.some((n) => n.id === newId)) {
        setEditError(`Node id ${newId} already exists.`);
        return;
      }

      const updatedNode = { ...data, id: newId };
      setGraphData((prev) => {
        const nodes = prev.nodes.map((n) =>
          n.id === selectedProps.data.id ? updatedNode : n,
        );
        let edges = prev.edges;
        if (idChanged) {
          edges = edges.map((e) => ({
            ...e,
            from: e.from === selectedProps.data.id ? newId : e.from,
            to: e.to === selectedProps.data.id ? newId : e.to,
          }));
        }
        return { nodes, edges };
      });
      setSelectedProps({ type: 'Node', data: { ...updatedNode } });
      setIsEditing(false);
      setJsonMode(false);
      setEditError('');
      repositionPopup();
      notify('Node updated', 'success');
      return;
    }

    // Edge edits
    const from = Number(data.from);
    const to = Number(data.to);
    if (!Number.isInteger(from) || !Number.isInteger(to)) {
      setEditError('Edge "from" and "to" must be integers');
      return;
    }
    const nodeIds = new Set(graphData.nodes.map((n) => n.id));
    if (!nodeIds.has(from) || !nodeIds.has(to)) {
      setEditError('Both endpoints must be existing node ids');
      return;
    }

    const newId = (data.id ?? selectedProps.data.id).toString();
    const idChanged = newId !== selectedProps.data.id;
    if (idChanged && graphData.edges.some((e) => String(e.id) === newId)) {
      setEditError(`Edge id "${newId}" already exists.`);
      return;
    }

    const updatedEdge = { ...data, id: newId, from, to };
    setGraphData((prev) => ({
      nodes: prev.nodes,
      edges: prev.edges.map((e) =>
        String(e.id) === String(selectedProps.data.id) ? updatedEdge : e,
      ),
    }));
    setSelectedProps({ type: 'Edge', data: { ...updatedEdge } });
    setIsEditing(false);
    setJsonMode(false);
    setEditError('');
    repositionPopup();
    notify('Edge updated', 'success');
  };

  const doDeleteSelected = () => {
    if (!selectedProps) return;
    if (selectedProps.type === 'Node') {
      const id = selectedProps.data.id;
      setGraphData((prev) => ({
        nodes: prev.nodes.filter((n) => n.id !== id),
        edges: prev.edges.filter((e) => e.from !== id && e.to !== id),
      }));
      notify(`Node ${id} deleted`, 'success');
    } else {
      const id = selectedProps.data.id;
      setGraphData((prev) => ({
        nodes: prev.nodes,
        edges: prev.edges.filter((e) => String(e.id) !== String(id)),
      }));
      notify(`Edge ${id} deleted`, 'success');
    }
    closePanel();
  };

  // EDIT FORM (labelled grid + add custom field)
  const renderEditForm = () => {
    if (!editData) return null;

    if (jsonMode) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            style={{
              width: '100%',
              height: 180,
              padding: 8,
              border: '1px solid #ccc',
              borderRadius: 6,
              fontFamily: 'monospace',
              fontSize: 12,
              boxSizing: 'border-box',
            }}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
        </div>
      );
    }

    const core =
      selectedProps?.type === 'Node'
        ? ['id', 'name', 'label']
        : ['id', 'from', 'to', 'label'];

    const orderedKeys = [
      ...core.filter((k) => k in editData || k === 'label'),
      ...Object.keys(editData).filter((k) => !core.includes(k)),
    ];

    return (
      <>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '110px 1fr',
            columnGap: 8,
            rowGap: 8,
            alignItems: 'center',
          }}
        >
          {orderedKeys.map((k) => {
            const id = `edit-${k}`;
            const isCore =
              (selectedProps?.type === 'Node' && ['id', 'name', 'label'].includes(k)) ||
              (selectedProps?.type === 'Edge' &&
                ['id', 'from', 'to', 'label'].includes(k));
            return (
              <React.Fragment key={k}>
                <label
                  htmlFor={id}
                  style={{ fontWeight: isCore ? 600 : 500 }}
                >
                  {k}
                </label>
                <input
                  id={id}
                  style={{ ...inp, width: '100%' }}
                  value={editData[k] ?? ''}
                  onChange={(e) =>
                    setEditData((prev) => ({ ...prev, [k]: e.target.value }))
                  }
                />
              </React.Fragment>
            );
          })}
        </div>

        <details style={{ marginTop: 10, borderTop: '1px solid #eee', paddingTop: 8 }}>
          <summary style={{ cursor: 'pointer', color: '#0969da', listStyle: 'none' }}>
            + Add custom field
          </summary>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input
              placeholder="key"
              style={{ ...inp, flex: 1 }}
              id="newKey"
            />
            <input
              placeholder="value"
              style={{ ...inp, flex: 2 }}
              id="newVal"
            />
            <button
              type="button"
              style={btn}
              onClick={() => {
                const keyEl = document.getElementById('newKey');
                const valEl = document.getElementById('newVal');
                const k = keyEl?.value?.trim();
                if (!k) return;
                setEditData((prev) => ({ ...prev, [k]: valEl?.value ?? '' }));
                if (keyEl) keyEl.value = '';
                if (valEl) keyEl.value = '';
              }}
            >
              Add
            </button>
          </div>
        </details>
      </>
    );
  };

  // pretty-print props
  const formatValue = (v) => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') {
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  };

  const linesForProps = (type, data) => {
    const core =
      type === 'Node' ? ['id', 'name', 'label'] : ['id', 'from', 'to', 'label'];
    const extras = Object.keys(data)
      .filter((k) => !core.includes(k))
      .sort();
    const order = [...core.filter((k) => k in data), ...extras];
    return order.map((k) => [k, formatValue(data[k])]);
  };

  // --- Add menu helpers ---
  const openAddNodePopoverNearTop = () => {
    const el = networkRef.current;
    if (el) {
      const x = Math.round(el.clientWidth / 2);
      const y = el.offsetTop + 24;
      setQuickAdd({ dom: { x, y }, canvas: null });
      setQuickLabel('');
    } else {
      setQuickAdd({ dom: { x: 40, y: 80 }, canvas: null });
      setQuickLabel('');
    }
  };

  const openEdgeFormFromMenu = () => {
    let from = '';
    let to = '';
    if (network) {
      const sel = network.getSelectedNodes?.() || [];
      if (sel.length >= 1) from = String(sel[0]);
      if (sel.length >= 2) to = String(sel[1]);
    }
    setEdgeForm({ from, to, label: '' });
    setEdgeFormOpen(true);
  };

  const createEdgeFromForm = () => {
    const from = parseInt(edgeForm.from, 10);
    const to = parseInt(edgeForm.to, 10);
    const label = edgeForm.label.trim();

    if (!Number.isInteger(from) || !Number.isInteger(to)) {
      notify('From/To must be integer node ids', 'error');
      return;
    }
    const idSet = new Set(graphData.nodes.map((n) => n.id));
    if (!idSet.has(from) || !idSet.has(to)) {
      notify('Both endpoints must be existing node ids', 'error');
      return;
    }

    const edgeId = `e_${Date.now()}`;
    const newEdge = { id: edgeId, from, to, label };
    setGraphData((prev) => ({ nodes: prev.nodes, edges: [...prev.edges, newEdge] }));
    setEdgeFormOpen(false);
    setEdgeForm({ from: '', to: '', label: '' });

    setTimeout(() => {
      setSelectedProps({ type: 'Edge', data: newEdge });
      setPopupNearEdge(newEdge);
    }, 0);
    notify(`Edge ${edgeId} added`, 'success');
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
      }}
    >
      {/* Top toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: '12px 0',
          gap: 12,
          flexWrap: 'wrap',
          flex: '0 0 auto',
        }}
      >
        {/* Left: Add menu + hint */}
        <div style={{ ...group, minWidth: 280, flexWrap: 'wrap' }}>
          <button
            style={btnPrimary}
            onClick={() => setAddMenuOpen((v) => !v)}
          >
            ＋ Add ▾
          </button>
          {addMenuOpen && (
            <div style={menuLeft}>
              <button
                style={menuItem}
                onClick={() => {
                  setAddMenuOpen(false);
                  openAddNodePopoverNearTop();
                }}
              >
                Node…
              </button>
              <button
                style={menuItem}
                onClick={() => {
                  setAddMenuOpen(false);
                  openEdgeFormFromMenu();
                }}
              >
                Edge…
              </button>
            </div>
          )}
          <span style={{ fontSize: 12, color: '#6e7781', marginLeft: 6 }}>
            Tip: double-click empty space to add a node · right-click node → node to add
            an edge
          </span>
        </div>

        {/* Center: Search + Fit + Layout */}
        <div
          ref={searchGroupRef}
          style={{
            ...group,
            flex: 1,
            minWidth: 320,
            alignItems: 'stretch',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={searchInputRef}
              style={{ ...inp, flex: 1 }}
              placeholder="node:key=value · edge:key=value · filter node:key=value · filter edge:key=value (i for help)"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => {
                // menu navigation
                if (searchMenuOpen && searchMenuItems.length) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSearchMenuIndex((i) => (i + 1) % searchMenuItems.length);
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSearchMenuIndex(
                      (i) => (i - 1 + searchMenuItems.length) % searchMenuItems.length,
                    );
                    return;
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const item = searchMenuItems[searchMenuIndex];
                    if (item) {
                      if (item.kind === 'node') {
                        selectNodesAndEdges([item.id]);
                        showPanelForNode(item.id);
                      } else if (item.kind === 'edge') {
                        selectNodesAndEdges([item.from, item.to], [item.id]);
                        showPanelForEdge(item.id);
                        const pFrom = network?.getPositions([String(item.from)])[
                          String(item.from)
                        ];
                        const pTo = network?.getPositions([String(item.to)])[
                          String(item.to)
                        ];
                        if (pFrom && pTo) {
                        }
                      } else if (item.kind === 'filter-node') {
                        addFilter({
                          kind: 'filterNodePropEq',
                          label: `node: ${item.key}=${item.value}`,
                          payload: { key: item.key, value: item.value },
                        });
                        notify(`Filter added: node ${item.key}=${item.value}`, 'success');
                      } else if (item.kind === 'filter-edge') {
                        addFilter({
                          kind: 'filterEdgePropEq',
                          label: `edge: ${item.key}=${item.value}`,
                          payload: { key: item.key, value: item.value },
                        });
                        notify(`Filter added: edge ${item.key}=${item.value}`, 'success');
                      }
                      setSearchMenuOpen(false);
                      return;
                    }
                  }
                  if (e.key === 'Escape') {
                    setSearchMenuOpen(false);
                    return;
                  }
                }
                // fallback: run the query
                if (e.key === 'Enter') handleQuery();
              }}
            />
            <button
              style={btnGhost}
              onClick={handleQuery}
              title="Run"
            >
              Run
            </button>
            <button
              style={{ ...btnGhost, width: 32, padding: 0, borderRadius: 999 }}
              onClick={() => setHelpOpen(true)}
              title="Search help"
            >
              i
            </button>
            <button
              style={btnGhost}
              onClick={fitToScreen}
              title="Fit to screen"
            >
              Fit
            </button>
            <select
              style={{ ...inp, width: 200 }}
              value={layoutMode}
              onChange={(e) => setLayoutMode(e.target.value)}
              title="Layout"
            >
              <option value="force">Force-directed</option>
              <option value="hierUD">Hierarchical (Top→Bottom)</option>
              <option value="hierLR">Hierarchical (Left→Right)</option>
              <option value="circular">Circular</option>
              <option value="grid">Grid</option>
              <option value="concentric">Concentric (by degree)</option>
            </select>
          </div>

          {/* Filter chips */}
          {filters.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {filters.map((f) => (
                <span
                  key={f.id}
                  style={chip}
                >
                  {f.label}
                  <button
                    aria-label={`Remove filter ${f.label}`}
                    style={chipX}
                    onClick={() => removeFilter(f.id)}
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                style={{ ...btn, background: '#fff' }}
                onClick={clearAllFilters}
                title="Clear all filters"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Search results dropdown */}
          {searchMenuOpen && searchMenuItems.length > 0 && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: '100%',
                marginTop: 6,
                width: searchInputRef.current
                  ? searchInputRef.current.offsetWidth
                  : '100%',
                maxWidth: '100%',
                maxHeight: 260,
                overflowY: 'auto',
                background: '#fff',
                border: '1px solid #d0d7de',
                borderRadius: 8,
                boxShadow: '0 12px 24px rgba(0,0,0,0.12)',
                zIndex: 20,
              }}
              role="listbox"
            >
              {searchMenuItems.map((it, i) => (
                <div
                  key={`${it.kind}-${it.label}-${i}`}
                  role="option"
                  aria-selected={i === searchMenuIndex}
                  onMouseEnter={() => setSearchMenuIndex(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (it.kind === 'node') {
                      selectNodesAndEdges([it.id]);
                      showPanelForNode(it.id);
                    } else if (it.kind === 'edge') {
                      selectNodesAndEdges([it.from, it.to], [it.id]);
                      showPanelForEdge(it.id);
                      const pFrom = network?.getPositions([String(it.from)])[
                        String(it.from)
                      ];
                      const pTo = network?.getPositions([String(it.to)])[String(it.to)];
                      if (pFrom && pTo) {
                      }
                    } else if (it.kind === 'filter-node') {
                      addFilter({
                        kind: 'filterNodePropEq',
                        label: `node: ${it.key}=${it.value}`,
                        payload: { key: it.key, value: it.value },
                      });
                      notify(`Filter added: node ${it.key}=${it.value}`, 'success');
                    } else if (it.kind === 'filter-edge') {
                      addFilter({
                        kind: 'filterEdgePropEq',
                        label: `edge: ${it.key}=${it.value}`,
                        payload: { key: it.key, value: it.value },
                      });
                      notify(`Filter added: edge ${it.key}=${it.value}`, 'success');
                    }
                    setSearchMenuOpen(false);
                  }}
                  style={{
                    padding: '8px 10px',
                    borderBottom:
                      i === searchMenuItems.length - 1 ? 'none' : '1px solid #f0f2f4',
                    background: i === searchMenuIndex ? '#f6f8fa' : '#fff',
                    cursor: 'pointer',
                    display: 'grid',
                    gridTemplateColumns: '18px 1fr',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 12, color: '#57606a' }}>
                    {it.kind === 'node'
                      ? '●'
                      : it.kind === 'edge'
                      ? '→'
                      : it.kind === 'filter-node'
                      ? '⎇'
                      : '⎇'}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 13, color: '#24292f' }}>{it.label}</div>
                    <div style={{ fontSize: 11, color: '#6e7781' }}>{it.subtitle}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: File menu */}
        <div style={group}>
          <button
            style={btn}
            onClick={() => setFileMenuOpen((v) => !v)}
          >
            File ▾
          </button>
          {fileMenuOpen && (
            <div style={menu}>
              <label
                style={{
                  ...menuItem,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Import Json
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    onFileChange(e);
                    setFileMenuOpen(false);
                  }}
                  style={{ display: 'none' }}
                />
              </label>
              <button
                style={menuItem}
                onClick={() => {
                  setFileMenuOpen(false);
                  downloadJSON();
                }}
              >
                Download Json
              </button>
              <button
                style={menuItem}
                onClick={() => {
                  setFileMenuOpen(false);
                  copyToClipboard();
                }}
              >
                Copy JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={networkRef}
        style={{
          flex: '1 1 0',
          minHeight: 0,
          border: '1px solid #ddd',
          borderRadius: '8px',
          position: 'relative',
          cursor: edgeFrom != null ? 'crosshair' : 'default',
        }}
      />

      {/* Popup property panel */}
      {selectedProps && (
        <div
          style={{
            position: 'absolute',
            left: panelPos.x,
            top: panelPos.y,
            background: 'rgba(255,255,255,0.98)',
            border: '1px solid #d0d7de',
            borderRadius: 12,
            padding: 12,
            width: PANEL_W,
            boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
            fontSize: 13,
            zIndex: 15,
            pointerEvents: 'auto',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <strong style={{ fontSize: 12, letterSpacing: 0.3, flexShrink: 0 }}>
              {selectedProps.type} Properties
            </strong>

            <div
              style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}
            >
              {!isEditing && (
                <button
                  style={btn}
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </button>
              )}
              {isEditing && (
                <>
                  <button
                    style={btn}
                    onClick={() => setJsonMode((m) => !m)}
                  >
                    {jsonMode ? 'Form' : 'JSON'}
                  </button>
                  <button
                    style={btn}
                    onClick={() => {
                      setIsEditing(false);
                      setEditData(null);
                      setJsonMode(false);
                      setEditError('');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    style={btnPrimary}
                    onClick={applyEdits}
                  >
                    Save
                  </button>
                </>
              )}
              {!confirmDelete && (
                <button
                  style={btnDanger}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* Confirm delete bar */}
          {confirmDelete && (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                borderRadius: 8,
                background: '#fff5f5',
                border: '1px solid #ffd6d6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 12 }}>
                Delete this {selectedProps.type.toLowerCase()}?
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  style={btnDanger}
                  onClick={doDeleteSelected}
                >
                  Confirm
                </button>
                <button
                  style={btn}
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          {!isEditing ? (
            <div
              style={{
                marginTop: 8,
                background: '#f6f8fa',
                padding: 8,
                borderRadius: 8,
                display: 'grid',
                gridTemplateColumns: '110px 1fr',
                gap: 6,
                alignItems: 'baseline',
              }}
            >
              {linesForProps(selectedProps.type, selectedProps.data).map(([k, v]) => (
                <React.Fragment key={k}>
                  <div style={{ color: '#57606a', fontWeight: 600 }}>{k}</div>
                  <div style={{ wordBreak: 'break-word' }}>{v}</div>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              {editError && (
                <div
                  style={{
                    marginBottom: 8,
                    padding: 8,
                    borderRadius: 8,
                    background: '#fff5f5',
                    border: '1px solid #ffd6d6',
                    color: '#8b0000',
                  }}
                >
                  {editError}
                </div>
              )}
              {renderEditForm()}
            </div>
          )}
        </div>
      )}

      {/* Edge mode banner */}
      {edgeFrom != null && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            top: 8,
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid #d0d7de',
            background: '#fffceb',
            color: '#6a4f00',
            boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
            fontSize: 12,
          }}
        >
          Edge mode: right-click a target node (Esc to cancel)
        </div>
      )}

      {/* Quick node label popover */}
      {quickAdd && (
        <div
          style={{
            position: 'absolute',
            left: quickAdd.dom.x,
            top: quickAdd.dom.y,
            transform: 'translate(10px, 10px)',
            background: '#fff',
            border: '1px solid #d0d7de',
            borderRadius: 10,
            padding: 10,
            width: 260,
            boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
            zIndex: 30,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Add Node</div>
          <input
            autoFocus
            style={{ ...inp, width: '100%' }}
            placeholder="Label"
            value={quickLabel}
            onChange={(e) => setQuickLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') document.getElementById('qa-add-btn')?.click();
            }}
          />
          <div
            style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}
          >
            <button
              style={btn}
              onClick={() => setQuickAdd(null)}
            >
              Cancel
            </button>
            <button
              id="qa-add-btn"
              style={btnPrimary}
              onClick={() => {
                const label = quickLabel.trim();
                const nextId =
                  (graphData.nodes.length
                    ? Math.max(...graphData.nodes.map((n) => Number(n.id) || 0))
                    : 0) + 1;
                const newNode = {
                  id: nextId,
                  name: label || `Node ${nextId}`,
                  label: label || `Node ${nextId}`,
                };
                setGraphData((prev) => ({
                  nodes: [...prev.nodes, newNode],
                  edges: prev.edges,
                }));
                setQuickAdd(null);
                setQuickLabel('');
                setTimeout(() => {
                  network?.selectNodes([String(nextId)], false);
                  setSelectedProps({ type: 'Node', data: newNode });
                  setPopupNearNode(nextId);
                }, 0);
                notify(`Node ${nextId} added`, 'success');
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Quick edge label popover */}
      {quickEdge && (
        <div
          style={{
            position: 'absolute',
            left: quickEdge.dom.x,
            top: quickEdge.dom.y,
            transform: 'translate(-50%, -10px)',
            background: '#fff',
            border: '1px solid #d0d7de',
            borderRadius: 10,
            padding: 10,
            width: 280,
            boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
            zIndex: 30,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Add Edge</div>
          <input
            autoFocus
            style={{ ...inp, width: '100%' }}
            placeholder="Label (optional)"
            value={quickEdgeLabel}
            onChange={(e) => setQuickEdgeLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') document.getElementById('qe-add-btn')?.click();
            }}
          />
          <div
            style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}
          >
            <button
              style={btn}
              onClick={() => setQuickEdge(null)}
            >
              Cancel
            </button>
            <button
              id="qe-add-btn"
              style={btnPrimary}
              onClick={() => {
                const label = quickEdgeLabel.trim();
                const edgeId = `e_${Date.now()}`;
                const newEdge = {
                  id: edgeId,
                  from: Number(quickEdge.from),
                  to: Number(quickEdge.to),
                  label,
                };
                setGraphData((prev) => ({
                  nodes: prev.nodes,
                  edges: [...prev.edges, newEdge],
                }));
                setQuickEdge(null);
                setQuickEdgeLabel('');
                setTimeout(() => {
                  setSelectedProps({ type: 'Edge', data: newEdge });
                  setPopupNearEdge(newEdge);
                }, 0);
                notify(`Edge ${edgeId} added`, 'success');
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Help modal */}
      {helpOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.25)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 60,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setHelpOpen(false);
          }}
        >
          <div
            style={{
              background: '#fff',
              border: '1px solid #d0d7de',
              borderRadius: 12,
              padding: 16,
              width: 560,
              maxWidth: '90vw',
              boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h4 style={{ margin: 0, flex: 1 }}>Search & Filter Cheat‑Sheet</h4>
              <button
                style={btn}
                onClick={() => setHelpOpen(false)}
              >
                Close
              </button>
            </div>
            <div style={{ fontSize: 13, color: '#57606a', marginTop: 4 }}>
              Searches highlight results without changing visibility. Filters add chips
              below and hide everything else.
            </div>

            <div
              style={{
                marginTop: 12,
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                rowGap: 8,
                columnGap: 8,
              }}
            >
              <div>
                <code>node:id=26</code> — focus node by property
              </div>
              <div>
                <button
                  style={btn}
                  onClick={() => runExample('node:id=26')}
                >
                  Try
                </button>
              </div>

              <div>
                <code>edge:label=KNOWS</code> — highlight matching edges
              </div>
              <div>
                <button
                  style={btn}
                  onClick={() => runExample('edge:label=KNOWS')}
                >
                  Try
                </button>
              </div>

              <div>
                <code>filter node:id=26</code> — show that node + all incident edges and
                neighbors
              </div>
              <div>
                <button
                  style={btn}
                  onClick={() => runExample('filter node:id=26')}
                >
                  Try
                </button>
              </div>

              <div>
                <code>filter edge:label=KNOWS</code> — show only KNOWS edges + their
                endpoints
              </div>
              <div>
                <button
                  style={btn}
                  onClick={() => runExample('filter edge:label=KNOWS')}
                >
                  Try
                </button>
              </div>

              <div>
                <code>reset</code> — clear all filters
              </div>
              <div>
                <button
                  style={btn}
                  onClick={() => runExample('reset')}
                >
                  Try
                </button>
              </div>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: '#6e7781' }}>
              Notes: all comparisons are case‑insensitive exact matches (
              <code>key=value</code>). If there’s no exact match, you’ll get suggestions
              using <em>contains</em>.
            </div>
          </div>
        </div>
      )}

      {/* Add-menu Edge form modal */}
      {edgeFormOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.25)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: '#fff',
              border: '1px solid #d0d7de',
              borderRadius: 12,
              padding: 16,
              width: 360,
              boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            }}
          >
            <h4 style={{ margin: 0, marginBottom: 8 }}>Add Edge</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input
                style={{ ...inp, width: '100%' }}
                placeholder="From id"
                value={edgeForm.from}
                onChange={(e) => setEdgeForm((s) => ({ ...s, from: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createEdgeFromForm();
                }}
              />
              <input
                style={{ ...inp, width: '100%' }}
                placeholder="To id"
                value={edgeForm.to}
                onChange={(e) => setEdgeForm((s) => ({ ...s, to: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createEdgeFromForm();
                }}
              />
            </div>
            <input
              style={{ ...inp, width: '100%', marginTop: 8 }}
              placeholder="Label (optional)"
              value={edgeForm.label}
              onChange={(e) => setEdgeForm((s) => ({ ...s, label: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createEdgeFromForm();
              }}
            />
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginTop: 12,
              }}
            >
              <button
                style={btn}
                onClick={() => setEdgeFormOpen(false)}
              >
                Cancel
              </button>
              <button
                style={btnPrimary}
                onClick={createEdgeFromForm}
              >
                Add
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6e7781' }}>
              Tip: you can also right-click a source node then a target node to add an
              edge in-place.
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 12,
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #d0d7de',
            background:
              toast.level === 'error'
                ? '#fff5f5'
                : toast.level === 'success'
                ? '#eef9f0'
                : '#f6f8fa',
            color: '#24292f',
            boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
            zIndex: 9999,
            whiteSpace: 'pre-line',
          }}
          role="status"
          aria-live="polite"
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default Graph;
