// src/components/Graph/Toolbar.jsx
import React, { useEffect, useRef, useState } from 'react';
import './Toolbar.css';

export default function Toolbar(props) {
  const {
    onAddNodeClick,
    onAddEdgeClick,
    onOpenHelp,
    onRunString,
    onFit,
    onFocusSelection,
    onClearFocus,
    layoutMode,
    setLayoutMode,
    onImportJSON,
    onDownloadJSON,
    onCopyJSON,
    onImportRDF,
    onDownloadTTL,
    onDownloadNT,
    command,
    setCommand,
    filters = [],
    onRemoveFilter,
    onClearFilters,
    views = [],
    activeViewId = 'main',
    onActivateView,
    onRemoveView,
    includeNeighbors,
    setIncludeNeighbors,
    onMergeSelectedViews,
    nodeColorBy,
    setNodeColorBy,
    nodeColorKey,
    setNodeColorKey,
    edgeColorBy,
    setEdgeColorBy,
    edgeColorKey,
    setEdgeColorKey,
  } = props;

  const [addOpen, setAddOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [mergeSel, setMergeSel] = useState(() => new Set());

  const jsonInputRef = useRef(null);
  const rdfInputRef = useRef(null);

  useEffect(() => {
    const onDoc = () => setAdvancedOpen(false);
    if (advancedOpen) document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [advancedOpen]);

  const toggleMergeSel = (id) => {
    setMergeSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const describeFilter = (f) => {
    if (!f || !f.payload) return 'Filter';

    const { key, value, values } = f.payload;
    const vals = values && values.length ? values : value != null ? [value] : [];
    const prettyVals = vals.join(' | ');

    if (f.kind === 'filterNodePropEq') {
      return `${key} = ${prettyVals}`;
    }
    if (f.kind === 'filterEdgePropEq') {
      return `edge ${key} = ${prettyVals}`;
    }
    return 'Filter';
  };

  const handleRun = () => {
    const trimmed = command.trim();
    if (!trimmed || !onRunString) return;
    onRunString(trimmed);
  };

  const handleCommandKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  };

  const closeMenus = () => {
    setAddOpen(false);
    setFileOpen(false);
    setAdvancedOpen(false);
  };

  return (
    <div className="kg-tb">
      <div className="kg-tb-row-main">
        {/* Group 1: Add */}
        <div className="kg-tb-group kg-tb-group-add">
          <div className="kg-dropdown">
            <button
              type="button"
              className="kg-btn-ghost"
              onClick={(e) => {
                e.stopPropagation();
                setFileOpen(false);
                setAdvancedOpen(false);
                setAddOpen((v) => !v);
              }}
            >
              + Add ▾
            </button>

            {addOpen && (
              <div
                className="kg-dropdown-menu"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="kg-dropdown-item"
                  onClick={() => {
                    setAddOpen(false);
                    onAddNodeClick && onAddNodeClick();
                  }}
                >
                  Node
                </button>
                <button
                  type="button"
                  className="kg-dropdown-item"
                  onClick={() => {
                    setAddOpen(false);
                    onAddEdgeClick && onAddEdgeClick();
                  }}
                >
                  Edge
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="kg-tb-separator" />

        {/* Group 2: search bar + Run (with "i" inside the bar) */}
        <div className="kg-tb-group kg-tb-group-search">
          <div className="kg-command-wrapper">
            <input
              type="text"
              className="kg-command-input"
              placeholder="node.key=value · edge.key=value · filter node:key=value · filter edge:key=value"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleCommandKeyDown}
            />
            <button
              type="button"
              className="kg-icon-button kg-icon-inline"
              title="Keyboard shortcuts & tips"
              onClick={onOpenHelp}
            >
              i
            </button>
          </div>

          <button
            type="button"
            className="kg-btn-primary"
            onClick={handleRun}
          >
            Run
          </button>
        </div>

        <div className="kg-tb-separator" />

        {/* Group 3: Fit + layout + focus */}
        <div className="kg-tb-group kg-tb-group-layout">
          <button
            type="button"
            className="kg-btn-ghost"
            onClick={onFit}
          >
            Center
          </button>

          <select
            className="kg-layout-select"
            value={layoutMode}
            onChange={(e) => setLayoutMode && setLayoutMode(e.target.value)}
          >
            <option value="force">Force-directed</option>
            <option value="hierUD">Hierarchical (vertical)</option>
            <option value="hierLR">Hierarchical (horizontal)</option>
          </select>

          <div className="kg-tb-advanced">
            <button
              type="button"
              className="kg-btn-ghost"
              onClick={(e) => {
                e.stopPropagation();
                setAddOpen(false);
                setFileOpen(false);
                setAdvancedOpen((v) => !v);
              }}
              aria-expanded={advancedOpen}
            >
              Advanced ▾
            </button>

            {advancedOpen && (
              <div
                className="kg-tb-advanced-popover"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="kg-tb-advanced-row">
                  <span className="kg-tb-muted">Color</span>

                  <select
                    className="kg-layout-select"
                    value={nodeColorBy || 'none'}
                    onChange={(e) => setNodeColorBy && setNodeColorBy(e.target.value)}
                  >
                    <option value="none">Nodes: none</option>
                    <option value="label">Nodes: label</option>
                    <option value="type">Nodes: type</option>
                    <option value="custom">Nodes: custom</option>
                  </select>

                  {nodeColorBy === 'custom' && (
                    <input
                      className="kg-tb-small-input"
                      placeholder="node key"
                      value={nodeColorKey || ''}
                      onChange={(e) => setNodeColorKey && setNodeColorKey(e.target.value)}
                    />
                  )}

                  <select
                    className="kg-layout-select"
                    value={edgeColorBy || 'none'}
                    onChange={(e) => setEdgeColorBy && setEdgeColorBy(e.target.value)}
                  >
                    <option value="none">Edges: none</option>
                    <option value="label">Edges: label</option>
                    <option value="type">Edges: type</option>
                    <option value="custom">Edges: custom</option>
                  </select>

                  {edgeColorBy === 'custom' && (
                    <input
                      className="kg-tb-small-input"
                      placeholder="edge key"
                      value={edgeColorKey || ''}
                      onChange={(e) => setEdgeColorKey && setEdgeColorKey(e.target.value)}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="kg-btn-ghost"
            onClick={onFocusSelection}
            disabled={!onFocusSelection}
          >
            Focus selection
          </button>

          <button
            type="button"
            className={`kg-secondary-pill ${
              includeNeighbors ? 'kg-secondary-pill--active' : ''
            }`}
            onClick={() => setIncludeNeighbors((v) => !v)}
            title="When on, Focus includes 1-hop neighbors of selected nodes"
          >
            Neighbors: {includeNeighbors ? 'On' : 'Off'}
          </button>

          <button
            type="button"
            className="kg-btn-ghost"
            onClick={onClearFocus}
            disabled={!onClearFocus}
          >
            Clear focus
          </button>
        </div>

        <div className="kg-tb-separator" />

        {/* Group 4: File */}
        <div className="kg-tb-group kg-tb-group-file">
          <div className="kg-dropdown">
            <button
              type="button"
              className="kg-btn-ghost"
              onClick={(e) => {
                e.stopPropagation();
                setAddOpen(false);
                setAdvancedOpen(false);
                setFileOpen((v) => !v);
              }}
            >
              File ▾
            </button>

            {fileOpen && (
              <div
                className="kg-dropdown-menu kg-dropdown-menu-right"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="kg-dropdown-label">JSON</div>

                <button
                  type="button"
                  className="kg-dropdown-item"
                  onClick={() => {
                    closeMenus();
                    jsonInputRef.current?.click();
                  }}
                >
                  Import JSON…
                </button>

                <button
                  type="button"
                  className="kg-dropdown-item"
                  onClick={() => {
                    closeMenus();
                    onDownloadJSON && onDownloadJSON();
                  }}
                >
                  Download JSON (current view)
                </button>

                <button
                  type="button"
                  className="kg-dropdown-item"
                  onClick={() => {
                    closeMenus();
                    onCopyJSON && onCopyJSON();
                  }}
                >
                  Copy JSON (current view)
                </button>

                <div className="kg-dropdown-separator" />

                <div className="kg-dropdown-label">RDF</div>

                <button
                  type="button"
                  className="kg-dropdown-item"
                  onClick={() => {
                    closeMenus();
                    rdfInputRef.current?.click();
                  }}
                >
                  Import RDF…
                </button>

                <button
                  type="button"
                  className="kg-dropdown-item"
                  onClick={() => {
                    closeMenus();
                    onDownloadTTL && onDownloadTTL();
                  }}
                >
                  Download Turtle (.ttl) (current view)
                </button>

                <button
                  type="button"
                  className="kg-dropdown-item"
                  onClick={() => {
                    closeMenus();
                    onDownloadNT && onDownloadNT();
                  }}
                >
                  Download N-Triples (.nt) (current view)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NEW: active filters as chips */}
      {filters.length > 0 && (
        <div
          className="kg-tb-filters-row"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 8px',
                borderRadius: 999,
                border: '1px solid #d0d7de',
                background: '#f6f8fa',
                fontSize: 11,
                cursor: 'pointer',
              }}
              onClick={() => onRemoveFilter && onRemoveFilter(f.id)}
              title="Click to remove this filter"
            >
              <span>{describeFilter(f)}</span>
              <span
                style={{
                  fontSize: 12,
                  lineHeight: 1,
                  paddingLeft: 2,
                }}
              >
                ×
              </span>
            </button>
          ))}

          {onClearFilters && (
            <button
              type="button"
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 999,
                border: '1px solid #d0d7de',
                background: '#ffffff',
                cursor: 'pointer',
              }}
              onClick={onClearFilters}
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* NEW: saved views as chips */}
      {views.length > 0 && (
        <div
          className="kg-tb-views-row"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          {/* Main view chip */}
          <button
            type="button"
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey) {
                toggleMergeSel('main');
              } else {
                setMergeSel(new Set());
                onActivateView && onActivateView('main');
              }
            }}
            style={{
              padding: '2px 10px',
              borderRadius: 999,
              border: '1px solid #d0d7de',
              background: activeViewId === 'main' ? '#0366d6' : '#f6f8fa',
              color: activeViewId === 'main' ? '#ffffff' : '#24292f',
              fontSize: 11,
              cursor: 'pointer',
              outline: mergeSel.has('main') ? '2px solid #111' : 'none',
              outlineOffset: 2,
            }}
            title="Click to switch. Ctrl/Cmd-click to select for merging."
          >
            Main
          </button>

          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  toggleMergeSel(v.id);
                } else {
                  setMergeSel(new Set());
                  onActivateView && onActivateView(v.id);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 10px',
                borderRadius: 999,
                border: '1px solid #d0d7de',
                background: activeViewId === v.id ? '#0366d6' : '#f6f8fa',
                color: activeViewId === v.id ? '#ffffff' : '#24292f',
                fontSize: 11,
                cursor: 'pointer',
                outline: mergeSel.has(v.id) ? '2px solid #111' : 'none',
                outlineOffset: 2,
              }}
              title="Click to switch. Ctrl/Cmd-click to select for merging."
            >
              <span>{v.label}</span>
              <span
                style={{
                  fontSize: 12,
                  lineHeight: 1,
                  paddingLeft: 2,
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveView && onRemoveView(v.id);
                  setMergeSel((prev) => {
                    const next = new Set(prev);
                    next.delete(v.id);
                    return next;
                  });
                }}
                title="Remove this view"
              >
                ×
              </span>
            </button>
          ))}

          <button
            type="button"
            disabled={mergeSel.size < 2}
            onClick={() => {
              if (!onMergeSelectedViews) return;
              onMergeSelectedViews(Array.from(mergeSel));
              setMergeSel(new Set());
            }}
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              padding: '2px 10px',
              borderRadius: 999,
              border: '1px solid #d0d7de',
              background: mergeSel.size < 2 ? '#f6f8fa' : '#ffffff',
              cursor: mergeSel.size < 2 ? 'not-allowed' : 'pointer',
              opacity: mergeSel.size < 2 ? 0.6 : 1,
            }}
            title="Ctrl/Cmd-click 2+ views, then merge"
          >
            Merge selected
          </button>
        </div>
      )}

      {/* hidden inputs for imports */}
      <input
        type="file"
        ref={jsonInputRef}
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          closeMenus();
          onImportJSON && onImportJSON(e);
          if (jsonInputRef.current) jsonInputRef.current.value = '';
        }}
      />
      <input
        type="file"
        ref={rdfInputRef}
        accept=".ttl,.nt"
        style={{ display: 'none' }}
        onChange={(e) => {
          closeMenus();
          onImportRDF && onImportRDF(e);
          if (rdfInputRef.current) rdfInputRef.current.value = '';
        }}
      />
    </div>
  );
}
