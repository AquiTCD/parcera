import React, { useState } from 'react';
import { KnowledgePreset, ParceraSettings } from '../../../shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';

interface KnowledgePresetsCardProps {
  settings: ParceraSettings;
  updateRoot: (key: keyof ParceraSettings, value: unknown) => void;
}

const CUSTOM_VALUE = '__custom__';

function generatePresetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Renders the "追加知識・シチュエーション" card with preset switching and management.
 */
export const KnowledgePresetsCard: React.FC<KnowledgePresetsCardProps> = ({
  settings,
  updateRoot,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const presets: KnowledgePreset[] = settings.knowledge_presets ?? [];
  const activeId = settings.active_knowledge_preset_id ?? '';
  const activePreset = presets.find((p) => p.id === activeId);
  const currentKnowledge = settings.knowledge ?? '';

  const handleSelectPreset = (value: string) => {
    if (value === CUSTOM_VALUE) {
      updateRoot('active_knowledge_preset_id', '');
      return;
    }
    const target = presets.find((p) => p.id === value);
    if (!target) return;
    updateRoot('active_knowledge_preset_id', target.id);
    updateRoot('knowledge', target.content);
  };

  const handleSaveNew = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const newId = generatePresetId();
    const nextPresets: KnowledgePreset[] = [
      ...presets,
      { id: newId, title: trimmed, content: currentKnowledge },
    ];
    updateRoot('knowledge_presets', nextPresets);
    updateRoot('active_knowledge_preset_id', newId);
    setNewTitle('');
  };

  const handleOverwriteActive = () => {
    if (!activePreset) return;
    const nextPresets = presets.map((p) =>
      p.id === activePreset.id ? { ...p, content: currentKnowledge } : p
    );
    updateRoot('knowledge_presets', nextPresets);
  };

  const handleDeleteActive = () => {
    if (!activePreset) return;
    const nextPresets = presets.filter((p) => p.id !== activePreset.id);
    updateRoot('knowledge_presets', nextPresets);
    updateRoot('active_knowledge_preset_id', '');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>追加知識・シチュエーション</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          AIが知っておくべき背景情報や攻略情報、現在のシチュエーションを記述します。
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[180px] flex-1">
            <Select
              value={activePreset ? activePreset.id : CUSTOM_VALUE}
              onValueChange={handleSelectPreset}
            >
              <SelectTrigger aria-label="知識プリセット">
                <SelectValue placeholder="プリセットを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CUSTOM_VALUE}>（未選択 / カスタム）</SelectItem>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {activePreset && (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={handleOverwriteActive}>
                上書き保存
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={handleDeleteActive}>
                削除
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="プリセット名（例: スト6配信）"
            className="h-8 text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!newTitle.trim()}
            onClick={handleSaveNew}
          >
            新規保存
          </Button>
        </div>

        <Textarea
          value={currentKnowledge}
          onChange={(e) => updateRoot('knowledge', e.target.value)}
          placeholder="例: A.K.I.の中足はガードさせて有利"
          className="min-h-[120px]"
        />
      </CardContent>
    </Card>
  );
};
