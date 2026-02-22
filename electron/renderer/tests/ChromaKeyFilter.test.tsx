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

  it('should not render anything when disabled', () => {
    const { container } = render(<ChromaKeyFilter enabled={false} />);
    expect(container.firstChild).toBeNull();
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
