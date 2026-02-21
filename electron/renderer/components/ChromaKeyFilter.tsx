import React from 'react';

interface ChromaKeyFilterProps {
  enabled?: boolean;
  color?: 'green' | 'blue';
}

/**
 * ChromaKeyFilter
 * A specialized SVG filter to remove green (#00FF00) or blue (#0000FF) backgrounds.
 */
export const ChromaKeyFilter: React.FC<ChromaKeyFilterProps> = ({ enabled = true, color = 'green' }) => {
  if (!enabled) return null;

  // Matrix for alpha channel: [R, G, B, A, Offset]
  // Green key formula (balanced): 3.0R - 6.0G + 3.0B + 0.5 Offset
  // Blue key formula (balanced): 3.0R + 3.0G - 6.0B + 0.5 Offset
  const matrixValues = color === 'green'
    ? "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  3.0 -6.0 3.0 1.0 0.5"
    : "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  3.0 3.0 -6.0 1.0 0.5";

  return (
    <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
      <defs>
        <filter id="chromakey-filter" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={matrixValues} />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 1" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
};
