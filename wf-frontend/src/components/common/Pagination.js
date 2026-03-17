import React from 'react';

const Pagination = ({ meta, onPageChange }) => {
  if (!meta || meta.total_pages <= 1) return null;
  const { page, total_pages } = meta;

  const pages = [];
  const delta = 2;
  for (let i = Math.max(1, page - delta); i <= Math.min(total_pages, page + delta); i++) {
    pages.push(i);
  }

  const btn = (label, p, disabled = false) => (
    <button
      key={label}
      onClick={() => !disabled && onPageChange(p)}
      disabled={disabled}
      style={{
        padding:'6px 12px', border:'1px solid #d1d5db', borderRadius:6,
        background: p === page ? '#6366f1' : '#fff',
        color: p === page ? '#fff' : '#374151',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontWeight: p === page ? 600 : 400,
        fontSize: 14,
      }}
    >{label}</button>
  );

  return (
    <div style={{ display:'flex', gap:4, justifyContent:'center', marginTop:24, flexWrap:'wrap' }}>
      {btn('«', 1,    page === 1)}
      {btn('‹', page-1, page === 1)}
      {page > 3 && <span style={{ padding:'6px 4px', color:'#9ca3af' }}>…</span>}
      {pages.map((p) => btn(p, p))}
      {page < total_pages - 2 && <span style={{ padding:'6px 4px', color:'#9ca3af' }}>…</span>}
      {btn('›', page+1, page === total_pages)}
      {btn('»', total_pages, page === total_pages)}
    </div>
  );
};

export default Pagination;
