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

export const HelpModal = ({ open, onClose, onRun }) => {
  if (!open) return null;
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
          boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h4 style={{ margin: 0, flex: 1 }}>Search & Filter Cheat-Sheet</h4>
          <button
            style={btn}
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div style={{ fontSize: 13, color: '#57606a', marginTop: 4 }}>
          Searches highlight results; Filters add chips and hide everything else.
        </div>
        {[
          ['node:id=26', 'focus node by property'],
          ['edge:label=KNOWS', 'highlight matching edges'],
          ['filter node:id=26', 'show node + incident edges + neighbors'],
          ['filter edge:label=KNOWS', 'show only edges with that label + endpoints'],
          ['reset', 'clear all filters'],
        ].map(([cmd, desc]) => (
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
            <button
              style={btn}
              onClick={() => onRun(cmd)}
            >
              Try
            </button>
            <div style={{ gridColumn: '1/-1', fontSize: 12, color: '#6e7781' }}>
              {desc}
            </div>
          </div>
        ))}
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
