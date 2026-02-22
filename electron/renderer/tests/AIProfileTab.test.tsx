import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { AIProfileTab } from '../components/settings/AIProfileTab';
import type { ParceraSettings } from '../../shared/types';

describe('AIProfileTab', () => {
  const mockUpdateNested = vi.fn();
  const mockUpdateRoot = vi.fn();
  const mockSetStatus = vi.fn();

  const dummySettings: ParceraSettings = {
    ai_profile: {
      name: 'Parcera',
      species: 'AI',
      gender: 'Non-binary',
      personality: 'Friendly',
      tone: 'Casual',
      first_person: 'Atashi',
      hobbies: 'Gaming'
    },
    user_profile: {
      name: 'User',
      calling: 'User-san',
      gender: 'Unknown',
      mode: 'soliloquy'
    },
    knowledge: 'Initial knowledge'
  } as any;

  const props = {
    settings: dummySettings,
    defaultSettings: dummySettings,
    updateNested: mockUpdateNested,
    updateProvider: vi.fn(),
    updateRoot: mockUpdateRoot,
    setStatus: mockSetStatus,
    renderTabHeader: (title: string) => <h2>{title}</h2>
  };

  it('renders all AI profile fields', () => {
    render(<AIProfileTab {...props} />);

    expect(screen.getByText('AI キャラクター設定')).toBeInTheDocument();

    // Find AI section
    const aiSection = screen.getByText('AI キャラクター設定').closest('div')!;
    const q = within(aiSection);

    expect(q.getByLabelText('名前')).toBeInTheDocument();
    expect(q.getByLabelText('種族')).toBeInTheDocument();
    expect(q.getByLabelText('性別')).toBeInTheDocument();
    expect(q.getByLabelText('性格')).toBeInTheDocument();
    expect(q.getByLabelText('口調')).toBeInTheDocument();
    expect(q.getByLabelText('一人称')).toBeInTheDocument();
    expect(q.getByLabelText('趣味')).toBeInTheDocument();
  });

  it('renders all User profile fields', () => {
    render(<AIProfileTab {...props} />);

    expect(screen.getByText('ユーザー設定 (あなたについて)')).toBeInTheDocument();

    // Find User section
    const userSection = screen.getByText('ユーザー設定 (あなたについて)').closest('div')!;
    const q = within(userSection);

    expect(q.getByLabelText('あなたの名前')).toBeInTheDocument();
    expect(q.getByLabelText('AIからの呼び方')).toBeInTheDocument();
    expect(q.getByLabelText('性別')).toBeInTheDocument();
    expect(q.getByLabelText('対話モード')).toBeInTheDocument();
  });

  it('renders knowledge base section', () => {
    render(<AIProfileTab {...props} />);
    expect(screen.getByText('追加知識 / シチュエーション')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('例: A.K.I.の中足はガードさせて有利')).toBeInTheDocument();
  });

  it('calls updateNested when AI profile fields change', () => {
    render(<AIProfileTab {...props} />);

    const aiSection = screen.getByText('AI キャラクター設定').closest('div')!;
    const nameInput = within(aiSection).getByLabelText('名前');
    fireEvent.change(nameInput, { target: { value: 'NewName' } });
    expect(mockUpdateNested).toHaveBeenCalledWith('ai_profile', 'name', 'NewName');

    const speciesInput = within(aiSection).getByLabelText('種族');
    fireEvent.change(speciesInput, { target: { value: 'Robot' } });
    expect(mockUpdateNested).toHaveBeenCalledWith('ai_profile', 'species', 'Robot');
  });

  it('calls updateNested when User profile fields change', () => {
    render(<AIProfileTab {...props} />);

    const userSection = screen.getByText('ユーザー設定 (あなたについて)').closest('div')!;
    const userNameInput = within(userSection).getByLabelText('あなたの名前');
    fireEvent.change(userNameInput, { target: { value: 'NewUser' } });
    expect(mockUpdateNested).toHaveBeenCalledWith('user_profile', 'name', 'NewUser');

    const modeSelect = within(userSection).getByLabelText('対話モード');
    fireEvent.change(modeSelect, { target: { value: 'conversation' } });
    expect(mockUpdateNested).toHaveBeenCalledWith('user_profile', 'mode', 'conversation');
  });

  it('calls updateRoot when knowledge changes', () => {
    render(<AIProfileTab {...props} />);

    const knowledgeArea = screen.getByPlaceholderText('例: A.K.I.の中足はガードさせて有利');
    fireEvent.change(knowledgeArea, { target: { value: 'New Knowledge' } });
    expect(mockUpdateRoot).toHaveBeenCalledWith('knowledge', 'New Knowledge');
  });
});
