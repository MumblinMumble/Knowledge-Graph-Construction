// src/components/Graph/SparqlModal.jsx
import React, { useEffect, useState } from 'react';

export default function SparqlModal({ open, onClose, onRun, defaultQuery }) {
  const starter = defaultQuery || 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 50';
  const [text, setText] = useState(starter);

  useEffect(() => {
    if (open) setText((prev) => (prev?.trim() ? prev : starter));
  }, [open, starter]);

  if (!open) return null;

  return (
    <div style={overlay}>
      <div style={modal}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}
        >
          <strong>Run SPARQL (SELECT only)</strong>
          <button onClick={onClose}>✕</button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          style={ta}
          placeholder="SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 50"
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button
            onClick={() => onRun(text)}
            style={{ padding: '6px 12px' }}
            title="Run (Ctrl/Cmd+Enter)"
          >
            Run
          </button>
          <button
            onClick={onClose}
            style={{ padding: '6px 12px' }}
          >
            Cancel
          </button>
        </div>
        <div style={{ marginTop: 8, color: '#64748b', fontSize: 12 }}>
          Tip: Press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>K</kbd> to open this dialog.
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
};
const modal = {
  width: 720,
  maxWidth: '90vw',
  background: 'white',
  borderRadius: 8,
  padding: 12,
  boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
};
const ta = {
  width: '100%',
  height: 260,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 13,
  lineHeight: 1.4,
  border: '1px solid #ddd',
  borderRadius: 6,
  padding: 8,
};
