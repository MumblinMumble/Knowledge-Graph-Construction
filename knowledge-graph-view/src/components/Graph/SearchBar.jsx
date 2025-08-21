// src/components/Graph/SearchBar.jsx
import React, { useRef, useState, useEffect } from 'react';
import { btnGhost, inp } from '../../utils/styles';
import {
  eqCI,
  parseNodeSearch,
  parseEdgeSearch,
  parseFilterNode,
  parseFilterEdge,
} from '../../utils/searchParsing';

export default function SearchBar({
  graphData,
  onHighlightNode,
  onHighlightEdge,
  onAddFilter,
  onClearFilters,
  onOpenHelp,
  notify,
  onRunString,
}) {
  const inputRef = useRef(null);
  const groupRef = useRef(null);
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const onDoc = (e) => {
      if (groupRef.current && !groupRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const open = (list) => {
    if (!list?.length) return;
    setItems(list.slice(0, 12));
    setIdx(0);
    setMenuOpen(true);
  };
  const close = () => {
    setMenuOpen(false);
    setItems([]);
  };

  const handle = () => {
    const raw = q.trim();
    if (!raw) return;
    if (raw.toLowerCase() === 'reset') {
      onClearFilters();
      notify('Filters cleared', 'success');
      close();
      return;
    }
    if (['help', '?'].includes(raw.toLowerCase())) {
      onOpenHelp();
      close();
      return;
    }

    const nodeS = parseNodeSearch(raw);
    const edgeS = parseEdgeSearch(raw);
    const fNode = parseFilterNode(raw);
    const fEdge = parseFilterEdge(raw);

    if (!nodeS && !edgeS && !fNode && !fEdge) {
      notify(
        'Use node:key=value, edge:key=value, filter node:key=value, or filter edge:key=value',
        'error',
        3500,
      );
      close();
      return;
    }

    if (nodeS) {
      const { key, value } = nodeS;
      const exact = graphData.nodes.filter((n) => eqCI(n[key], value));
      if (exact.length === 1) {
        onHighlightNode(exact[0]);
        close();
        return;
      }
      if (exact.length > 1) {
        open(
          exact.map((n) => ({
            kind: 'node',
            id: n.id,
            label: n.label ?? n.name ?? String(n.id),
            subtitle: `${key}=${n[key]} • id ${n.id}`,
          })),
        );
        notify(`${exact.length} nodes matched — pick one`, 'info');
        return;
      }
      const contains = graphData.nodes.filter((n) =>
        String(n[key] ?? '')
          .toLowerCase()
          .includes(String(value).toLowerCase()),
      );
      if (!contains.length) {
        notify('No nodes match that property', 'error');
        close();
        return;
      }
      open(
        contains.map((n) => ({
          kind: 'node',
          id: n.id,
          label: n.label ?? n.name ?? String(n.id),
          subtitle: `${key}=${n[key]} • id ${n.id}`,
        })),
      );
      notify('No exact match — showing contains() suggestions', 'info');
      return;
    }

    if (edgeS) {
      const { key, value } = edgeS;
      const exact = graphData.edges.filter((e) => eqCI(e[key], value));
      if (exact.length === 1) {
        onHighlightEdge(exact[0]);
        close();
        return;
      }
      if (exact.length > 1) {
        open(
          exact.map((e) => ({
            kind: 'edge',
            id: e.id,
            from: e.from,
            to: e.to,
            label: `edge ${e.id}`,
            subtitle: `${key}=${e[key]} • ${e.from} → ${e.to}${
              e.label ? ' • ' + e.label : ''
            }`,
          })),
        );
        notify(`${exact.length} edges matched — pick one`, 'info');
        return;
      }
      const contains = graphData.edges.filter((e) =>
        String(e[key] ?? '')
          .toLowerCase()
          .includes(String(value).toLowerCase()),
      );
      if (!contains.length) {
        notify('No edges match that property', 'error');
        close();
        return;
      }
      open(
        contains.map((e) => ({
          kind: 'edge',
          id: e.id,
          from: e.from,
          to: e.to,
          label: `edge ${e.id}`,
          subtitle: `${key}=${e[key]} • ${e.from} → ${e.to}${
            e.label ? ' • ' + e.label : ''
          }`,
        })),
      );
      notify('No exact match — showing contains() suggestions', 'info');
      return;
    }

    if (fNode) {
      const { key, value } = fNode;
      onAddFilter({
        kind: 'filterNodePropEq',
        label: `node: ${key}=${value}`,
        payload: { key, value },
      });
      close();
      return;
    }
    if (fEdge) {
      const { key, value } = fEdge;
      onAddFilter({
        kind: 'filterEdgePropEq',
        label: `edge: ${key}=${value}`,
        payload: { key, value },
      });
      close();
      return;
    }
  };

  return (
    <div
      ref={groupRef}
      style={{
        display: 'flex',
        flex: 1,
        minWidth: 320,
        alignItems: 'stretch',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          ref={inputRef}
          style={{ ...inp, flex: 1 }}
          placeholder="node:key=value · edge:key=value · filter node:key=value · filter edge:key=value (i for help)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (menuOpen && items.length) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIdx((i) => (i + 1) % items.length);
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIdx((i) => (i - 1 + items.length) % items.length);
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                const it = items[idx];
                if (it?.kind === 'node') onHighlightNode({ id: it.id });
                else if (it?.kind === 'edge')
                  onHighlightEdge({ id: it.id, from: it.from, to: it.to });
                close();
                return;
              }
              if (e.key === 'Escape') {
                close();
                return;
              }
            }
            if (e.key === 'Enter') handle();
          }}
        />
        <button
          style={btnGhost}
          onClick={handle}
          title="Run"
        >
          Run
        </button>
        <button
          style={{ ...btnGhost, width: 32, padding: 0, borderRadius: 999 }}
          onClick={onOpenHelp}
          title="Search help"
        >
          i
        </button>
      </div>

      {menuOpen && items.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '100%',
            marginTop: 6,
            width: inputRef.current ? inputRef.current.offsetWidth : '100%',
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
          {items.map((it, i) => (
            <div
              key={`${it.kind}-${it.label}-${i}`}
              role="option"
              aria-selected={i === idx}
              onMouseEnter={() => setIdx(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (it.kind === 'node') onHighlightNode({ id: it.id });
                else onHighlightEdge({ id: it.id, from: it.from, to: it.to });
                close();
              }}
              style={{
                padding: '8px 10px',
                borderBottom: i === items.length - 1 ? 'none' : '1px solid #f0f2f4',
                background: i === idx ? '#f6f8fa' : '#fff',
                cursor: 'pointer',
                display: 'grid',
                gridTemplateColumns: '18px 1fr',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12, color: '#57606a' }}>
                {it.kind === 'node' ? '●' : '→'}
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
  );
}
