// src/components/Graph/FilterChips.jsx
import React from 'react';
import { btn, chip, chipX } from '../../utils/styles';

export default function FilterChips({ filters, onRemove, onClear }) {
  if (!filters.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {filters.map((f) => (
        <span
          key={f.id}
          style={chip}
        >
          {f.label}
          <button
            style={chipX}
            onClick={() => onRemove(f.id)}
            aria-label={`Remove ${f.label}`}
          >
            ×
          </button>
        </span>
      ))}
      <button
        style={{ ...btn, background: '#fff' }}
        onClick={onClear}
      >
        Clear all
      </button>
    </div>
  );
}
