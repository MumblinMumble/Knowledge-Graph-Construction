// src/components/Graph/Graph.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useVisNetwork from '../../hooks/useVisNetwork';
import useLayout from '../../hooks/useLayout';
import Toolbar from './Toolbar';
import PropertyPanel from './PropertyPanel';
import {
  QuickAddNodePopover,
  QuickAddEdgePopover,
  EdgeFormModal,
  HelpModal,
  EdgeModeBanner,
  Toast,
} from './Popovers';

export default function Graph() {
  // vis setup
  const { networkRef, network } = useVisNetwork();

  // canonical data
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });

  // layout
  const [layoutMode, setLayoutMode] = useState('force');
  const { applyLayout } = useLayout(networkRef, network, graphData);
  useEffect(() => {
    applyLayout(layoutMode);
  }, [layoutMode, applyLayout, graphData.nodes.length]);

  // selection + panel positioning
  const [selected, setSelected] = useState(null); // { type:'Node'|'Edge', data }
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const PANEL_W = 360,
    PANEL_OFFSET = 12;

  // filters
  const [filters, setFilters] = useState([]);
  const addFilter = (f) =>
    setFilters((prev) => [
      ...prev,
      { ...f, id: `${Date.now()}_${Math.random().toString(36).slice(2)}` },
    ]);
  const removeFilter = (id) => setFilters((prev) => prev.filter((f) => f.id !== id));
  const clearAllFilters = () => setFilters([]);

  // edge mode + popovers
  const [edgeFrom, setEdgeFrom] = useState(null);
  const [quickAdd, setQuickAdd] = useState(null); // { x,y } DOM pos
  const [quickEdge, setQuickEdge] = useState(null); // { x,y, from,to } DOM pos
  const [edgeFormOpen, setEdgeFormOpen] = useState(false);
  const [edgeFormDefaults, setEdgeFormDefaults] = useState({
    from: '',
    to: '',
    label: '',
  });

  // help + toast
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const notifyTimer = useRef(null);
  const notify = useCallback((msg, level = 'info', ms = 2000) => {
    setToast({ msg, level });
    window.clearTimeout(notifyTimer.current);
    notifyTimer.current = window.setTimeout(() => setToast(null), ms);
  }, []);

  // vis data mapping
  const visNodes = useMemo(
    () =>
      graphData.nodes.map((n) => ({
        id: String(n.id),
        label: n.label ?? n.name ?? String(n.id),
        title: n.type ?? '',
        hidden: n.hidden || false,
        ...n,
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

  // push data to vis
  useEffect(() => {
    if (network) network.setData({ nodes: visNodes, edges: visEdges });
  }, [network, visNodes, visEdges]);

  // positioning helpers
  const clampToContainer = useCallback(
    (x, y) => {
      const c = networkRef.current;
      const w = c?.clientWidth ?? 0,
        h = c?.clientHeight ?? 0;
      const cx = Math.min(Math.max(x + PANEL_OFFSET, 8), Math.max(8, w - PANEL_W - 8));
      const cy = Math.min(Math.max(y + PANEL_OFFSET, 8), Math.max(8, h - 220));
      return { x: cx, y: cy };
    },
    [networkRef],
  );
  const setPopupNearNode = useCallback(
    (nodeId) => {
      if (!network) return;
      const pos = network.getPositions([String(nodeId)])[String(nodeId)];
      if (!pos) return;
      const dom = network.canvasToDOM(pos);
      setPanelPos(clampToContainer(dom.x, dom.y));
    },
    [clampToContainer, network],
  );
  const setPopupNearEdge = useCallback(
    (edge) => {
      if (!network) return;
      const pFrom = network.getPositions([String(edge.from)])[String(edge.from)];
      const pTo = network.getPositions([String(edge.to)])[String(edge.to)];
      if (!pFrom || !pTo) return;
      const mid = { x: (pFrom.x + pTo.x) / 2, y: (pFrom.y + pTo.y) / 2 };
      const dom = network.canvasToDOM(mid);
      setPanelPos(clampToContainer(dom.x, dom.y));
    },
    [clampToContainer, network],
  );
  const repositionPopup = useCallback(() => {
    if (!selected) return;
    if (selected.type === 'Node') setPopupNearNode(selected.data.id);
    else setPopupNearEdge(selected.data);
  }, [selected, setPopupNearNode, setPopupNearEdge]);

  // interactions
  useEffect(() => {
    if (!network) return;

    const onClick = (params) => {
      if (params.nodes?.length) {
        const id = params.nodes[0];
        const node = graphData.nodes.find((n) => String(n.id) === String(id));
        if (node) {
          setSelected({ type: 'Node', data: node });
          setTimeout(() => setPopupNearNode(node.id), 0);
        }
        return;
      }
      if (params.edges?.length) {
        const id = params.edges[0];
        const edge = graphData.edges.find((e) => String(e.id) === String(id));
        if (edge) {
          setSelected({ type: 'Edge', data: edge });
          setTimeout(() => setPopupNearEdge(edge), 0);
        }
        return;
      }
      setSelected(null);
    };

    const onDblClick = (params) => {
      if (params.nodes?.length || params.edges?.length) return;
      const { DOM } = params.pointer;
      setQuickAdd({ x: DOM.x, y: DOM.y });
    };

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
        setQuickEdge({ x: dom.x, y: dom.y, from: edgeFrom, to: clicked });
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
    repositionPopup,
    notify,
    setPopupNearNode,
    setPopupNearEdge,
  ]);

  // ESC to close transient UI
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
        setEdgeFormOpen(false);
        setHelpOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [edgeFrom, quickAdd, quickEdge, notify, network]);

  // filters → hidden flags
  const applyActiveFilters = useCallback((filtersList) => {
    setGraphData((prev) => {
      const allNodeIds = prev.nodes.map((n) => n.id);
      const allEdgeIds = prev.edges.map((e) => String(e.id));
      let keepNodes = new Set(allNodeIds),
        keepEdges = new Set(allEdgeIds);
      const intersect = (a, b) => new Set([...a].filter((x) => b.has(x)));

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
          const neighborhood = new Set([...matchNodes]);
          prev.edges.forEach((e) => {
            if (incidentEdges.has(String(e.id))) {
              neighborhood.add(e.from);
              neighborhood.add(e.to);
            }
          });
          keepNodes = intersect(keepNodes, neighborhood);
          keepEdges = intersect(keepEdges, incidentEdges);
        } else if (f.kind === 'filterEdgePropEq') {
          const { key, value } = f.payload;
          const vl = String(value).toLowerCase();
          const matchEdges = new Set(
            prev.edges
              .filter((e) => String(e[key] ?? '').toLowerCase() === vl)
              .map((e) => String(e.id)),
          );
          const endNodes = new Set();
          prev.edges.forEach((e) => {
            if (matchEdges.has(String(e.id))) {
              endNodes.add(e.from);
              endNodes.add(e.to);
            }
          });
          keepEdges = intersect(keepEdges, matchEdges);
          keepNodes = intersect(keepNodes, endNodes);
        }
      });

      if (!filtersList.length) {
        return {
          nodes: prev.nodes.map((n) => ({ ...n, hidden: false })),
          edges: prev.edges.map((e) => ({ ...e, hidden: false })),
        };
      }
      return {
        nodes: prev.nodes.map((n) => ({ ...n, hidden: !keepNodes.has(n.id) })),
        edges: prev.edges.map((e) => ({
          ...e,
          hidden:
            !keepEdges.has(String(e.id)) ||
            !keepNodes.has(e.from) ||
            !keepNodes.has(e.to),
        })),
      };
    });
  }, []);
  useEffect(() => {
    applyActiveFilters(filters);
    setTimeout(() => network?.fit({ animation: { duration: 300 } }), 0);
  }, [filters, applyActiveFilters, network]);

  // IO helpers
  const toIntIfNumeric = (v) => {
    const n = Number(v);
    return Number.isInteger(n) ? n : v;
  };
  const onImportJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ({ target }) => {
      try {
        const parsed = JSON.parse(target.result);
        const rawNodes = parsed.nodes ?? [],
          rawEdges = parsed.edges ?? parsed.links ?? [];
        const nodes = rawNodes.map((n, i) => {
          const id = toIntIfNumeric(n.id ?? i + 1);
          const name = n.name ?? n.label ?? `Node ${id}`;
          return { ...n, id, name, label: n.label ?? name };
        });
        const edges = rawEdges.map((ed, i) => ({
          id: ed.id ?? `e_${i}`,
          from: toIntIfNumeric(ed.from ?? ed.source),
          to: toIntIfNumeric(ed.to ?? ed.target),
          label: ed.label ?? ed.rel ?? '',
          ...ed,
        }));
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
  const copyJSON = () => {
    const payload = { nodes: graphData.nodes, links: graphData.edges };
    navigator.clipboard
      .writeText(JSON.stringify(payload, null, 2))
      .then(() => notify('Copied JSON to clipboard', 'success'))
      .catch(() => notify('Copy failed', 'error'));
  };

  // selection helpers for search bar
  const selectNodesAndEdges = (nodeIds, edgeIds = []) => {
    if (!network) return;
    network.unselectAll();
    network.selectNodes(nodeIds.map(String), false);
    if (edgeIds.length) network.selectEdges(edgeIds.map(String));
    if (nodeIds.length)
      network.focus(String(nodeIds[0]), { scale: 1, animation: { duration: 300 } });
  };
  const showPanelForNode = (id) => {
    const node = graphData.nodes.find((n) => String(n.id) === String(id));
    if (!node) return;
    setSelected({ type: 'Node', data: node });
    setTimeout(() => setPopupNearNode(node.id), 0);
  };
  const showPanelForEdge = (edgeId) => {
    const edge = graphData.edges.find((e) => String(e.id) === String(edgeId));
    if (!edge) return;
    setSelected({ type: 'Edge', data: edge });
    setTimeout(() => setPopupNearEdge(edge), 0);
  };

  // callbacks given to SearchBar
  const onHighlightNode = (nOrId) => {
    const id = typeof nOrId === 'object' ? nOrId.id : nOrId;
    selectNodesAndEdges([id]);
    showPanelForNode(id);
  };
  const onHighlightEdge = (e) => {
    const id = typeof e === 'object' ? e.id : e;
    const ed = graphData.edges.find((x) => String(x.id) === String(id));
    if (!ed) return;
    selectNodesAndEdges([ed.from, ed.to], [ed.id]);
    showPanelForEdge(ed.id);
  };

  // add popover helpers
  const openAddNodePopoverNearTop = () => {
    const el = networkRef.current;
    const x = el ? Math.round(el.clientWidth / 2) : 40;
    const y = (el?.offsetTop ?? 0) + 24;
    setQuickAdd({ x, y });
  };
  const openEdgeFormFromMenu = () => {
    let from = '',
      to = '';
    const sel = network?.getSelectedNodes?.() || [];
    if (sel.length >= 1) from = String(sel[0]);
    if (sel.length >= 2) to = String(sel[1]);
    setEdgeFormDefaults({ from, to, label: '' });
    setEdgeFormOpen(true);
  };

  // mutation callbacks used by PropertyPanel
  const updateNode = (data, setErr, done) => {
    const newId = Number(data.id);
    if (!Number.isInteger(newId)) {
      setErr('Node "id" must be an integer');
      return;
    }
    const wasId = selected.data.id,
      idChanged = newId !== wasId;
    if (idChanged && graphData.nodes.some((n) => n.id === newId)) {
      setErr(`Node id ${newId} already exists.`);
      return;
    }
    const updated = { ...data, id: newId };
    setGraphData((prev) => {
      const nodes = prev.nodes.map((n) => (n.id === wasId ? updated : n));
      const edges = idChanged
        ? prev.edges.map((e) => ({
            ...e,
            from: e.from === wasId ? newId : e.from,
            to: e.to === wasId ? newId : e.to,
          }))
        : prev.edges;
      return { nodes, edges };
    });
    setSelected({ type: 'Node', data: updated });
    done();
    notify('Node updated', 'success');
    setTimeout(repositionPopup, 0);
  };

  const updateEdge = (data, setErr, done) => {
    const from = Number(data.from),
      to = Number(data.to);
    if (!Number.isInteger(from) || !Number.isInteger(to)) {
      setErr('Edge "from" and "to" must be integers');
      return;
    }
    const nodeIds = new Set(graphData.nodes.map((n) => n.id));
    if (!nodeIds.has(from) || !nodeIds.has(to)) {
      setErr('Both endpoints must be existing node ids');
      return;
    }
    const newId = (data.id ?? selected.data.id).toString();
    const idChanged = newId !== selected.data.id;
    if (idChanged && graphData.edges.some((e) => String(e.id) === newId)) {
      setErr(`Edge id "${newId}" already exists.`);
      return;
    }
    const updated = { ...data, id: newId, from, to };
    setGraphData((prev) => ({
      nodes: prev.nodes,
      edges: prev.edges.map((e) =>
        String(e.id) === String(selected.data.id) ? updated : e,
      ),
    }));
    setSelected({ type: 'Edge', data: updated });
    done();
    notify('Edge updated', 'success');
    setTimeout(repositionPopup, 0);
  };

  const deleteSelected = () => {
    if (!selected) return;
    if (selected.type === 'Node') {
      const id = selected.data.id;
      setGraphData((prev) => ({
        nodes: prev.nodes.filter((n) => n.id !== id),
        edges: prev.edges.filter((e) => e.from !== id && e.to !== id),
      }));
      notify(`Node ${id} deleted`, 'success');
    } else {
      const id = selected.data.id;
      setGraphData((prev) => ({
        nodes: prev.nodes,
        edges: prev.edges.filter((e) => String(e.id) !== String(id)),
      }));
      notify(`Edge ${id} deleted`, 'success');
    }
    setSelected(null);
  };

  // run example from help modal
  const runString = (cmd) => {
    // just forwards to SearchBar via state we already pass; no local state needed
    // left here for parity; SearchBar will call this when you press "Try"
  };

  // fit
  const fitToScreen = () =>
    network?.fit({ animation: { duration: 300, easingFunction: 'easeInOutQuad' } });

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
      <Toolbar
        graphData={graphData}
        filters={filters}
        onAddFilter={addFilter}
        onRemoveFilter={removeFilter}
        onClearFilters={clearAllFilters}
        onAddNodeClick={openAddNodePopoverNearTop}
        onAddEdgeClick={openEdgeFormFromMenu}
        onHighlightNode={onHighlightNode}
        onHighlightEdge={onHighlightEdge}
        onOpenHelp={() => setHelpOpen(true)}
        onRunString={runString}
        notify={notify}
        onFit={fitToScreen}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        onImportJSON={onImportJSON}
        onDownloadJSON={downloadJSON}
        onCopyJSON={copyJSON}
      />

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

      <PropertyPanel
        selected={selected}
        pos={panelPos}
        onClose={() => setSelected(null)}
        onUpdateNode={updateNode}
        onUpdateEdge={updateEdge}
        onDelete={deleteSelected}
      />

      <EdgeModeBanner active={edgeFrom != null} />

      <QuickAddNodePopover
        pos={quickAdd}
        onCancel={() => setQuickAdd(null)}
        onAdd={(label) => {
          const nextId =
            (graphData.nodes.length
              ? Math.max(...graphData.nodes.map((n) => Number(n.id) || 0))
              : 0) + 1;
          const newNode = {
            id: nextId,
            name: label?.trim() || `Node ${nextId}`,
            label: label?.trim() || `Node ${nextId}`,
          };
          setGraphData((prev) => ({
            nodes: [...prev.nodes, newNode],
            edges: prev.edges,
          }));
          setQuickAdd(null);
          setTimeout(() => {
            network?.selectNodes([String(nextId)], false);
            setSelected({ type: 'Node', data: newNode });
            setPopupNearNode(nextId);
          }, 0);
          notify(`Node ${nextId} added`, 'success');
        }}
      />

      <QuickAddEdgePopover
        pos={quickEdge}
        from={quickEdge?.from}
        to={quickEdge?.to}
        onCancel={() => setQuickEdge(null)}
        onAdd={({ from, to, label }) => {
          const edgeId = `e_${Date.now()}`;
          const newEdge = {
            id: edgeId,
            from: Number(from),
            to: Number(to),
            label: (label ?? '').trim(),
          };
          setGraphData((prev) => ({
            nodes: prev.nodes,
            edges: [...prev.edges, newEdge],
          }));
          setQuickEdge(null);
          setTimeout(() => {
            setSelected({ type: 'Edge', data: newEdge });
            setPopupNearEdge(newEdge);
          }, 0);
          notify(`Edge ${edgeId} added`, 'success');
        }}
      />

      <EdgeFormModal
        open={edgeFormOpen}
        defaults={edgeFormDefaults}
        onClose={() => setEdgeFormOpen(false)}
        onSubmit={({ from, to, label }) => {
          const f = parseInt(from, 10),
            t = parseInt(to, 10);
          if (!Number.isInteger(f) || !Number.isInteger(t)) {
            notify('From/To must be integer node ids', 'error');
            return;
          }
          const idSet = new Set(graphData.nodes.map((n) => n.id));
          if (!idSet.has(f) || !idSet.has(t)) {
            notify('Both endpoints must be existing node ids', 'error');
            return;
          }
          const edgeId = `e_${Date.now()}`;
          const newEdge = { id: edgeId, from: f, to: t, label: (label ?? '').trim() };
          setGraphData((prev) => ({
            nodes: prev.nodes,
            edges: [...prev.edges, newEdge],
          }));
          setEdgeFormOpen(false);
          setTimeout(() => {
            setSelected({ type: 'Edge', data: newEdge });
            setPopupNearEdge(newEdge);
          }, 0);
          notify(`Edge ${edgeId} added`, 'success');
        }}
      />

      <HelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onRun={(cmd) => {
          /* SearchBar handles directly; keep for UI parity */
        }}
      />

      <Toast toast={toast} />
    </div>
  );
}
