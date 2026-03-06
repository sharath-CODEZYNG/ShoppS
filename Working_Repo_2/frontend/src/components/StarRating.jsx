import React from 'react';

export default function StarRating({ rating = 0, count = 0, size = 14 }) {
  const numericRating = Number(rating) || 0;
  const rounded = Math.round(numericRating * 2) / 2;

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const difference = rounded - (i - 1);
      let starColor = '#ccc';
      let opacity = 1;

      if (difference >= 1) {
        starColor = '#f5b301';
        opacity = 1;
      } else if (difference > 0 && difference < 1) {
        starColor = '#f5b301';
        opacity = 0.5;
      }

      stars.push(
        <span
          key={i}
          style={{
            fontSize: `${size}px`,
            color: starColor,
            marginRight: '2px',
            display: 'inline-block',
            opacity: opacity,
          }}
        >
          ★
        </span>
      );
    }
    return stars;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ display: 'flex' }}>
        {renderStars()}
      </div>
      <span style={{ fontSize: `${size}px`, fontWeight: '500' }}>
        {numericRating.toFixed(1)} ({count})
      </span>
    </div>
  );
}
