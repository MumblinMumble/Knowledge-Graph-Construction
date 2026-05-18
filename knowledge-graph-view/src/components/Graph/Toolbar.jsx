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
    // onClearFocus,
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

  const addWrapRef = useRef(null);
  const fileWrapRef = useRef(null);
  const advWrapRef = useRef(null);

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
    if (f.kind === 'filterNodePropEq') return `${key} = ${prettyVals}`;
    if (f.kind === 'filterEdgePropEq') return `edge ${key} = ${prettyVals}`;
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

  // close popovers on outside click
  useEffect(() => {
    const onDoc = (e) => {
      const t = e.target;

      const insideAdd = addWrapRef.current?.contains(t);
      const insideFile = fileWrapRef.current?.contains(t);
      const insideAdv = advWrapRef.current?.contains(t);

      if (!insideAdd) setAddOpen(false);
      if (!insideFile) setFileOpen(false);
      if (!insideAdv) setAdvancedOpen(false);
    };

    if (addOpen || fileOpen || advancedOpen) {
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }
  }, [addOpen, fileOpen, advancedOpen]);

  return (
    <div className="kg-tb">
      {/* ROW 1: main toolbar controls */}
      <div className="kg-tb-row-main">
        {/* Group 1: Add */}
        <div
          className="kg-tb-group kg-tb-group-add"
          data-tooltip="Add Nodes or Edges"
        >
          <div
            className="kg-dropdown"
            ref={addWrapRef}
          >
            <button
              type="button"
              className="kg-btn-ghost"
              onClick={() => setAddOpen((v) => !v)}
            >
              + Add ▾
            </button>

            {addOpen && (
              <div className="kg-dropdown-menu">
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

        {/* Group 2: search bar + Run */}
        <div
          className="kg-tb-group kg-tb-group-search"
          data-tooltip="Basic search and extra commands such as filter and view management"
        >
          <div className="kg-command-wrapper">
            <input
              type="text"
              className="kg-command-input"
              placeholder="Search or type a command…"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleCommandKeyDown}
            />
            <button
              type="button"
              className="kg-icon-button kg-icon-inline"
              title="Search bar commands"
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
            ➤
          </button>
        </div>

        <div className="kg-tb-separator" />

        {/* Group 3: Reset View*/}
        <div
          className="kg-tb-group kg-tb-group-reset"
          data-tooltip="Reset the current graph view to its center position"
        >
          <button
            type="button"
            className="kg-btn-ghost"
            onClick={onFit}
          >
            Reset Screen
          </button>
        </div>

        <div className="kg-tb-separator" />

        {/* Group 4: Advanced colour popover */}
        <div
          className="kg-tb-advanced"
          ref={advWrapRef}
          data-tooltip="Colour options for nodes and edges based on any value present in it"
        >
          <button
            type="button"
            className="kg-btn-ghost"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
          >
            Colour by ▾
          </button>

          {advancedOpen && (
            <div
              className="kg-tb-advanced-popover"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="kg-tb-advanced-row">
                <select
                  className="kg-layout-select"
                  value={nodeColorBy || 'none'}
                  onChange={(e) => setNodeColorBy && setNodeColorBy(e.target.value)}
                  title="Node color by"
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
                  title="Edge color by"
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

        <div className="kg-tb-separator" />

        {/* Group 5: layout*/}
        <div
          className="kg-tb-group kg-tb-group-layout"
          data-tooltip="Choose the layout of the graph from the given options"
        >
          <select
            className="kg-layout-select"
            value={layoutMode}
            onChange={(e) => setLayoutMode && setLayoutMode(e.target.value)}
          >
            <option value="force">Force-directed</option>
            <option value="hierUD">Hierarchical (vertical)</option>
            <option value="hierLR">Hierarchical (horizontal)</option>
          </select>
        </div>

        <div className="kg-tb-separator" />

        {/* Group 6: View*/}
        <div
          className="kg-tb-group kg-tb-group-layout"
          data-tooltip="Creation of views from the current graph view based on whats selected with or without neighbours"
        >
          <button
            type="button"
            className="kg-btn-ghost"
            onClick={onFocusSelection}
            disabled={!onFocusSelection}
          >
            Save View
          </button>

          <button
            type="button"
            className={`kg-secondary-pill ${
              includeNeighbors ? 'kg-secondary-pill--active' : ''
            }`}
            onClick={() => setIncludeNeighbors((v) => !v)}
          >
            Include Neighbors: {includeNeighbors ? 'On' : 'Off'}
          </button>

          {/* <button
            type="button"
            className="kg-btn-ghost"
            onClick={onClearFocus}
            disabled={!onClearFocus}
          >
            Clear focus
          </button> */}
        </div>

        <div className="kg-tb-separator" />

        {/* Group 7: File */}
        <div
          className="kg-tb-group kg-tb-group-file"
          data-tooltip="Loading and Saving of the graphs or views"
        >
          <div
            className="kg-dropdown"
            ref={fileWrapRef}
          >
            <button
              type="button"
              className="kg-btn-ghost"
              onClick={() => setFileOpen((v) => !v)}
            >
              📁 ▾
            </button>

            {fileOpen && (
              <div className="kg-dropdown-menu kg-dropdown-menu-right">
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

      {/* ROW 2: filters chips */}
      {filters.length > 0 && (
        <div className="kg-tb-row-chips">
          <div className="kg-tb-row-title">Filters</div>

          <div className="kg-tb-chips">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                className="kg-chip"
                onClick={() => onRemoveFilter && onRemoveFilter(f.id)}
                title="Click to remove this filter"
              >
                <span>{describeFilter(f)}</span>
                <span className="kg-chip-x">×</span>
              </button>
            ))}

            {onClearFilters && (
              <button
                type="button"
                className="kg-chip kg-chip-clear"
                onClick={onClearFilters}
                title="Clear all filters"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* ROW 3: views chips (THIS IS THE GUARANTEED NEW LINE) */}
      {(views.length > 0 || true) && (
        <div className="kg-tb-row-chips">
          <div className="kg-tb-row-title">Views</div>

          <div className="kg-tb-chips">
            <button
              type="button"
              className={`kg-chip ${activeViewId === 'main' ? 'kg-chip--active' : ''}`}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) toggleMergeSel('main');
                else {
                  setMergeSel(new Set());
                  onActivateView && onActivateView('main');
                }
              }}
              title="Click to switch. Ctrl/Cmd-click to select for merging."
              style={{
                outline: mergeSel.has('main') ? '2px solid #111' : 'none',
                outlineOffset: 2,
              }}
            >
              Main
            </button>

            {views.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`kg-chip ${activeViewId === v.id ? 'kg-chip--active' : ''}`}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey) toggleMergeSel(v.id);
                  else {
                    setMergeSel(new Set());
                    onActivateView && onActivateView(v.id);
                  }
                }}
                title="Click to switch. Ctrl/Cmd-click to select for merging."
                style={{
                  outline: mergeSel.has(v.id) ? '2px solid #111' : 'none',
                  outlineOffset: 2,
                }}
              >
                <span>{v.label}</span>
                <span
                  className="kg-chip-x"
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
              className="kg-chip kg-chip-clear"
              disabled={mergeSel.size < 2}
              onClick={() => {
                if (!onMergeSelectedViews) return;
                onMergeSelectedViews(Array.from(mergeSel));
                setMergeSel(new Set());
              }}
              title="Ctrl/Cmd-click 2+ views, then merge"
              style={{
                opacity: mergeSel.size < 2 ? 0.6 : 1,
                cursor: mergeSel.size < 2 ? 'not-allowed' : 'pointer',
              }}
            >
              Merge selected views
            </button>
          </div>
        </div>
      )}

      {/* hidden inputs */}
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
