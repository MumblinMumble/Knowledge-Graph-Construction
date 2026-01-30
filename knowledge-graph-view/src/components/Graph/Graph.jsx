// src/components/Graph/Graph.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataFactory } from 'n3';
import useVisNetwork from '../../hooks/useVisNetwork';
import useLayout from '../../hooks/useLayout';
import Toolbar from './Toolbar';
import PropertyPanel from './PropertyPanel';
import SparqlModal from './SparqlModal';
import { runSparqlSelect, rowsToGraph, resetSparqlIdCache } from './io/sparql';

import {
  QuickAddNodePopover,
  QuickAddEdgePopover,
  EdgeFormModal,
  HelpModal,
  EdgeModeBanner,
  GuideModal,
  Toast,
} from './Popovers';

import { applyVisTheme } from './utils/theme';
import { toVisNode, toVisEdge } from './utils/mappers';
import { stripHidden } from './utils/stripHidden';
import { makeJsonImportHandler } from './io/jsonImport';
import { makeRdfImportHandler } from './io/rdfImport';
import { serializeGraphToRDF } from './io/rdfExport';
import './Graph.css';

const SPARQL_ENABLED = false; // keep SPARQL code, but hide UI + hotkeys

// A small categorical palette (repeatable)
const COLOR_PALETTE = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
  '#bcbd22',
  '#17becf',
];

export default function Graph() {
  const { networkRef, network } = useVisNetwork();

  // Canonical data driving the canvas
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });

  // Search bar text (Toolbar)
  const [command, setCommand] = useState('');

  // Focus behavior
  const [includeNeighbors, setIncludeNeighbors] = useState(true);

  // Keep a copy of the full baseline graph (restored when clearing SPARQL view)
  const fullGraphRef = useRef(null);
  const [sparqlOpen, setSparqlOpen] = useState(false);
  const [sparqlActive, setSparqlActive] = useState(false);

  // Box (marquee) selection
  const [marqueeBox, setMarqueeBox] = useState(null); // { left, top, width, height } | null
  const marqueeStartRef = useRef(null);
  const isMarqueeActiveRef = useRef(false);
  const marqueeSelectionRef = useRef([]);
  const marqueeAdditiveRef = useRef(false);

  const marqueePrevInteractionRef = useRef(null);

  const marqueeRafRef = useRef(0);
  const marqueePendingRef = useRef(null);

  const setMarqueeBoxRaf = useCallback((nextBox) => {
    marqueePendingRef.current = nextBox;
    if (marqueeRafRef.current) return;

    marqueeRafRef.current = requestAnimationFrame(() => {
      marqueeRafRef.current = 0;
      setMarqueeBox(marqueePendingRef.current);
    });
  }, []);

  // Layout
  const [layoutMode, setLayoutMode] = useState('force');
  const { applyLayout } = useLayout(networkRef, network, graphData);

  // Track previous layout mode so we know when we *enter* "force"
  const prevLayoutModeRef = useRef(layoutMode);

  // Skip layout during animations/imports
  const suspendLayoutRef = useRef(false);

  // Selection + panel
  const [selected, setSelected] = useState(null);
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const PANEL_W = 360;
  const PANEL_OFFSET = 12;

  // Import batching
  const skipVisSyncRef = useRef(false);
  const selRef = useRef({ nodes: new Set(), edges: new Set() }); // ids as strings
  const lastPointerModsRef = useRef({ ctrl: false, meta: false });
  const BIG_IMPORT_THRESHOLD = 6000;
  const BATCH_SIZE_NODES = 3000;
  const BATCH_SIZE_EDGES = 4000;

  // Export helpers
  const { namedNode, blankNode, literal } = DataFactory;

  // Saved subgraph views (e.g. "View 1", "View 2")
  const [views, setViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState('main'); // 'main' or a view.id

  // Global filters (apply to whichever view is active)
  const [filters, setFilters] = useState([]);

  // Only what is currently visible (after filters)
  const getVisibleSubgraph = useCallback(() => {
    // nodes that are not hidden
    const visibleNodes = graphData.nodes.filter((n) => !n.hidden);
    const visibleNodeIds = new Set(visibleNodes.map((n) => String(n.id)));

    // edges that are not hidden AND whose endpoints are both visible
    const visibleEdges = graphData.edges.filter((e) => {
      if (e.hidden) return false;
      const from = String(e.from);
      const to = String(e.to);
      return visibleNodeIds.has(from) && visibleNodeIds.has(to);
    });

    return { nodes: visibleNodes, edges: visibleEdges };
  }, [graphData]);

  const addFilter = (f) => {
    setFilters((prev) => [
      ...prev,
      { ...f, id: `${Date.now()}_${Math.random().toString(36).slice(2)}` },
    ]);
  };

  const removeFilter = (id) => {
    setFilters((prev) => prev.filter((f) => f.id !== id));
  };

  const clearAllFilters = () => {
    setFilters([]);
  };

  // Color-by (node/edge)
  const [nodeColorBy, setNodeColorBy] = useState('none'); // 'none' | 'label' | 'type' | 'custom'
  const [nodeColorKey, setNodeColorKey] = useState('type');

  const [edgeColorBy, setEdgeColorBy] = useState('none'); // 'none' | 'label' | 'type' | 'custom'
  const [edgeColorKey, setEdgeColorKey] = useState('label');

  // Stable mapping: value -> color
  const nodeColorMapRef = useRef(new Map());
  const edgeColorMapRef = useRef(new Map());

  // Reset mapping when mode/key changes (so colors don’t “carry over” weirdly)
  useEffect(() => {
    nodeColorMapRef.current = new Map();
  }, [nodeColorBy, nodeColorKey]);

  useEffect(() => {
    edgeColorMapRef.current = new Map();
  }, [edgeColorBy, edgeColorKey]);

  const pickColor = useCallback((mapRef, rawValue) => {
    const v = String(rawValue ?? '').trim();
    if (!v) return null;

    const map = mapRef.current;
    if (map.has(v)) return map.get(v);

    const next = COLOR_PALETTE[map.size % COLOR_PALETTE.length];
    map.set(v, next);
    return next;
  }, []);

  const getColorValue = (obj, by, customKey) => {
    if (by === 'none') return null;
    if (by === 'label') return obj?.label ?? obj?.name ?? null;
    if (by === 'type') return obj?.type ?? null;
    if (by === 'custom') return customKey ? obj?.[customKey] : null;
    return null;
  };

  // Edge creation UI
  const [edgeFrom, setEdgeFrom] = useState(null);
  const [quickAdd, setQuickAdd] = useState(null);
  const [quickEdge, setQuickEdge] = useState(null);
  const [edgeFormOpen, setEdgeFormOpen] = useState(false);
  const [edgeFormDefaults, setEdgeFormDefaults] = useState({
    from: '',
    to: '',
    label: '',
  });

  // Help + toast
  const [helpOpen, setHelpOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false); // canvas/ui guide
  const [toast, setToast] = useState(null);
  const notifyTimer = useRef(null);
  const notify = useCallback((msg, level = 'info', ms = 2000) => {
    setToast({ msg, level });
    window.clearTimeout(notifyTimer.current);
    notifyTimer.current = window.setTimeout(() => setToast(null), ms);
  }, []);

  // Theme
  useEffect(() => {
    if (!network) return;
    applyVisTheme(network);
  }, [network]);

  // Helper: always use String(node.id) as vis id
  const toVisNodeStable = useCallback(
    (n) => {
      const raw = toVisNode(n) || {};
      const rawId = n.id;
      const visId = String(rawId);

      // 🔥 Prevent vis-network auto-coloring via `group` unless we want it
      const { group: _ignoreGroup, color: _ignoreColor, ...v } = raw;

      const colorValue = getColorValue(n, nodeColorBy, nodeColorKey);
      const color = colorValue != null ? pickColor(nodeColorMapRef, colorValue) : null;

      return {
        ...v,
        id: visId,
        _rawId: rawId,
        ...(color ? { color: { background: color, border: color } } : {}),
      };
    },
    [nodeColorBy, nodeColorKey, pickColor],
  );

  const toVisEdgeStable = useCallback(
    (e) => {
      const raw = toVisEdge(e) || {};
      const { color: _ignoreColor, ...v } = raw;

      const colorValue = getColorValue(e, edgeColorBy, edgeColorKey);
      const color = colorValue != null ? pickColor(edgeColorMapRef, colorValue) : null;

      return { ...v, ...(color ? { color } : {}) };
    },
    [edgeColorBy, edgeColorKey, pickColor],
  );

  // Map to vis
  const visNodes = useMemo(
    () => graphData.nodes.map(toVisNodeStable),
    [graphData.nodes, toVisNodeStable],
  );
  const visEdges = useMemo(
    () => graphData.edges.map(toVisEdgeStable),
    [graphData.edges, toVisEdgeStable],
  );

  // Normal React → vis sync + layout
  useEffect(() => {
    if (!network || skipVisSyncRef.current) return;

    const prevMode = prevLayoutModeRef.current;
    const switchingToForce = layoutMode === 'force' && prevMode !== 'force';

    if (switchingToForce) {
      console.debug('[Graph] switching to force → reset vis DataSets');
      network.setData({ nodes: [], edges: [] });
    }

    // Push current React state into vis
    network.setData({ nodes: visNodes, edges: visEdges });

    prevLayoutModeRef.current = layoutMode;

    if (!graphData.nodes.length) return;

    // If we're in "no layout while filtering / focusing" mode, just update data.
    if (suspendLayoutRef.current) return;

    console.debug(
      '[Graph] applying layout',
      layoutMode,
      'nodes =',
      graphData.nodes.length,
    );
    applyLayout(layoutMode);
  }, [network, visNodes, visEdges, graphData.nodes.length, layoutMode, applyLayout]);

  // Fast path insert (used by QuickAdd)
  const pushVisNodeImmediate = useCallback(
    (node) => {
      if (!network) return false;
      if (!network.body?.data?.nodes) network.setData({ nodes: [], edges: [] });
      const ds = network.body?.data?.nodes;
      if (!ds?.update) return false;
      ds.update([toVisNodeStable(node)]);
      return true;
    },
    [network, toVisNodeStable],
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

  // Panel positioning
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

  // Camera helper
  const isAnimatingCameraRef = useRef(false);
  const animateTo = useCallback(
    ({ position, scale, duration = 650, easing = 'easeInOutCubic' }) => {
      if (!network) return;
      isAnimatingCameraRef.current = true;
      const prevInteraction = network?.options?.interaction || {};
      network.setOptions({
        interaction: { ...prevInteraction, hover: false, multiselect: false },
      });
      network.once('animationFinished', () => {
        isAnimatingCameraRef.current = false;
        network.setOptions({
          interaction: { ...prevInteraction, hover: true, multiselect: false },
        });
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

  // Interactions
  const suppressNextClickRef = useRef(false);
  const followRafRef = useRef(0);
  useEffect(() => {
    if (!network) return;

    network.setOptions({
      interaction: {
        ...(network.options?.interaction || {}),
        multiselect: false,
      },
    });

    const applySelection = () => {
      const nodes = Array.from(selRef.current.nodes);
      const edges = Array.from(selRef.current.edges);

      requestAnimationFrame(() => {
        if (!network) return;
        network.setSelection({ nodes, edges }, { unselectAll: true });
      });
    };

    const onClick = (params) => {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        return;
      }

      const { ctrl, meta } = lastPointerModsRef.current;
      const toggle = !!(ctrl || meta);

      // Node click
      if (params.nodes?.length) {
        const id = String(params.nodes[0]);

        if (!toggle) {
          selRef.current.nodes = new Set([id]);
          selRef.current.edges = new Set(); // optional: clear edges when clicking a node
        } else {
          const s = selRef.current.nodes;
          if (s.has(id)) s.delete(id);
          else s.add(id);
        }

        applySelection();
        return;
      }

      // Edge click
      if (params.edges?.length) {
        const id = String(params.edges[0]);

        if (!toggle) {
          selRef.current.edges = new Set([id]);
          selRef.current.nodes = new Set(); // optional: clear nodes when clicking an edge
        } else {
          const s = selRef.current.edges;
          if (s.has(id)) s.delete(id);
          else s.add(id);
        }

        applySelection();
        return;
      }

      // Empty space: (choose behavior)
      // If you want empty click to clear selection:
      selRef.current.nodes = new Set();
      selRef.current.edges = new Set();
      applySelection();

      setSelected(null);
    };

    const onDblClick = (params) => {
      // Double-click node -> open panel
      if (params.nodes?.length) {
        const id = params.nodes[0];
        const node = graphData.nodes.find((n) => String(n.id) === String(id));
        if (node) {
          setSelected({ type: 'Node', data: node });
          setTimeout(() => setPopupNearNode(node.id), 0);
        }
        return;
      }

      // Double-click edge -> open panel
      if (params.edges?.length) {
        const id = params.edges[0];
        const edge = graphData.edges.find((e) => String(e.id) === String(id));
        if (edge) {
          setSelected({ type: 'Edge', data: edge });
          setTimeout(() => setPopupNearEdge(edge), 0);
        }
        return;
      }

      // Double-click empty -> your existing "add node" behavior
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

    // capture ctrl/meta state reliably (vis sometimes loses it)
    const container = networkRef.current;
    const onMouseDownCapture = (e) => {
      lastPointerModsRef.current = { ctrl: e.ctrlKey, meta: e.metaKey };
    };
    container?.addEventListener('mousedown', onMouseDownCapture, true);

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
      container?.removeEventListener('mousedown', onMouseDownCapture, true);
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
    networkRef,
  ]);

  // Hotkeys
  useEffect(() => {
    const onKey = (e) => {
      if (SPARQL_ENABLED && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSparqlOpen(true);
        return;
      }
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
        setGuideOpen(false);
        setSparqlOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [edgeFrom, quickAdd, quickEdge, notify, network]);

  // Simple property filters (not SPARQL)
  const applyActiveFilters = useCallback((filtersList) => {
    if (!filtersList.length) return;

    // normalize: trim + lowercase
    const norm = (v) =>
      String(v ?? '')
        .trim()
        .toLowerCase();

    // While filtering, don't re-run layouts
    suspendLayoutRef.current = true;

    setGraphData((prev) => {
      // always start from an unhidden graph
      const base = stripHidden(prev);
      const nodes = base.nodes;
      const edges = base.edges;

      const allNodeIds = nodes.map((n) => String(n.id));
      const allEdgeIds = edges.map((e) => String(e.id));

      let keepNodes = new Set(allNodeIds);
      let keepEdges = new Set(allEdgeIds);

      const intersect = (a, b) => new Set([...a].filter((x) => b.has(x)));

      filtersList.forEach((f) => {
        if (f.kind === 'filterNodePropEq') {
          const { key, value, values } = f.payload || {};
          const allowed = (values && values.length ? values : [value]).map(norm);

          const matchNodes = new Set(
            nodes.filter((n) => allowed.includes(norm(n[key]))).map((n) => String(n.id)),
          );

          const incidentEdges = new Set(
            edges
              .filter(
                (e) => matchNodes.has(String(e.from)) || matchNodes.has(String(e.to)),
              )
              .map((e) => String(e.id)),
          );

          const neighborhood = new Set([...matchNodes]);
          edges.forEach((e) => {
            const idStr = String(e.id);
            if (incidentEdges.has(idStr)) {
              neighborhood.add(String(e.from));
              neighborhood.add(String(e.to));
            }
          });

          keepNodes = intersect(keepNodes, neighborhood);
          keepEdges = intersect(keepEdges, incidentEdges);
        } else if (f.kind === 'filterEdgePropEq') {
          const { key, value, values } = f.payload || {};
          const allowed = (values && values.length ? values : [value]).map(norm);

          const matchEdges = new Set(
            edges.filter((e) => allowed.includes(norm(e[key]))).map((e) => String(e.id)),
          );

          const endNodes = new Set();
          edges.forEach((e) => {
            const idStr = String(e.id);
            if (matchEdges.has(idStr)) {
              endNodes.add(String(e.from));
              endNodes.add(String(e.to));
            }
          });

          keepEdges = intersect(keepEdges, matchEdges);
          keepNodes = intersect(keepNodes, endNodes);
        }
      });

      if (!filtersList.length) return stripHidden(base);

      return {
        nodes: nodes.map((n) => ({
          ...n,
          hidden: !keepNodes.has(String(n.id)),
        })),
        edges: edges.map((e) => ({
          ...e,
          hidden:
            !keepEdges.has(String(e.id)) ||
            !keepNodes.has(String(e.from)) ||
            !keepNodes.has(String(e.to)),
        })),
      };
    });

    // We'll re-enable layout in the filters effect after doing a cheap fit
  }, []);

  useEffect(() => {
    // No filters → unhide everything
    if (!filters.length) {
      setGraphData((prev) => stripHidden(prev));
      setTimeout(() => {
        network?.fit({ animation: { duration: 300 } });
        // OK to let layouts run again afterwards
        suspendLayoutRef.current = false;
      }, 0);
      return;
    }

    // Apply filters (this sets suspendLayoutRef.current = true)
    applyActiveFilters(filters);

    setTimeout(() => {
      network?.fit({ animation: { duration: 300 } });
      // Still keep layout suspended while filtered,
      // so that every little change doesn't re-run physics.
    }, 0);
  }, [filters, applyActiveFilters, network]);

  // RDF export helpers
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
  const onDownloadTTL = async () => {
    try {
      // respect current view + filters
      const visible = stripHidden(graphData);

      const ttl = await serializeGraphToRDF(visible, {
        slug,
        nodeToTerm,
        literalFromNode,
      });
      const blob = new Blob([ttl], { type: 'text/turtle;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'graph.ttl';
      a.click();
      URL.revokeObjectURL(url);
      notify('Exported graph.ttl (current view only)', 'success');
    } catch {
      notify('TTL export failed', 'error');
    }
  };

  const onDownloadNT = async () => {
    try {
      // respect current view + filters
      const visible = stripHidden(graphData);

      const nt = await serializeGraphToRDF(
        visible,
        { slug, nodeToTerm, literalFromNode },
        'nt',
      );
      const blob = new Blob([nt], { type: 'application/n-triples;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'graph.nt';
      a.click();
      URL.revokeObjectURL(url);
      notify('Exported graph.nt (current view only)', 'success');
    } catch {
      notify('N-Triples export failed', 'error');
    }
  };

  // Import handlers
  const onImportJSON = makeJsonImportHandler({
    network,
    notify,
    setGraphData: (g) => {
      console.debug('[IMPORT][JSON] graph set', g);
      fullGraphRef.current = g;
      setGraphData(g);
      setSparqlActive(false);
      setViews([]);
      setActiveViewId('main');
      setFilters([]);

      // 🔹 After import: run current layout (usually 'force')
      requestAnimationFrame(() => {
        if (!network) return;
        applyLayout(layoutMode);
      });
    },
    setFilters,
    stripHidden,
    BATCH_SIZE_NODES,
    BATCH_SIZE_EDGES,
    suspendLayoutRef,
    skipVisSyncRef,
  });

  const onImportRDF = makeRdfImportHandler({
    network,
    notify,
    setGraphData: (g) => {
      console.debug('[IMPORT][RDF] graph set', g);
      fullGraphRef.current = g;
      setGraphData(g);
      setSparqlActive(false);
      setViews([]);
      setActiveViewId('main');
      setFilters([]);

      requestAnimationFrame(() => {
        if (!network) return;
        applyLayout(layoutMode);
      });
    },
    setFilters,
    stripHidden,
    BATCH_SIZE_NODES,
    BATCH_SIZE_EDGES,
    BIG_IMPORT_THRESHOLD,
    suspendLayoutRef,
    skipVisSyncRef,
  });

  // Selection helpers

  const selectNodesAndEdges = useCallback(
    (nodeIds, edgeIds = [], { focus = true } = {}) => {
      if (!network) return;

      const nodesStr = nodeIds.map(String);
      const edgesStr = edgeIds.map(String);

      network.setSelection({ nodes: nodesStr, edges: edgesStr }, { unselectAll: true });

      if (focus && nodesStr.length) {
        network.focus(nodesStr[0], { scale: 1, animation: { duration: 300 } });
      }
    },
    [network],
  );

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

  // Shift + drag box selection (like desktop)
  useEffect(() => {
    const container = networkRef.current;
    if (!container || !network) return;

    const onMouseDown = (e) => {
      // Left button + Shift = start marquee
      if (e.button !== 0 || !e.shiftKey) return;

      marqueeAdditiveRef.current = e.ctrlKey || e.metaKey;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Don't start marquee if clicking directly on a node
      const nodeId = network.getNodeAt({ x, y });
      if (nodeId != null) return;

      marqueePrevInteractionRef.current = {
        dragView: network?.options?.interaction?.dragView,
        dragNodes: network?.options?.interaction?.dragNodes,
        zoomView: network?.options?.interaction?.zoomView,
      };
      network.setOptions({
        interaction: { dragView: false, dragNodes: false, zoomView: false },
      });

      isMarqueeActiveRef.current = true;
      marqueeStartRef.current = { x, y };
      setMarqueeBoxRaf({ left: x, top: y, width: 0, height: 0 });

      // Avoid panning while dragging the marquee
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!isMarqueeActiveRef.current) return;
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const start = marqueeStartRef.current;
      if (!start) return;

      const left = Math.min(x, start.x);
      const top = Math.min(y, start.y);
      const width = Math.abs(x - start.x);
      const height = Math.abs(y - start.y);

      setMarqueeBoxRaf({ left, top, width, height });
    };

    const finishSelection = () => {
      if (!isMarqueeActiveRef.current) return;
      isMarqueeActiveRef.current = false;

      const prev = marqueePrevInteractionRef.current;
      if (prev) {
        network.setOptions({
          interaction: {
            dragView: prev.dragView ?? true,
            dragNodes: prev.dragNodes ?? true,
            zoomView: prev.zoomView ?? true,
          },
        });
        marqueePrevInteractionRef.current = null;
      }

      setMarqueeBoxRaf((box) => {
        if (!box) return null;
        const { left, top, width, height } = box;
        const x1 = left;
        const y1 = top;
        const x2 = left + width;
        const y2 = top + height;

        if (!graphData.nodes.length) return null;

        // Get positions for all nodes (vis uses string ids)
        // Only consider visible nodes (avoids selecting hidden stuff)
        const visibleNodes = graphData.nodes.filter((n) => !n.hidden);

        // Positions for visible nodes only
        const idStrings = visibleNodes.map((n) => String(n.id));
        const positions = network.getPositions(idStrings);

        const selectedNodeIds = [];

        visibleNodes.forEach((n) => {
          const idStr = String(n.id);
          const pos = positions[idStr];
          if (!pos) return;
          const dom = network.canvasToDOM(pos);

          if (dom.x >= x1 && dom.x <= x2 && dom.y >= y1 && dom.y <= y2) {
            selectedNodeIds.push(String(n.id)); // store as string
          }
        });

        if (selectedNodeIds.length) {
          const boxedNodes = selectedNodeIds; // already strings

          // Union with existing selection when Ctrl/Cmd was held at drag start
          const nextNodesSet = marqueeAdditiveRef.current
            ? new Set([...selRef.current.nodes, ...boxedNodes])
            : new Set(boxedNodes);

          // Visible edges only (endpoints must be visible)
          const visibleNodeIds = new Set(visibleNodes.map((n) => String(n.id)));
          const edgesInView = graphData.edges.filter((e) => {
            if (e.hidden) return false;
            return visibleNodeIds.has(String(e.from)) && visibleNodeIds.has(String(e.to));
          });

          // Edges whose endpoints are BOTH in nextNodesSet
          const boxedEdges = edgesInView
            .filter(
              (e) => nextNodesSet.has(String(e.from)) && nextNodesSet.has(String(e.to)),
            )
            .map((e) => String(e.id));

          // If additive, preserve any previously selected edges too
          const nextEdgesSet = marqueeAdditiveRef.current
            ? new Set([...selRef.current.edges, ...boxedEdges])
            : new Set(boxedEdges);

          selRef.current.nodes = nextNodesSet;
          selRef.current.edges = nextEdgesSet;

          network.setSelection(
            { nodes: Array.from(nextNodesSet), edges: Array.from(nextEdgesSet) },
            { unselectAll: true },
          );

          if (!marqueeAdditiveRef.current) {
            const first = Array.from(nextNodesSet)[0];
            if (first) network.focus(first, { scale: 1, animation: { duration: 0 } });
          }

          suppressNextClickRef.current = true;
          notify(`Selected ${nextNodesSet.size} node(s) via box`, 'info');
        } else {
          marqueeSelectionRef.current = [];
        }

        return null; // clear marquee box
      });
    };

    const onMouseUp = () => {
      finishSelection();
    };

    const onMouseLeave = () => {
      finishSelection();
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseLeave);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [networkRef, network, graphData, selectNodesAndEdges, notify, setMarqueeBoxRaf]);

  // SPARQL hard-replace apply/clear
  const applySparqlSubgraph = useCallback(
    (sub) => {
      console.debug('[SPARQL] apply subgraph', sub);
      if (network) {
        try {
          skipVisSyncRef.current = true;
          network.setData({ nodes: [], edges: [] }); // clear canvas completely
          network.setData({
            nodes: sub.nodes.map(toVisNodeStable),
            edges: sub.edges.map(toVisEdgeStable),
          });
        } finally {
          skipVisSyncRef.current = false;
        }
      }
      setGraphData(sub); // React state = subgraph (no merging)
      setSparqlActive(true);
      setTimeout(() => network?.fit({ animation: { duration: 300 } }), 0);
    },
    [network, toVisEdgeStable, toVisNodeStable],
  );

  const hardReplaceVisGraph = useCallback(
    (g) => {
      if (!network) return;

      selRef.current.nodes = new Set();
      selRef.current.edges = new Set();
      network.unselectAll();

      // Sanitize: drop edges whose endpoints aren't present
      const nodeIds = new Set((g.nodes || []).map((n) => String(n.id)));
      const safeEdges = (g.edges || []).filter(
        (e) => nodeIds.has(String(e.from)) && nodeIds.has(String(e.to)),
      );

      // 🔥 IMPORTANT: reset positions so vis doesn't reuse old cached coords
      const resetNodes = (g.nodes || []).map((n) => {
        const nn = { ...n };
        // give a small clustered starting layout
        nn.x = (Math.random() - 0.5) * 200;
        nn.y = (Math.random() - 0.5) * 200;
        nn.fixed = false;
        nn.physics = true;
        return nn;
      });

      const safeGraph = { nodes: resetNodes, edges: safeEdges };

      skipVisSyncRef.current = true;
      try {
        network.setData({ nodes: [], edges: [] });
        network.setData({
          nodes: safeGraph.nodes.map(toVisNodeStable),
          edges: safeGraph.edges.map(toVisEdgeStable),
        });
      } finally {
        skipVisSyncRef.current = false;
      }

      // Apply layout + fit AFTER stabilize (prevents zooming to some far cached box)
      requestAnimationFrame(() => {
        if (!network) return;

        // ensure physics/layout options are set
        applyLayout(layoutMode);

        const doFit = () => {
          if (!network) return;

          if (safeGraph.nodes.length === 1) {
            network.focus(String(safeGraph.nodes[0].id), {
              scale: 1.6,
              animation: { duration: 300 },
            });
          } else {
            network.fit({ animation: { duration: 300 } });
          }
        };

        // run a quick stabilization then fit
        network.once('stabilized', doFit);
        network.stabilize(50);

        // fallback in case stabilized doesn't fire for some reason
        setTimeout(doFit, 120);
      });
    },
    [network, toVisNodeStable, toVisEdgeStable, applyLayout, layoutMode],
  );

  const applyFocusSubgraph = useCallback(
    (sub) => {
      console.debug('[FOCUS] apply subgraph', sub);
      hardReplaceVisGraph(sub);
      setGraphData(sub);
    },
    [hardReplaceVisGraph],
  );

  const clearSparqlView = useCallback(() => {
    if (!sparqlActive) return;
    const baseline = fullGraphRef.current || graphData;
    console.debug('[SPARQL] clear → baseline', baseline);
    if (network) {
      try {
        skipVisSyncRef.current = true;
        network.setData({ nodes: [], edges: [] });
        network.setData({
          nodes: baseline.nodes.map(toVisNodeStable),
          edges: baseline.edges.map(toVisEdgeStable),
        });
      } finally {
        skipVisSyncRef.current = false;
      }
    }
    setGraphData(baseline);
    setSparqlActive(false);
    setTimeout(() => network?.fit({ animation: { duration: 300 } }), 0);
    notify('SPARQL view cleared', 'info');
  }, [sparqlActive, graphData, network, notify, toVisNodeStable, toVisEdgeStable]);

  const onRunSparql = useCallback(
    async (query) => {
      try {
        console.debug('[SPARQL] run:\n', query);

        // Capture baseline the first time we enter SPARQL mode
        if (!sparqlActive && !fullGraphRef.current) {
          fullGraphRef.current = graphData;
          console.debug('[SPARQL] baseline captured');
        }

        // Reset ID caches so the same terms always map to the same node ids
        resetSparqlIdCache();

        // Execute and transform strictly to a subgraph (NO merging)
        const { vars, rows } = await runSparqlSelect(graphData, query);
        console.debug('[SPARQL] vars:', vars, 'rows:', rows?.length ?? 0, rows);

        const sub = rowsToGraph({ vars, rows }); // rows-only → nodes/edges
        console.debug('[SPARQL] subgraph:', sub);

        applySparqlSubgraph(sub);
        notify(
          `SPARQL matched ${sub.nodes.length} nodes, ${sub.edges.length} edges`,
          'success',
          2500,
        );
        setSparqlOpen(false);
      } catch (err) {
        console.error('[SPARQL] error', err);
        notify('SPARQL failed: ' + (err?.message || String(err)), 'error', 4000);
      }
    },
    [graphData, sparqlActive, applySparqlSubgraph, notify],
  );

  // Mutations (panel)
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

  // ---- View merge helpers ----
  const mergeGraphs = (graphs) => {
    // graphs: [{nodes, edges}, ...]
    const nodeMap = new Map(); // key: String(id) -> node
    const edgeMap = new Map(); // key: String(id) -> edge
    const usedEdgeIds = new Set();

    // Merge nodes (shallow merge; later graphs win for extra props, but keep id)
    const upsertNode = (n) => {
      const key = String(n.id);
      const prev = nodeMap.get(key);
      if (!prev) nodeMap.set(key, n);
      else nodeMap.set(key, { ...prev, ...n, id: prev.id }); // keep original id type
    };

    // Add edge, resolving id collisions
    const addEdge = (e) => {
      const idKey = String(e.id);
      if (!usedEdgeIds.has(idKey) && !edgeMap.has(idKey)) {
        edgeMap.set(idKey, e);
        usedEdgeIds.add(idKey);
        return;
      }

      // If same id but identical edge, skip
      const existing = edgeMap.get(idKey);
      if (
        existing &&
        String(existing.from) === String(e.from) &&
        String(existing.to) === String(e.to) &&
        String(existing.label ?? '') === String(e.label ?? '')
      ) {
        return;
      }

      // Otherwise create a new id
      let newId = `${idKey}_m`;
      while (usedEdgeIds.has(newId)) {
        newId = `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      }
      const fixed = { ...e, id: newId };

      edgeMap.set(String(fixed.id), fixed);
      usedEdgeIds.add(String(fixed.id));
    };

    // First pass: nodes + edges
    graphs.forEach((g) => {
      (g?.nodes || []).forEach(upsertNode);
      (g?.edges || []).forEach((e) => {
        // Ensure endpoints exist: if an edge references missing nodes, we’ll add placeholders
        const f = String(e.from);
        const t = String(e.to);
        if (!nodeMap.has(f))
          nodeMap.set(f, { id: isNaN(Number(f)) ? f : Number(f), label: f, name: f });
        if (!nodeMap.has(t))
          nodeMap.set(t, { id: isNaN(Number(t)) ? t : Number(t), label: t, name: t });

        addEdge(e);
      });
    });

    // Second pass: drop edges whose endpoints still aren’t present (paranoia)
    const finalNodes = Array.from(nodeMap.values());
    const finalNodeIds = new Set(finalNodes.map((n) => String(n.id)));

    const finalEdges = Array.from(edgeMap.values()).filter(
      (e) => finalNodeIds.has(String(e.from)) && finalNodeIds.has(String(e.to)),
    );

    // Strip layout fields so vis doesn’t reuse old coords
    const stripLayout = (n) => {
      const nn = { ...n };
      delete nn.x;
      delete nn.y;
      delete nn.vx;
      delete nn.vy;
      delete nn.fixed;
      delete nn.physics;
      return nn;
    };

    return { nodes: finalNodes.map(stripLayout), edges: finalEdges };
  };

  const getGraphForViewId = useCallback(
    (id) => {
      if (id === 'main') return stripHidden(fullGraphRef.current || graphData);
      const v = views.find((x) => x.id === id);
      if (!v) return null;
      return stripHidden(v.graph || v);
    },
    [views, graphData],
  );

  const mergeSelectedViews = useCallback(
    (ids) => {
      const uniq = Array.from(new Set((ids || []).map(String)));

      if (uniq.length < 2) {
        notify(
          'Select at least two views (Ctrl/Cmd-click view chips), then merge.',
          'info',
          2800,
        );
        return;
      }

      const graphs = uniq.map((id) => getGraphForViewId(id)).filter(Boolean);

      if (graphs.length < 2) {
        notify('Could not find at least two valid selected views to merge', 'error');
        return;
      }

      const merged = mergeGraphs(graphs);

      const viewId = `merge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const label = `Merged ${views.length + 1}`;

      setViews((prev) => [...prev, { id: viewId, label, graph: merged }]);
      setActiveViewId(viewId);
      applyFocusSubgraph(merged);

      notify(`Merged ${graphs.length} selected views into "${label}"`, 'success');
    },
    [views.length, applyFocusSubgraph, notify, getGraphForViewId],
  );

  const runString = (raw) => {
    if (!raw) return;
    const cmd = raw.trim();
    if (!cmd) return;

    // ── VIEW COMMANDS ───────────────────────────────────────────
    // view copy
    // view paste
    // view merge <id1> <id2> ...   (ids can include "main")
    if (/^view\b/i.test(cmd)) {
      const parts = cmd.split(/\s+/).filter(Boolean);
      const sub = (parts[1] || '').toLowerCase();

      if (sub === 'copy') {
        const visible = stripHidden(graphData); // current view only
        navigator.clipboard
          .writeText(
            JSON.stringify({ nodes: visible.nodes, edges: visible.edges }, null, 2),
          )
          .then(() => notify('Copied current view to clipboard', 'success'))
          .catch(() => notify('Copy failed', 'error'));
        return;
      }

      if (sub === 'paste') {
        navigator.clipboard
          .readText()
          .then((txt) => {
            const parsed = JSON.parse(txt);
            const incoming = {
              nodes: parsed.nodes || parsed.links || [],
              edges: parsed.edges || parsed.links || [],
            };

            const current = stripHidden(graphData);
            const merged = mergeGraphs([current, incoming]);

            const viewId = `merge_${Date.now()}_${Math.random()
              .toString(36)
              .slice(2, 6)}`;
            const label = `Merged ${views.length + 1}`;

            setViews((prev) => [...prev, { id: viewId, label, graph: merged }]);
            setActiveViewId(viewId);
            applyFocusSubgraph(merged);

            notify(`Pasted + merged into "${label}"`, 'success');
          })
          .catch((e) => notify(`Paste failed: ${e?.message || e}`, 'error'));
        return;
      }

      notify('View commands: view copy | view paste', 'info', 3000);
      return;
    }

    // ── FILTER CLEAR ──────────────────────────────────────────
    if (/^filter\s+clear$/i.test(cmd)) {
      clearAllFilters();
      notify('All filters cleared', 'info');
      return;
    }

    // ── FILTER COMMANDS (supports union with "|") ─────────────
    if (/^filter\b/i.test(cmd)) {
      const rest = cmd.slice(6).trim(); // after "filter"
      if (!rest) {
        notify('Filter syntax: filter node:key=value · filter edge:key=value', 'error');
        return;
      }

      let target = 'node'; // default
      let expr = rest;

      if (rest.startsWith('node:')) {
        target = 'node';
        expr = rest.slice('node:'.length);
      } else if (rest.startsWith('edge:')) {
        target = 'edge';
        expr = rest.slice('edge:'.length);
      }

      const eqIdx = expr.indexOf('=');
      if (eqIdx === -1) {
        notify('Filter must be of form key=value', 'error');
        return;
      }

      const key = expr.slice(0, eqIdx).trim();
      const rawValue = expr.slice(eqIdx + 1).trim();

      if (!key || !rawValue) {
        notify('Filter must include both key and value', 'error');
        return;
      }

      // Split on "|" for union, e.g. CAUSES|RELATES_TO
      const parts = rawValue
        .split('|')
        .map((v) => v.trim())
        .filter(Boolean);

      const payload =
        parts.length > 1
          ? { key, values: parts } // union
          : { key, value: parts[0] }; // single value

      const prettyVals = parts.join(' | ');

      if (target === 'node') {
        addFilter({
          kind: 'filterNodePropEq',
          payload,
        });
        notify(`Added node filter: ${key}=${prettyVals}`, 'success');
      } else {
        addFilter({
          kind: 'filterEdgePropEq',
          payload,
        });
        notify(`Added edge filter: ${key}=${prettyVals}`, 'success');
      }

      // IMPORTANT: no pre-matching / blocking anymore.
      // applyActiveFilters() will actually do the filtering.
      return;
    }

    // ── SEARCH COMMANDS ───────────────────────────────────────
    // Supports:
    //   node.key=value
    //   edge.key=value
    //   key=value
    //   plainText (matches label/name/id)
    let searchTarget = 'auto'; // 'node' | 'edge' | 'auto'
    let expr = cmd;

    if (cmd.startsWith('node.')) {
      searchTarget = 'node';
      expr = cmd.slice('node.'.length);
    } else if (cmd.startsWith('edge.')) {
      searchTarget = 'edge';
      expr = cmd.slice('edge.'.length);
    }

    let propKey = null;
    let propValue = null;
    const eqIdx = expr.indexOf('=');

    if (eqIdx !== -1) {
      propKey = expr.slice(0, eqIdx).trim();
      propValue = expr.slice(eqIdx + 1).trim();
    } else {
      propValue = expr.trim();
    }

    const q = (propValue || '').toLowerCase();
    if (!q) {
      notify('Empty search query', 'error');
      return;
    }

    const matchBy = (obj, defaultKeys) => {
      if (propKey) {
        const v = obj[propKey];
        return v != null && String(v).toLowerCase().includes(q);
      }
      for (const k of defaultKeys) {
        const v = obj[k];
        if (v != null && String(v).toLowerCase().includes(q)) return true;
      }
      return false;
    };

    const results = { nodes: [], edges: [] };

    // Try nodes first (unless explicitly edge)
    if (searchTarget === 'node' || searchTarget === 'auto') {
      const ns = graphData.nodes.filter((n) => matchBy(n, ['label', 'name', 'id']));
      if (ns.length) results.nodes = ns;
    }

    // Edges (explicit or fallback when no node matches)
    if (searchTarget === 'edge' || (searchTarget === 'auto' && !results.nodes.length)) {
      const es = graphData.edges.filter((e) => matchBy(e, ['label', 'id']));
      if (es.length) results.edges = es;
    }

    if (!results.nodes.length && !results.edges.length) {
      notify('No matches found', 'info');
      network?.unselectAll();
      return;
    }

    // Collect node + edge ids
    let nodeIds = results.nodes.map((n) => n.id);
    let edgeIds = results.edges.map((e) => e.id);

    // If we have edge matches, make sure we also include their endpoints
    if (results.edges.length) {
      const extra = new Set(nodeIds);
      results.edges.forEach((e) => {
        extra.add(e.from);
        extra.add(e.to);
      });
      nodeIds = Array.from(extra);
    } else if (!results.edges.length && nodeIds.length) {
      // No direct edge matches, but some node matches:
      // include their incident edges to give context
      const incEdges = graphData.edges.filter(
        (e) => nodeIds.includes(e.from) || nodeIds.includes(e.to),
      );
      edgeIds = incEdges.map((e) => e.id);
    }

    selectNodesAndEdges(nodeIds, edgeIds);

    // Open panel when exactly one thing matched
    if (results.nodes.length === 1 && !results.edges.length) {
      showPanelForNode(results.nodes[0].id);
    } else if (results.edges.length === 1 && !results.nodes.length) {
      showPanelForEdge(results.edges[0].id);
    }

    notify(
      `Matched ${results.nodes.length} node(s), ${results.edges.length} edge(s)`,
      'info',
    );
  };

  const focusOnSelection = useCallback(() => {
    if (!network) return;

    // Always start from what is *currently visible* (after filters)
    const visible = getVisibleSubgraph();
    const { nodes, edges } = visible;

    if (!nodes.length) {
      notify('Nothing to focus on', 'info');
      return;
    }

    // ─────────────────────────────────────────────
    // CASE A: Filters are active → freeze current filtered graph as a view
    // (e.g. after "filter edge:label=1", this is EXACTLY what you see)
    // ─────────────────────────────────────────────
    if (filters.length) {
      const sub = visible; // ONLY currently visible stuff

      const viewId = `focus_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const label = `View ${views.length + 1}`;

      setViews((prev) => [...prev, { id: viewId, label, graph: sub }]);
      setActiveViewId(viewId);

      // clear filters so they don't re-apply on top of the frozen view
      setFilters([]);

      applyFocusSubgraph(sub);
      notify(`Saved filtered result as "${label}"`, 'success');
      return;
    }

    // ─────────────────────────────────────────────
    // CASE B: No filters → focus around explicit selection
    // ─────────────────────────────────────────────
    const selectedIds = selRef.current.nodes.size
      ? Array.from(selRef.current.nodes)
      : (network.getSelectedNodes?.() || []).map(String);

    console.debug('[FOCUS] selectedIds from vis:', selectedIds);

    if (!selectedIds.length) {
      notify('Select at least one node first', 'info');
      return;
    }

    const seed = new Set(selectedIds);
    const keepNodes = new Set(seed);

    if (includeNeighbors) {
      // include immediate neighbors of selected nodes
      edges.forEach((e) => {
        const from = String(e.from);
        const to = String(e.to);
        if (seed.has(from) || seed.has(to)) {
          keepNodes.add(from);
          keepNodes.add(to);
        }
      });
    }

    // keep edges only if both endpoints are kept
    const keepEdges = new Set();
    edges.forEach((e) => {
      const from = String(e.from);
      const to = String(e.to);
      if (keepNodes.has(from) && keepNodes.has(to)) {
        keepEdges.add(String(e.id));
      }
    });

    const sub = {
      nodes: nodes.filter((n) => keepNodes.has(String(n.id))),
      edges: edges.filter((e) => keepEdges.has(String(e.id))),
    };

    const stripLayoutFields = (n) => {
      const nn = { ...n };
      delete nn.x;
      delete nn.y;
      delete nn.vx;
      delete nn.vy;
      delete nn.fixed;
      delete nn.physics;
      return nn;
    };

    const subClean = {
      nodes: sub.nodes.map(stripLayoutFields),
      edges: sub.edges,
    };

    console.debug(
      '[FOCUS][selection] subgraph nodes=',
      sub.nodes.length,
      'edges=',
      sub.edges.length,
    );

    if (!sub.nodes.length) {
      notify('Focus selection resulted in an empty subgraph', 'info');
      return;
    }

    const viewId = `focus_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const label = `View ${views.length + 1}`;

    setViews((prev) => [...prev, { id: viewId, label, graph: subClean }]);
    setActiveViewId(viewId);

    suspendLayoutRef.current = false;
    applyFocusSubgraph(subClean);
    notify(`Focused on selection as "${label}"`, 'success');
    marqueeSelectionRef.current = [];
  }, [
    network,
    getVisibleSubgraph,
    filters.length,
    includeNeighbors,
    views.length,
    applyFocusSubgraph,
    notify,
  ]);

  const activateView = useCallback(
    (id) => {
      const applyViewGraph = (g, viewId) => {
        hardReplaceVisGraph(g);
        setGraphData(g);
        setActiveViewId(viewId);
      };

      // Back to main
      if (id === 'main') {
        const baseline = stripHidden(fullGraphRef.current || graphData);
        applyViewGraph(baseline, 'main');
        return;
      }

      // Saved view
      const view = views.find((v) => v.id === id);
      if (!view) return;

      const g = stripHidden(view.graph || view);
      applyViewGraph(g, id);
    },
    [views, hardReplaceVisGraph, graphData],
  );

  const removeView = useCallback(
    (id) => {
      setViews((prev) => prev.filter((v) => v.id !== id));
      if (activeViewId === id) {
        activateView('main');
      }
    },
    [activeViewId, activateView],
  );

  const clearFocus = useCallback(() => {
    activateView('main');
    notify('Focus cleared', 'info');
  }, [activateView, notify]);

  const fitToScreen = () =>
    network?.fit({
      animation: { duration: 300, easingFunction: 'easeInOutQuad' },
      offset: { x: 0, y: -60 },
    });

  return (
    <div className="kg-graph">
      {/* ───── Toolbar row (Reduce + Organize) ───── */}
      <div className="kg-graph-toolbar">
        <Toolbar
          graphData={graphData}
          filters={filters}
          onAddFilter={addFilter}
          onRemoveFilter={removeFilter}
          onClearFilters={clearAllFilters}
          onAddNodeClick={() => {
            const el = networkRef.current;
            const x = el ? Math.round(el.clientWidth / 2) : 40;
            const y = 24;
            setQuickAdd({ x, y });
          }}
          onAddEdgeClick={() => {
            let from = '';
            let to = '';
            const sel = network?.getSelectedNodes?.() || [];
            if (sel.length >= 1) from = String(sel[0]);
            if (sel.length >= 2) to = String(sel[1]);
            setEdgeFormDefaults({ from, to, label: '' });
            setEdgeFormOpen(true);
          }}
          onHighlightNode={(nOrId) => {
            const id = typeof nOrId === 'object' ? nOrId.id : nOrId;
            selectNodesAndEdges([id]);
            showPanelForNode(id);
          }}
          onHighlightEdge={(e) => {
            const id = typeof e === 'object' ? e.id : e;
            const ed = graphData.edges.find((x) => String(x.id) === String(id));
            if (!ed) return;
            selectNodesAndEdges([ed.from, ed.to], [ed.id]);
            showPanelForEdge(ed.id);
          }}
          onOpenHelp={() => setHelpOpen(true)}
          onRunString={runString}
          notify={notify}
          onFit={fitToScreen}
          onFocusSelection={focusOnSelection}
          onClearFocus={clearFocus}
          layoutMode={layoutMode}
          setLayoutMode={setLayoutMode}
          onImportJSON={onImportJSON}
          onDownloadJSON={() => {
            // current view only (respect filters + view)
            const visible = stripHidden(graphData);
            const payload = { nodes: visible.nodes, links: visible.edges };

            const blob = new Blob([JSON.stringify(payload, null, 2)], {
              type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'graph.json';
            a.click();
            URL.revokeObjectURL(url);
            notify('Downloaded graph.json (current view only)', 'success');
          }}
          onCopyJSON={() => {
            const visible = stripHidden(graphData);
            const payload = { nodes: visible.nodes, links: visible.edges };

            navigator.clipboard
              .writeText(JSON.stringify(payload, null, 2))
              .then(() => notify('Copied current view JSON to clipboard', 'success'))
              .catch(() => notify('Copy failed', 'error'));
          }}
          onImportRDF={onImportRDF}
          onDownloadTTL={onDownloadTTL}
          onDownloadNT={onDownloadNT}
          // If/when you wire these in Toolbar:
          // onOpenSparql={() => setSparqlOpen(true)}
          // onClearSparql={clearSparqlView}
          includeNeighbors={includeNeighbors}
          setIncludeNeighbors={setIncludeNeighbors}
          onMergeSelectedViews={mergeSelectedViews}
          command={command}
          setCommand={setCommand}
          views={views}
          activeViewId={activeViewId}
          onActivateView={activateView}
          onRemoveView={removeView}
          nodeColorBy={nodeColorBy}
          setNodeColorBy={setNodeColorBy}
          nodeColorKey={nodeColorKey}
          setNodeColorKey={setNodeColorKey}
          edgeColorBy={edgeColorBy}
          setEdgeColorBy={setEdgeColorBy}
          edgeColorKey={edgeColorKey}
          setEdgeColorKey={setEdgeColorKey}
        />
      </div>

      {/* ───── Hint + canvas (viz first) ───── */}
      <div className="kg-graph-body">
        <div className="kg-graph-hint-row">
          <p className="kg-graph-hint">
            Double-click empty space: add node · Right-click node: edge mode (target node
            creates edge, Esc cancels) · Shift+drag: box-select · Ctrl/Cmd-click:
            multi-select
            <br />
            Search/filter in the bar · Focus selection saves a view (Neighbors toggle =
            1-hop)
          </p>

          <button
            type="button"
            className="kg-hint-help"
            title="Graph guide"
            onClick={() => setGuideOpen(true)}
          >
            ?
          </button>

          {SPARQL_ENABLED && sparqlActive && (
            <button
              type="button"
              className="kg-secondary-pill"
              onClick={clearSparqlView}
            >
              SPARQL view active · Clear
            </button>
          )}
        </div>

        <div className="kg-graph-canvas">
          <div
            ref={networkRef}
            className="kg-graph-canvas-inner"
            style={{
              cursor: edgeFrom != null ? 'crosshair' : 'default',
            }}
          >
            {marqueeBox && (
              <div
                className="kg-graph-marquee"
                style={{
                  left: marqueeBox.left,
                  top: marqueeBox.top,
                  width: marqueeBox.width,
                  height: marqueeBox.height,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* ───── Overlays / popovers / modals stay the same ───── */}

      <PropertyPanel
        selected={selected}
        pos={panelPos}
        onClose={() => setSelected(null)}
        onUpdateNode={updateNode}
        onUpdateEdge={updateEdge}
        onDelete={deleteSelected}
      />

      <EdgeModeBanner active={edgeFrom != null} />

      {/* ADD NODE */}
      <QuickAddNodePopover
        pos={quickAdd}
        onCancel={() => setQuickAdd(null)}
        onAdd={(label) => {
          skipVisSyncRef.current = false;
          suspendLayoutRef.current = true;

          const maxId = graphData.nodes.reduce((m, n) => {
            const v = Number(n.id);
            return Number.isFinite(v) ? Math.max(m, v) : m;
          }, 0);
          const nextId = maxId + 1;

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

      {SPARQL_ENABLED && (
        <SparqlModal
          open={sparqlOpen}
          onClose={() => setSparqlOpen(false)}
          onRun={onRunSparql}
          onClear={clearSparqlView}
          isFiltered={sparqlActive}
        />
      )}

      <HelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onInsertCommand={setCommand}
      />

      <GuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
      />

      <Toast toast={toast} />
    </div>
  );
}
