import React from 'react';

const StarRating = ({ rating = 0, max = 5, size = 18, interactive = false, onChange }) => {
  const stars = Array.from({ length: max }, (_, i) => i + 1);
  return (
    <span style={{ display:'inline-flex', gap:2 }}>
      {stars.map((s) => (
        <span
          key={s}
          onClick={() => interactive && onChange?.(s)}
          style={{
            fontSize: size,
            color: s <= Math.round(rating) ? '#f59e0b' : '#d1d5db',
            cursor: interactive ? 'pointer' : 'default',
            lineHeight: 1,
          }}
        >★</span>
      ))}
    </span>
  );
};

export default StarRating;
