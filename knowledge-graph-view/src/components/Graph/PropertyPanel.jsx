// src/components/Graph/PropertyPanel.jsx
import React, { useEffect, useState } from 'react';
import { btn, btnPrimary, btnDanger, inp } from '../../utils/styles';
import { formatValue } from '../../utils/format';

export default function PropertyPanel({
  selected,
  pos,
  onClose,
  onUpdateNode,
  onUpdateEdge,
  onDelete,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [jsonMode, setJsonMode] = useState(false);
  const [editData, setEditData] = useState(null);
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setIsEditing(false);
    setJsonMode(false);
    setError('');
    setConfirmDelete(false);
    setEditData(selected ? JSON.parse(JSON.stringify(selected.data)) : null);
    setJsonText(selected ? JSON.stringify(selected.data, null, 2) : '');
  }, [selected]);

  if (!selected) return null;

  const apply = () => {
    let d = editData;
    if (jsonMode) {
      try {
        d = JSON.parse(jsonText);
      } catch {
        setError('Invalid JSON');
        return;
      }
    }
    if (selected.type === 'Node') onUpdateNode(d, setError, () => setIsEditing(false));
    else onUpdateEdge(d, setError, () => setIsEditing(false));
  };

  const lines = () => {
    const core =
      selected.type === 'Node' ? ['id', 'name', 'label'] : ['id', 'from', 'to', 'label'];
    const extras = Object.keys(selected.data)
      .filter((k) => !core.includes(k))
      .sort();
    const order = [...core.filter((k) => k in selected.data), ...extras];
    return order.map((k) => [k, formatValue(selected.data[k])]);
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        background: 'rgba(255,255,255,0.98)',
        border: '1px solid #d0d7de',
        borderRadius: 12,
        padding: 12,
        width: 360,
        boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
        fontSize: 13,
        zIndex: 15,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 12, letterSpacing: 0.3 }}>
          {selected.type} Properties
        </strong>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {!isEditing && (
            <button
              style={btn}
              onClick={() => setIsEditing(true)}
            >
              Edit
            </button>
          )}
          {isEditing && (
            <>
              <button
                style={btn}
                onClick={() => setJsonMode((m) => !m)}
              >
                {jsonMode ? 'Form' : 'JSON'}
              </button>
              <button
                style={btn}
                onClick={() => {
                  setIsEditing(false);
                  setError('');
                }}
              >
                {'Cancel'}
              </button>
              <button
                style={btnPrimary}
                onClick={apply}
              >
                Save
              </button>
            </>
          )}
          {!confirmDelete && (
            <button
              style={btnDanger}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            borderRadius: 8,
            background: '#fff5f5',
            border: '1px solid #ffd6d6',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 12 }}>Delete this {selected.type.toLowerCase()}?</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              style={btnDanger}
              onClick={onDelete}
            >
              Confirm
            </button>
            <button
              style={btn}
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!isEditing ? (
        <div
          style={{
            marginTop: 8,
            background: '#f6f8fa',
            padding: 8,
            borderRadius: 8,
            display: 'grid',
            gridTemplateColumns: '110px 1fr',
            gap: 6,
            alignItems: 'baseline',
          }}
        >
          {lines().map(([k, v]) => (
            <React.Fragment key={k}>
              <div style={{ color: '#57606a', fontWeight: 600 }}>{k}</div>
              <div style={{ wordBreak: 'break-word' }}>{v}</div>
            </React.Fragment>
          ))}
        </div>
      ) : jsonMode ? (
        <textarea
          style={{
            width: '100%',
            height: 180,
            padding: 8,
            border: '1px solid #ccc',
            borderRadius: 6,
            fontFamily: 'monospace',
            fontSize: 12,
          }}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />
      ) : (
        <div
          style={{
            marginTop: 8,
            display: 'grid',
            gridTemplateColumns: '110px 1fr',
            columnGap: 8,
            rowGap: 8,
            alignItems: 'center',
          }}
        >
          {Object.entries(editData ?? {}).map(([k, val]) => (
            <React.Fragment key={k}>
              <label
                htmlFor={`edit-${k}`}
                style={{ fontWeight: 600 }}
              >
                {k}
              </label>
              <input
                id={`edit-${k}`}
                style={{ ...inp, width: '100%' }}
                value={val ?? ''}
                onChange={(e) => setEditData((p) => ({ ...p, [k]: e.target.value }))}
              />
            </React.Fragment>
          ))}
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            borderRadius: 8,
            background: '#fff5f5',
            border: '1px solid #ffd6d6',
            color: '#8b0000',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
