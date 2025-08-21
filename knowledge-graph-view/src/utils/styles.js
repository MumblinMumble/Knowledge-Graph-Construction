// src/utils/styles.js
export const btn = {
  padding: '6px 12px',
  borderRadius: '6px',
  border: '1px solid #d0d7de',
  background: '#f6f8fa',
  cursor: 'pointer',
};
export const btnPrimary = {
  ...btn,
  background: '#0969da',
  color: '#fff',
  borderColor: '#0969da',
};
export const btnDanger = {
  ...btn,
  background: '#d1242f',
  color: '#fff',
  borderColor: '#d1242f',
};
export const btnGhost = { ...btn, background: '#fff' };
export const inp = {
  padding: '6px',
  border: '1px solid #ccc',
  borderRadius: 6,
  width: 120,
  boxSizing: 'border-box',
};
export const group = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  position: 'relative',
};
export const menu = {
  position: 'absolute',
  top: '110%',
  right: 0,
  background: '#fff',
  border: '1px solid #d0d7de',
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  padding: 8,
  zIndex: 10,
  minWidth: 180,
};
export const menuLeft = { ...menu, left: 0, right: 'auto' };
export const menuItem = { ...btn, width: '100%', textAlign: 'left', background: '#fff' };

export const chip = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  borderRadius: 999,
  border: '1px solid #d0d7de',
  background: '#eef6ff',
  fontSize: 12,
};
export const chipX = {
  padding: '0 6px',
  lineHeight: '18px',
  borderRadius: 999,
  background: '#e1e4e8',
  cursor: 'pointer',
};
