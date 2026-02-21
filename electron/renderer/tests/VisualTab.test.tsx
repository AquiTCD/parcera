import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { VisualTab } from '@/components/settings/VisualTab';

describe('VisualTab Isolation Test', () => {
  const dummySettings: any = {
    avatars: {
      user: { assets_dir: '/user' },
      ai: { assets_dir: '/ai' }
    }
  };

  it('renders correctly with settings', () => {
    const renderTabHeader = (title: string) => <h2>{title}</h2>;

    render(
      <VisualTab
        settings={dummySettings}
        updateNested={vi.fn()}
        updateRoot={vi.fn()}
        updateProvider={vi.fn()}
        setStatus={vi.fn()}
        renderTabHeader={renderTabHeader}
        handleSelectDir={vi.fn()}
      />
    );

    expect(screen.getByText(/USERアバター/)).toBeInTheDocument();
    expect(screen.getByText(/AIアバター/)).toBeInTheDocument();
  });
});
