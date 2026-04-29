import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { ChromaKeyFilter } from '@/components/ChromaKeyFilter';

describe('ChromaKeyFilter', () => {
  it('should render SVG filter when enabled', () => {
    const { container } = render(<ChromaKeyFilter enabled={true} color="green" />);
    const filter = container.querySelector('#chromakey-filter');
    expect(filter).not.toBeNull();
  });

  it('should render identity filter (pass-through) when disabled', () => {
    // SVG must always be in DOM so CSS filter: url(#chromakey-filter) resolves.
    // WebKit makes the element transparent when the referenced SVG node is missing.
    const { container } = render(<ChromaKeyFilter enabled={false} />);
    const filter = container.querySelector('#chromakey-filter');
    expect(filter).not.toBeNull();
    const matrix = container.querySelector('feColorMatrix');
    // Identity matrix — no visual change
    expect(matrix?.getAttribute('values')).toBe('1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0');
  });

  it('should apply green matrix values', () => {
    const { container } = render(<ChromaKeyFilter enabled={true} color="green" />);
    const matrix = container.querySelector('feColorMatrix');
    expect(matrix?.getAttribute('values')).toContain('-6.0');
  });

  it('should apply blue matrix values', () => {
    const { container } = render(<ChromaKeyFilter enabled={true} color="blue" />);
    const matrix = container.querySelector('feColorMatrix');
    expect(matrix?.getAttribute('values')).toContain('3.0 3.0 -6.0');
  });
});
