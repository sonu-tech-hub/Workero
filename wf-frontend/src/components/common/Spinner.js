import React from 'react';

const Spinner = ({ size = 40, color = '#6366f1' }) => (
  <div style={{ display:'flex', justifyContent:'center', alignItems:'center', padding:24 }}>
    <div style={{
      width: size, height: size,
      border: `4px solid #e5e7eb`,
      borderTop: `4px solid ${color}`,
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default Spinner;
