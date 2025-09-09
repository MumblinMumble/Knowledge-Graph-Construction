// src/components/Graph/Toolbar.jsx
import React from 'react';
import {
  btn,
  btnPrimary,
  btnGhost,
  group,
  menu,
  menuLeft,
  menuItem,
  inp,
} from '../../utils/styles';
import SearchBar from './SearchBar';
import FilterChips from './FilterChips';

export default function Toolbar({
  graphData,
  filters,
  onAddFilter,
  onRemoveFilter,
  onClearFilters,
  onAddNodeClick,
  onAddEdgeClick,
  onHighlightNode,
  onHighlightEdge,
  onOpenHelp,
  onRunString,
  notify,
  onFit,
  layoutMode,
  setLayoutMode,
  onImportJSON,
  onDownloadJSON,
  onCopyJSON,
  onImportRDF,
  onDownloadNT,
  onDownloadTTL,
}) {
  const [fileOpen, setFileOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);

  return (
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
      {/* Left: Add */}
      <div style={{ ...group, minWidth: 280, flexWrap: 'wrap' }}>
        <button
          style={btnPrimary}
          onClick={() => setAddOpen((v) => !v)}
        >
          ＋ Add ▾
        </button>
        {addOpen && (
          <div style={menuLeft}>
            <button
              style={menuItem}
              onClick={() => {
                setAddOpen(false);
                onAddNodeClick();
              }}
            >
              Node…
            </button>
            <button
              style={menuItem}
              onClick={() => {
                setAddOpen(false);
                onAddEdgeClick();
              }}
            >
              Edge…
            </button>
          </div>
        )}
        <span style={{ fontSize: 12, color: '#6e7781', marginLeft: 6 }}>
          Tip: double-click empty space to add a node · right-click node → node to add an
          edge
        </span>
      </div>

      {/* Center: Search + Fit + Layout */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minWidth: 320,
          alignItems: 'stretch',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SearchBar
            graphData={graphData}
            onHighlightNode={onHighlightNode}
            onHighlightEdge={onHighlightEdge}
            onAddFilter={onAddFilter}
            onClearFilters={onClearFilters}
            onOpenHelp={onOpenHelp}
            notify={notify}
            onRunString={onRunString}
          />
          <button
            style={btnGhost}
            onClick={onFit}
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
        <FilterChips
          filters={filters}
          onRemove={onRemoveFilter}
          onClear={onClearFilters}
        />
      </div>

      {/* Right: File */}
      <div style={group}>
        <button
          style={btn}
          onClick={() => setFileOpen((v) => !v)}
        >
          File ▾
        </button>

        {fileOpen && (
          <div style={menu}>
            {/* Import JSON */}
            <label
              style={{
                ...menuItem,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              Import Json
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  onImportJSON?.(e);
                  setFileOpen(false);
                  e.target.value = '';
                }}
                style={{ display: 'none' }}
              />
            </label>

            {/* Download / Copy JSON */}
            <button
              style={menuItem}
              onClick={() => {
                setFileOpen(false);
                onDownloadJSON?.();
              }}
            >
              Download Json
            </button>
            <button
              style={menuItem}
              onClick={() => {
                setFileOpen(false);
                onCopyJSON?.();
              }}
            >
              Copy JSON
            </button>

            {/* Import RDF — same styling as Import Json */}
            {onImportRDF && (
              <label
                style={{
                  ...menuItem,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                Import RDF (.nt/.ttl)
                <input
                  type="file"
                  accept=".nt,.ttl"
                  onChange={(e) => {
                    onImportRDF(e);
                    setFileOpen(false);
                    e.target.value = '';
                  }}
                  style={{ display: 'none' }}
                />
              </label>
            )}
            <button
              style={menuItem}
              onClick={() => {
                setFileOpen(false);
                onDownloadTTL && onDownloadTTL();
              }}
            >
              Download RDF (TTL)
            </button>

            <button
              style={menuItem}
              onClick={() => {
                setFileOpen(false);
                onDownloadNT && onDownloadNT();
              }}
            >
              Download RDF (N-Triples)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
