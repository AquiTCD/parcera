import React, { useEffect, useRef, useState } from 'react';
import { KnowledgePreset, ParceraSettings } from '../../../shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';

interface KnowledgePresetsCardProps {
  settings: ParceraSettings;
  updateRoot: (key: keyof ParceraSettings, value: unknown) => void;
  setStatus?: (status: { message: string; type: '' | 'error' | 'success' }) => void;
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
  setStatus,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const presets: KnowledgePreset[] = settings.knowledge_presets ?? [];
  const activeId = settings.active_knowledge_preset_id ?? '';
  const activePreset = presets.find((p) => p.id === activeId);
  const currentKnowledge = settings.knowledge ?? '';
  const isDirty = Boolean(activePreset && currentKnowledge !== activePreset.content);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const notifyFeedback = (message: string) => {
    setFeedback(message);
    setStatus?.({ message, type: 'success' });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFeedback(null), 3000);
  };

  const handleSelectPreset = (value: string) => {
    if (value === CUSTOM_VALUE) {
      updateRoot('active_knowledge_preset_id', '');
      setFeedback(null);
      return;
    }
    const target = presets.find((p) => p.id === value);
    if (!target) return;
    updateRoot('active_knowledge_preset_id', target.id);
    updateRoot('knowledge', target.content);
    notifyFeedback(`✓ 「${target.title}」を読み込みました`);
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
    notifyFeedback(`✓ 「${trimmed}」を作成しました`);
  };

  const handleOverwriteActive = () => {
    if (!activePreset || !isDirty) return;
    const nextPresets = presets.map((p) =>
      p.id === activePreset.id ? { ...p, content: currentKnowledge } : p
    );
    updateRoot('knowledge_presets', nextPresets);
    notifyFeedback(`✓ 「${activePreset.title}」に上書きしました`);
  };

  const handleDeleteActive = () => {
    if (!activePreset) return;
    const deletedTitle = activePreset.title;
    const nextPresets = presets.filter((p) => p.id !== activePreset.id);
    updateRoot('knowledge_presets', nextPresets);
    updateRoot('active_knowledge_preset_id', '');
    notifyFeedback(`✓ 「${deletedTitle}」を削除しました`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>追加知識・シチュエーション</CardTitle>
          {isDirty && (
            <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-500">
              未保存の変更あり
            </span>
          )}
        </div>
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
              <Button
                type="button"
                variant={isDirty ? 'default' : 'secondary'}
                size="sm"
                disabled={!isDirty}
                onClick={handleOverwriteActive}
              >
                {activePreset.title} に上書き
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
            placeholder="プリセット名を入力（例: 雑談配信 / ゲーム攻略）"
            className="h-8 text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!newTitle.trim()}
            onClick={handleSaveNew}
          >
            現在の内容で新規作成
          </Button>
        </div>

        {feedback && (
          <p className="text-xs font-medium text-emerald-500" role="status">
            {feedback}
          </p>
        )}

        <Textarea
          value={currentKnowledge}
          onChange={(e) => updateRoot('knowledge', e.target.value)}
          placeholder="例: 今日の配信テーマや、AIに覚えておいてほしいルール・攻略メモなど"
          className="min-h-[120px]"
        />
      </CardContent>
    </Card>
  );
};
