// src/components/Graph/Graph.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataFactory, Writer } from 'n3';
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

  // helper: remove any persisted hidden flags (fixes “missing nodes”)
  const stripHidden = useCallback(
    ({ nodes, edges }) => ({
      nodes: (nodes ?? []).map((n) => ({ ...n, hidden: false })),
      edges: (edges ?? []).map((e) => ({ ...e, hidden: false })),
    }),
    [],
  );

  // layout
  const [layoutMode, setLayoutMode] = useState('force');
  const { applyLayout } = useLayout(networkRef, network, graphData);

  // suspend layout while we animate or import
  const suspendLayoutRef = useRef(false);
  useEffect(() => {
    if (suspendLayoutRef.current) return;
    applyLayout(layoutMode);
  }, [layoutMode, applyLayout, graphData.nodes.length, graphData.edges.length]); // include edges

  // selection + panel positioning
  const [selected, setSelected] = useState(null); // { type:'Node'|'Edge', data }
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const PANEL_W = 360;
  const PANEL_OFFSET = 12;

  // import batching
  const skipVisSyncRef = useRef(false); // skip React→vis setData during big imports
  const isBigImportRef = useRef(false);
  const BIG_IMPORT_THRESHOLD = 6000;
  const BATCH_SIZE_NODES = 3000;
  const BATCH_SIZE_EDGES = 4000;

  // export helpers
  const { namedNode, blankNode, literal, quad } = DataFactory;

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
  const [quickAdd, setQuickAdd] = useState(null); // { x,y } container-relative
  const [quickEdge, setQuickEdge] = useState(null); // { x,y, from,to }
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

  // ---------- visual theme (dark, legible labels) ----------
  useEffect(() => {
    if (!network) return;
    network.setOptions({
      nodes: {
        shape: 'dot',
        size: 18,
        borderWidth: 2,
        font: {
          color: '#0f172a', // dark
          size: 14,
          face: 'Inter, ui-sans-serif',
          strokeWidth: 2,
          strokeColor: '#ffffff',
        },
        color: {
          background: '#0ea5e9',
          border: '#0284c7',
          highlight: { background: '#22c55e', border: '#16a34a' },
          hover: { background: '#38bdf8', border: '#0284c7' },
        },
      },
      edges: {
        width: 1.5,
        selectionWidth: 2,
        smooth: false,
        color: {
          color: '#64748b',
          highlight: '#22c55e',
          hover: '#38bdf8',
          inherit: false,
        },
        font: {
          color: '#334155',
          size: 12,
          face: 'Inter, ui-sans-serif',
          strokeWidth: 2,
          strokeColor: '#ffffff',
          background: 'rgba(255,255,255,0.65)',
        },
        arrows: { to: { enabled: true, scaleFactor: 0.8 } },
      },
      interaction: { hover: true, tooltipDelay: 100 },
      physics: { enabled: true },
    });
  }, [network]);

  // ---------- mapping helpers ----------
  const iriTail = (iri = '') => {
    try {
      const t = iri.split(/[\/#]/).pop() || iri;
      return decodeURIComponent(t);
    } catch {
      return iri;
    }
  };

  const toVisNode = (n) => ({
    ...n,
    id: String(n.id),
    label:
      n.label ??
      n.name ??
      n.value ?? // literal nodes
      (n.iri ? iriTail(n.iri) : String(n.id)),
    title: n.iri || n.type || '',
    hidden: !!n.hidden,
    // optional: distinct style for literal nodes
    ...(n.type === 'Literal'
      ? {
          shape: 'box',
          font: { face: 'Inter, ui-sans-serif', size: 12 },
          color: {
            background: '#fde68a',
            border: '#f59e0b',
            highlight: { background: '#fcd34d', border: '#d97706' },
          },
        }
      : {}),
  });

  const toVisEdge = (e) => ({
    ...e,
    id: String(e.id ?? `${e.from}->${e.to}-${e.label ?? (e.iri ? iriTail(e.iri) : '')}`),
    from: String(e.from),
    to: String(e.to),
    label: e.label ?? (e.iri ? iriTail(e.iri) : ''),
    arrows: 'to',
    hidden: !!e.hidden,
  });

  // vis data mapping (React → vis)
  const visNodes = useMemo(() => graphData.nodes.map(toVisNode), [graphData.nodes]);
  const visEdges = useMemo(() => graphData.edges.map(toVisEdge), [graphData.edges]);

  // push data to vis
  useEffect(() => {
    if (!network || skipVisSyncRef.current) return;
    network.setData({ nodes: visNodes, edges: visEdges });
  }, [network, visNodes, visEdges]);

  // ---------- helpers to ensure new nodes exist before selecting ----------
  const pushVisNodeImmediate = useCallback(
    (node) => {
      if (!network) return false;
      if (!network.body?.data?.nodes) network.setData({ nodes: [], edges: [] });
      const ds = network.body?.data?.nodes;
      if (!ds?.update) return false;
      ds.update([toVisNode(node)]);
      return true;
    },
    [network],
  );

  const waitForVisNode = useCallback(
    (idStr, cb, tries = 40) => {
      const ds = network?.body?.data?.nodes;
      const has = !!ds?.get?.(idStr);
      if (has) cb();
      else if (tries > 0)
        requestAnimationFrame(() => waitForVisNode(idStr, cb, tries - 1));
    },
    [network],
  );

  // positioning helpers
  const clampToContainer = useCallback(
    (x, y) => {
      const c = networkRef.current;
      const w = c?.clientWidth ?? 0;
      const h = c?.clientHeight ?? 0;
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

  // smooth camera helper + UI gate during animation
  const isAnimatingCameraRef = useRef(false);
  const animateTo = useCallback(
    ({ position, scale, duration = 650, easing = 'easeInOutCubic' }) => {
      if (!network) return;
      isAnimatingCameraRef.current = true;

      const prevInteraction = network?.options?.interaction || {};
      network.setOptions({ interaction: { ...prevInteraction, hover: false } });

      network.once('animationFinished', () => {
        isAnimatingCameraRef.current = false;
        network.setOptions({ interaction: { ...prevInteraction, hover: true } });
        requestAnimationFrame(() => repositionPopup());
      });

      network.moveTo({
        position,
        scale,
        animation: { duration, easingFunction: easing },
      });
    },
    [network, repositionPopup],
  );

  // interactions
  const followRafRef = useRef(0);
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

    // DOUBLE-CLICK → open on-map label popover
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

    const follow = () => {
      if (!selected || isAnimatingCameraRef.current) return;
      if (followRafRef.current) return;
      followRafRef.current = requestAnimationFrame(() => {
        followRafRef.current = 0;
        repositionPopup();
      });
    };

    network.on('click', onClick);
    network.on('doubleClick', onDblClick);
    network.on('oncontext', onContext);
    network.on('dragging', follow);
    network.on('zoom', follow);
    network.on('stabilized', follow);
    window.addEventListener('resize', follow);

    return () => {
      if (followRafRef.current) cancelAnimationFrame(followRafRef.current);
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
    selected,
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
  const applyActiveFilters = useCallback(
    (filtersList) => {
      if (!filtersList.length) return;
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

        if (!filtersList.length) return stripHidden(prev);

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
    },
    [stripHidden],
  );

  useEffect(() => {
    if (!filters.length) {
      // when filters cleared, unhide everything
      setGraphData((prev) => stripHidden(prev));
      setTimeout(() => network?.fit({ animation: { duration: 300 } }), 0);
      return;
    }
    applyActiveFilters(filters);
    setTimeout(() => network?.fit({ animation: { duration: 300 } }), 0);
  }, [filters, applyActiveFilters, stripHidden, network]);

  // ---------------- RDF EXPORT HELPERS ----------------
  const BASE_IRI = 'http://example.org/';

  const slug = (s = '') =>
    String(s)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'relatedTo';

  const nodeToTerm = (n) => {
    if (!n) return null;
    if (n.iri) return namedNode(n.iri);
    if (n.bnode) return blankNode(n.bnode);
    return namedNode(`${BASE_IRI}node/${n.id}`);
  };

  const literalFromNode = (n) => {
    if (!n) return null;
    const val = n.value ?? n.label ?? n.name ?? String(n.id);
    if (n.lang) return literal(val, n.lang);
    if (n.datatype) return literal(val, namedNode(n.datatype));
    return literal(val);
  };

  const serializeGraphToRDF = (format = 'ttl') => {
    const prefixes = {
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      schema: 'http://schema.org/',
      ex: BASE_IRI,
      exprop: `${BASE_IRI}prop/`,
    };

    const writer = new Writer({
      prefixes,
      format: format === 'nt' ? 'N-Triples' : undefined,
    });

    const nodesById = new Map(graphData.nodes.map((n) => [String(n.id), n]));

    for (const n of graphData.nodes) {
      const s = nodeToTerm(n);
      if (!s) continue;

      if (n.label && n.label !== n.iri) {
        writer.addQuad(quad(s, namedNode(prefixes.rdfs + 'label'), literal(n.label)));
      }

      if (n.props && n.props.description) {
        writer.addQuad(
          quad(
            s,
            namedNode(prefixes.schema + 'description'),
            literal(n.props.description),
          ),
        );
      }

      if (n.props) {
        for (const [k, v] of Object.entries(n.props)) {
          if (k === 'description') continue;
          const p = namedNode(prefixes.exprop + slug(k));
          writer.addQuad(quad(s, p, literal(String(v))));
        }
      }
    }

    for (const e of graphData.edges) {
      const sNode = nodesById.get(String(e.from));
      const oNode = nodesById.get(String(e.to));
      const s = nodeToTerm(sNode);
      if (!s) continue;
      const p = e.iri ? namedNode(e.iri) : namedNode(prefixes.exprop + slug(e.label));
      let o = nodeToTerm(oNode);
      if (oNode && (oNode.type === 'Literal' || 'value' in oNode)) {
        o = literalFromNode(oNode);
      }
      if (!o) continue;
      writer.addQuad(quad(s, p, o));
    }

    return new Promise((resolve, reject) => {
      writer.end((err, result) => (err ? reject(err) : resolve(result)));
    });
  };

  // download helpers
  const downloadTextFile = (text, filename, mime = 'text/plain') => {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onDownloadTTL = async () => {
    try {
      const ttl = await serializeGraphToRDF('ttl');
      downloadTextFile(ttl, 'graph.ttl', 'text/turtle');
      notify('Exported graph.ttl', 'success');
    } catch {
      notify('TTL export failed', 'error');
    }
  };

  const onDownloadNT = async () => {
    try {
      const nt = await serializeGraphToRDF('nt');
      downloadTextFile(nt, 'graph.nt', 'application/n-triples');
      notify('Exported graph.nt', 'success');
    } catch {
      notify('N-Triples export failed', 'error');
    }
  };

  // --- JSON import (worker + batching) ---
  const onImportJSON = (e) => {
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

    const worker = new Worker(new URL('../../workers/jsonWorker.js', import.meta.url));
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
        const { nodes, edges } = stripHidden(msg.data); // strip hidden flags
        setFilters([]); // clear any active filters

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

  // --- RDF import (worker + batching) ---
  const onImportRDF = (e) => {
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

    const worker = new Worker(new URL('../../workers/rdfWorker.js', import.meta.url));
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
        const { nodes, edges } = stripHidden(msg.data); // strip hidden flags
        setFilters([]); // clear active filters
        isBigImportRef.current = nodes.length + edges.length >= BIG_IMPORT_THRESHOLD;

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
                `RDF imported (${nodes.length} nodes, ${edges.length} edges)`,
                'success',
              );
              suspendLayoutRef.current = false;
              skipVisSyncRef.current = false; // re-enable normal syncing
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

  // selection helpers
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
    const y = 24;
    setQuickAdd({ x, y });
  };

  const openEdgeFormFromMenu = () => {
    let from = '';
    let to = '';
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
    const wasId = selected.data.id;
    const idChanged = newId !== wasId;
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
    const from = Number(data.from);
    const to = Number(data.to);
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
  const runString = (_cmd) => {};

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
        onImportRDF={onImportRDF}
        onDownloadTTL={onDownloadTTL}
        onDownloadNT={onDownloadNT}
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

      {/* ADD NODE (on-map popover) */}
      <QuickAddNodePopover
        pos={quickAdd}
        onCancel={() => setQuickAdd(null)}
        onAdd={(label) => {
          // re-enable sync if a previous import turned it off
          skipVisSyncRef.current = false;
          // Pause layout so it won't fight the camera
          suspendLayoutRef.current = true;

          // robust nextId in case of non-numeric ids
          const maxId = graphData.nodes.reduce((m, n) => {
            const v = Number(n.id);
            return Number.isFinite(v) ? Math.max(m, v) : m;
          }, 0);
          const nextId = maxId + 1;

          // spawn position
          let spawn = null;
          if (network && quickAdd?.x != null && quickAdd?.y != null) {
            const p = network.DOMtoCanvas({ x: quickAdd.x, y: quickAdd.y + 8 });
            spawn = { x: p.x, y: p.y };
          }

          const text =
            typeof label === 'string' ? label.trim() : String(label ?? '').trim();

          const newNode = {
            id: nextId,
            name: text || `Node ${nextId}`,
            label: text || `Node ${nextId}`,
            ...(spawn
              ? { x: spawn.x, y: spawn.y, fixed: { x: true, y: true }, physics: false }
              : {}),
          };

          const pushed = pushVisNodeImmediate(newNode);

          setGraphData((prev) => ({
            nodes: [...prev.nodes, newNode],
            edges: prev.edges,
          }));
          setQuickAdd(null);

          const idStr = String(nextId);
          const centerAndSelect = () => {
            try {
              if (!network) return;
              if (spawn) network.moveNode(idStr, spawn.x, spawn.y);
              const pos = network.getPositions([idStr])[idStr] || spawn;
              if (pos) {
                animateTo({
                  position: pos,
                  scale: 2.0,
                  duration: 600,
                  easing: 'easeInOutCubic',
                });
              }
              network.selectNodes([idStr], false);
              setSelected({ type: 'Node', data: newNode });
              setPopupNearNode(nextId);
            } finally {
              setTimeout(() => {
                suspendLayoutRef.current = false;
              }, 650);

              const unpinOnce = (params) => {
                if (params.nodes && params.nodes.map(String).includes(idStr)) {
                  setGraphData((prev) => ({
                    ...prev,
                    nodes: prev.nodes.map((n) =>
                      n.id === nextId ? { ...n, fixed: false, physics: true } : n,
                    ),
                  }));
                  network.off('dragEnd', unpinOnce);
                }
              };
              network.on('dragEnd', unpinOnce);
            }
          };

          if (pushed) waitForVisNode(idStr, centerAndSelect);
          else requestAnimationFrame(centerAndSelect);

          notify(`Node ${nextId} added`, 'success');
        }}
      />

      {/* ADD EDGE */}
      <QuickAddEdgePopover
        pos={quickEdge}
        from={quickEdge?.from}
        to={quickEdge?.to}
        onCancel={() => setQuickEdge(null)}
        onAdd={({ from, to, label }) => {
          const f = Number(from);
          const t = Number(to);
          if (!Number.isInteger(f) || !Number.isInteger(t)) {
            notify('From/To must be integer node ids', 'error');
            return;
          }
          const idSet = new Set(graphData.nodes.map((n) => n.id));
          if (!idSet.has(f) || !idSet.has(t)) {
            notify('Both endpoints must be existing node ids', 'error');
            return;
          }

          const edgeLabel =
            typeof label === 'string' ? label.trim() : String(label ?? '').trim();

          const edgeId = `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const newEdge = { id: edgeId, from: f, to: t, label: edgeLabel };
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
          const f = parseInt(from, 10);
          const t = parseInt(to, 10);
          if (!Number.isInteger(f) || !Number.isInteger(t)) {
            notify('From/To must be integer node ids', 'error');
            return;
          }
          const idSet = new Set(graphData.nodes.map((n) => n.id));
          if (!idSet.has(f) || !idSet.has(t)) {
            notify('Both endpoints must be existing node ids', 'error');
            return;
          }
          const edgeLabel =
            typeof label === 'string' ? label.trim() : String(label ?? '').trim();

          const edgeId = `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const newEdge = { id: edgeId, from: f, to: t, label: edgeLabel };
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
        onRun={() => {}}
      />

      <Toast toast={toast} />
    </div>
  );
}
