import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SidebarLayout } from '../components/layout/SidebarLayout';
import { SidebarNav } from '../components/layout/SidebarNav';

describe('SidebarNav', () => {
  const navItems = [
    { id: 'character', label: 'キャラクター' },
    { id: 'mic', label: 'マイク・入力' },
    { id: 'integration', label: '連携' },
    { id: 'advanced', label: '詳細設定', advanced: true },
    { id: 'developer', label: '開発者', advanced: true },
  ];

  it('renders all nav items', () => {
    render(<SidebarNav items={navItems} activeId="character" onSelect={vi.fn()} />);
    expect(screen.getByText('キャラクター')).toBeInTheDocument();
    expect(screen.getByText('マイク・入力')).toBeInTheDocument();
    expect(screen.getByText('連携')).toBeInTheDocument();
    expect(screen.getByText('詳細設定')).toBeInTheDocument();
    expect(screen.getByText('開発者')).toBeInTheDocument();
  });

  it('shows separator before advanced items', () => {
    render(<SidebarNav items={navItems} activeId="character" onSelect={vi.fn()} />);
    expect(screen.getByText('高度な設定')).toBeInTheDocument();
  });

  it('marks the active item', () => {
    render(<SidebarNav items={navItems} activeId="mic" onSelect={vi.fn()} />);
    const micButton = screen.getByText('マイク・入力').closest('button');
    expect(micButton).toHaveAttribute('aria-current', 'page');
  });

  it('calls onSelect when an item is clicked', () => {
    const onSelect = vi.fn();
    render(<SidebarNav items={navItems} activeId="character" onSelect={onSelect} />);
    fireEvent.click(screen.getByText('マイク・入力'));
    expect(onSelect).toHaveBeenCalledWith('mic');
  });

  it('does NOT have scrollspy — clicking changes active', () => {
    const onSelect = vi.fn();
    render(<SidebarNav items={navItems} activeId="character" onSelect={onSelect} />);
    fireEvent.click(screen.getByText('詳細設定'));
    expect(onSelect).toHaveBeenCalledWith('advanced');
  });
});

describe('SidebarLayout', () => {
  it('renders sidebar and content area', () => {
    render(
      <SidebarLayout sidebar={<div>sidebar content</div>}>
        <div>main content</div>
      </SidebarLayout>
    );
    expect(screen.getByText('sidebar content')).toBeInTheDocument();
    expect(screen.getByText('main content')).toBeInTheDocument();
  });

  it('sidebar contains navigation landmark when using SidebarNav', () => {
    const items = [{ id: 'a', label: 'A' }];
    render(
      <SidebarLayout sidebar={<SidebarNav items={items} activeId="a" onSelect={vi.fn()} />}>
        <div>content</div>
      </SidebarLayout>
    );
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
