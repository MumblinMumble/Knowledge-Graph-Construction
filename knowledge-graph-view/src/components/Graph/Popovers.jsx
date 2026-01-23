// src/components/Graph/Popovers.jsx
import React, { useState } from 'react';
import { btn, btnPrimary, inp } from '../../utils/styles';

export function QuickAddNodePopover({ pos, onCancel, onAdd }) {
  const [label, setLabel] = useState('');
  if (!pos) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        transform: 'translate(10px,10px)',
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
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onAdd(label);
        }}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button
          style={btn}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          style={btnPrimary}
          onClick={() => onAdd(label)}
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function QuickAddEdgePopover({ pos, from, to, onCancel, onAdd }) {
  const [label, setLabel] = useState('');
  if (!pos) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        transform: 'translate(-50%,-10px)',
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
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onAdd({ from, to, label });
        }}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button
          style={btn}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          style={btnPrimary}
          onClick={() => onAdd({ from, to, label })}
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function EdgeFormModal({ open, defaults, onClose, onSubmit }) {
  const [form, setForm] = useState(defaults ?? { from: '', to: '', label: '' });
  React.useEffect(
    () => setForm(defaults ?? { from: '', to: '', label: '' }),
    [defaults, open],
  );
  if (!open) return null;
  return (
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
            value={form.from}
            onChange={(e) => setForm((s) => ({ ...s, from: e.target.value }))}
          />
          <input
            style={{ ...inp, width: '100%' }}
            placeholder="To id"
            value={form.to}
            onChange={(e) => setForm((s) => ({ ...s, to: e.target.value }))}
          />
        </div>
        <input
          style={{ ...inp, width: '100%', marginTop: 8 }}
          placeholder="Label (optional)"
          value={form.label}
          onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))}
        />
        <div
          style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}
        >
          <button
            style={btn}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            style={btnPrimary}
            onClick={() => onSubmit(form)}
          >
            Add
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#6e7781' }}>
          Tip: right-click source → right-click target to add in place.
        </div>
      </div>
    </div>
  );
}

export const HelpModal = ({ open, onClose, onInsertCommand }) => {
  if (!open) return null;

  const searchExamples = [
    { cmd: 'alice', desc: 'Find nodes where label, name or id contains "alice".' },
    { cmd: 'node.label=Person', desc: 'Nodes whose label contains "Person".' },
    { cmd: 'node.id=5', desc: 'Node with id 5 (exact match).' },
    { cmd: 'edge.label=KNOWS', desc: 'Edges whose label contains "KNOWS".' },
    {
      cmd: 'type=Person',
      desc: 'Tries matching the "type" field on nodes first, then edges.',
    },
  ];

  const filterExamples = [
    {
      cmd: 'filter node:label=Person',
      desc: 'Keep only nodes with label "Person", neighbours and incident edges.',
    },
    {
      cmd: 'filter node:type=Person|Company',
      desc: 'Union: keep nodes where type is Person OR Company.',
    },
    {
      cmd: 'filter edge:label=RELATED_TO',
      desc: 'Keep only edges with that label and their endpoint nodes.',
    },
    {
      cmd: 'filter clear',
      desc: 'Remove all active filters and show the full graph again.',
    },
  ];

  const viewCmdExamples = [
    {
      cmd: 'view copy',
      desc: 'Copies the current view (what you see right now) as JSON to your clipboard.',
    },
    {
      cmd: 'view paste',
      desc: 'Reads JSON from your clipboard, merges it into the current view, and saves a new merged view.',
    },
  ];

  const Row = ({ cmd, desc }) => (
    <div
      key={cmd}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 8,
        marginTop: 8,
      }}
    >
      <code>{cmd}</code>
      {onInsertCommand && (
        <button
          style={btn}
          onClick={() => {
            onInsertCommand(cmd);
            onClose();
          }}
        >
          Try
        </button>
      )}
      <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#6e7781' }}>{desc}</div>
    </div>
  );

  return (
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
        if (e.target === e.currentTarget) onClose();
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
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h4 style={{ margin: 0, flex: 1 }}>Command Bar Cheat-Sheet</h4>
          <button
            style={btn}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div style={{ fontSize: 13, color: '#57606a', marginTop: 4 }}>
          These are commands you type into the big bar and run with <strong>Enter</strong>{' '}
          or <strong>Run</strong>.
          <br />
          Searches highlight results; filters add chips and hide everything else.
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>🔍 Search</div>
          <div style={{ fontSize: 12, color: '#57606a', marginBottom: 6 }}>
            Click <strong>Try</strong> to copy a command into the bar.
          </div>
          {searchExamples.map((x) => (
            <Row
              key={x.cmd}
              {...x}
            />
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>🎯 Filter</div>
          <div style={{ fontSize: 12, color: '#57606a', marginBottom: 6 }}>
            Filters stack (each one narrows the visible subgraph).
            <br />
            Use <code>|</code> for unions, e.g.{' '}
            <code>filter node:type=Person|Company</code>.
          </div>
          {filterExamples.map((x) => (
            <Row
              key={x.cmd}
              {...x}
            />
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
            🧩 View commands
          </div>
          <div style={{ fontSize: 12, color: '#57606a', marginBottom: 6 }}>
            These also run in the command bar.
          </div>
          {viewCmdExamples.map((x) => (
            <Row
              key={x.cmd}
              {...x}
            />
          ))}
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: '#8c959f' }}>
          Tip: Press <code>Esc</code> to close popovers/modals.
        </div>
      </div>
    </div>
  );
};

// add this NEW export in Popovers.jsx (below HelpModal is fine)

export const GuideModal = ({ open, onClose }) => {
  if (!open) return null;

  const Section = ({ title, children }) => (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#57606a', lineHeight: 1.45 }}>{children}</div>
    </div>
  );

  return (
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
        if (e.target === e.currentTarget) onClose();
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
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h4 style={{ margin: 0, flex: 1 }}>Graph Guide</h4>
          <button
            style={btn}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <Section title="🖱️ Canvas interactions">
          <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
            <li>
              <b>Double-click empty</b>: add node
            </li>
            <li>
              <b>Double-click node/edge</b>: open properties panel
            </li>
            <li>
              <b>Right-click node</b>: edge mode (right-click target node to create edge)
            </li>
            <li>
              <b>Shift + drag</b>: box select
            </li>
            <li>
              <b>Ctrl/Cmd-click</b>: toggle selection (multi-select)
            </li>
            <li>
              <b>Esc</b>: cancel edge mode + close popovers/modals
            </li>
          </ul>
        </Section>

        <Section title="🎛️ Toolbar buttons">
          <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
            <li>
              <b>Center</b>: fit/center graph on screen
            </li>
            <li>
              <b>Layout</b>: switch force / hierarchical
            </li>
            <li>
              <b>Advanced → Color</b>: color nodes/edges by label/type/custom key
            </li>
            <li>
              <b>Focus selection</b>: saves a new view from selection (optionally includes
              1-hop neighbors)
            </li>
            <li>
              <b>Neighbors toggle</b>: includes 1-hop neighbors when focusing
            </li>
            <li>
              <b>Clear focus</b>: return to Main view
            </li>
          </ul>
        </Section>

        <Section title="🧩 Views (UI)">
          <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
            <li>Click a view chip to switch</li>
            <li>
              Remove a view with the <b>×</b> on the chip
            </li>
            <li>
              Merge views: Ctrl/Cmd-click 2+ chips → <b>Merge selected</b>
            </li>
          </ul>
        </Section>

        <Section title="📁 Import / Export">
          <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
            <li>
              <b>File → Import JSON/RDF</b>
            </li>
            <li>
              <b>File → Download JSON/Turtle/N-Triples</b> (exports current view)
            </li>
            <li>
              <b>Copy JSON</b> copies current view to clipboard
            </li>
          </ul>
        </Section>
      </div>
    </div>
  );
};

export const EdgeModeBanner = ({ active }) =>
  !active ? null : (
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
  );

export const Toast = ({ toast }) =>
  !toast ? null : (
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
    >
      {toast.msg}
    </div>
  );
