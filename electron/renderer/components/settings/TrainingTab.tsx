import React, { useState, useEffect, useCallback } from 'react';
import type { TrainingPair, ParceraSettings } from '../../../shared/types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Card, CardContent } from '../ui/card';
import { cn } from '../../lib/utils';

interface TrainingTabProps {
  settings: ParceraSettings;
  profile?: string;
}

type SubTab = 'knowledge' | 'edit' | 'adapters';

interface TrainingStats {
  total: number;
  trainable: number;
  pending: number;
  last_trained_at: string | null;
  needs_train: boolean;
  status_message: string;
  is_training: boolean;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
  ok: 'success',
  correction: 'warning',
  ng: 'destructive',
  ignored: 'secondary',
  pending: 'secondary',
};

export const TrainingTab: React.FC<TrainingTabProps> = ({ settings, profile: initialProfile = 'default' }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('knowledge');
  const [currentProfile, setCurrentProfile] = useState(initialProfile);
  const [pairs, setPairs] = useState<TrainingPair[]>([]);
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [trainingStatus, setTrainingStatus] = useState<any>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempProfileName, setTempProfileName] = useState('');
  const [lastActionTime, setLastActionTime] = useState(0);

  const port = settings.electron?.port || 8676;
  const baseUrl = `http://127.0.0.1:${port}/training`;

  const fetchProfiles = useCallback(async () => {}, []);

  const fetchPairs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${baseUrl}/pairs?profile=${currentProfile}`);
      const data = await res.json();
      setPairs(data);
      const statsRes = await fetch(`${baseUrl}/stats?profile=${currentProfile}`);
      const statsData = await statsRes.json();
      setStats(statsData);
      fetchProfiles();
    } catch (e) {
      console.error('Failed to fetch data:', e);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, currentProfile, fetchProfiles]);

  useEffect(() => { fetchPairs(); }, [fetchPairs]);

  useEffect(() => {
    if (window.electronAPI.onTrainingProfileChanged) {
      return window.electronAPI.onTrainingProfileChanged((profile: string) => {
        setCurrentProfile(profile);
      });
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const checkStatus = async () => {
      try {
        const res = await fetch(`${baseUrl}/status?profile=${currentProfile}`);
        const data = await res.json();
        setTrainingStatus(data);
        if (data.status === 'running' || data.status === 'starting') {
          timer = setTimeout(checkStatus, 3000);
        } else if (data.status === 'completed' || data.status === 'failed') {
          fetchPairs();
        }
      } catch (e) {
        console.error('Failed to fetch training status:', e);
      }
    };
    checkStatus();
    return () => clearTimeout(timer);
  }, [baseUrl, currentProfile, lastActionTime, fetchPairs]);

  const handleAddKnowledge = async () => {
    if (!input.trim()) return;
    setIsGenerating(true);
    try {
      const isUrl = input.trim().startsWith('http');
      const body = isUrl
        ? { url: input.trim(), profile: currentProfile }
        : { text: input.trim(), profile: currentProfile };
      const res = await fetch(`${baseUrl}/add-knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setInput('');
        await fetchPairs();
        setActiveSubTab('edit');
      } else {
        const err = await res.json();
        alert(`エラー: ${err.detail}`);
      }
    } catch (e) {
      alert(`通信エラー: ${e}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: TrainingPair['status'], editedOutput?: string) => {
    try {
      await fetch(`${baseUrl}/pairs/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, edited_output: editedOutput }),
      });
      await fetchPairs();
      setEditingId(null);
    } catch (e) {
      console.error('Failed to update status:', e);
    }
  };

  const startEditing = (pair: TrainingPair) => {
    setEditingId(pair.id);
    setEditValue(pair.edited_output || pair.output);
  };

  const handleRunTraining = async () => {
    if (!currentProfile) return;
    const ok = window.confirm(
      `現在のプロファイル「${currentProfile}」で追加学習を開始しますか？\n\n` +
      `※学習中はリソース確保のため、パルセラの反応（音声・返答）は一時的に停止（ミュート）されます。\n` +
      `※完了後、自動的に復帰します。`
    );
    if (!ok) return;
    try {
      const res = await fetch(`${baseUrl}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: currentProfile, iters: 100 }),
      });
      await res.json();
      setLastActionTime(Date.now());
    } catch (e) {
      alert(`エラー: ${e}`);
    }
  };

  const handleRenameProfile = async () => {
    if (!currentProfile || !tempProfileName.trim() || tempProfileName.trim() === currentProfile) {
      setIsRenaming(false);
      return;
    }
    try {
      const res = await fetch(
        `${baseUrl}/rename-profile?old_name=${encodeURIComponent(currentProfile)}&new_name=${encodeURIComponent(tempProfileName.trim())}`,
        { method: 'POST' }
      );
      if (res.ok) {
        setCurrentProfile(tempProfileName.trim());
        if (window.electronAPI.broadcastProfilesUpdated) {
          window.electronAPI.broadcastProfilesUpdated();
        }
      } else {
        alert('名前の変更に失敗しました。');
      }
    } catch (e) {
      console.error('Rename failed:', e);
      alert('エラーが発生しました。');
    } finally {
      setIsRenaming(false);
    }
  };

  const STEPS: { id: SubTab; label: string; step: string }[] = [
    { id: 'knowledge', step: 'STEP 1', label: '知識の入力' },
    { id: 'edit', step: 'STEP 2', label: 'データの編集' },
    { id: 'adapters', step: 'STEP 3', label: '学習の実行' },
  ];

  const renderNotebookEntry = (pair: TrainingPair) => {
    const isEditing = editingId === pair.id;
    return (
      <Card key={pair.id} className="mb-2">
        <CardContent className="pt-3 pb-2 px-3 space-y-2">
          <div className="text-xs text-muted-foreground">
            <span className="mr-1">👤</span>{pair.input}
          </div>
          <div className="text-sm">
            <span className="mr-1 text-muted-foreground">💙</span>
            {isEditing ? (
              <div className="space-y-2 mt-1">
                <Textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="text-sm min-h-[80px]"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleUpdateStatus(pair.id, 'correction', editValue)}>保存</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>取消</Button>
                </div>
              </div>
            ) : (
              <span className="text-sm">{pair.edited_output || pair.output}</span>
            )}
          </div>
          <div className="flex items-center justify-between pt-1">
            <Badge variant={STATUS_VARIANT[pair.status] ?? 'secondary'}>{pair.status}</Badge>
            <div className="flex gap-1">
              <button title="OK" className="text-base hover:scale-110 transition-transform" onClick={() => handleUpdateStatus(pair.id, 'ok')}>✅</button>
              <button title="修正" className="text-base hover:scale-110 transition-transform" onClick={() => startEditing(pair)}>📝</button>
              <button title="除外" className="text-base hover:scale-110 transition-transform" onClick={() => handleUpdateStatus(pair.id, 'ng')}>❌</button>
              <button title="保持" className="text-base hover:scale-110 transition-transform" onClick={() => handleUpdateStatus(pair.id, 'ignored')}>➖</button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const isTrainingActive = trainingStatus?.status === 'running' || trainingStatus?.status === 'starting';
  const hasTrainableData = pairs.some((p) => p.status === 'ok' || p.status === 'correction');

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap pb-3 border-b border-border">
        <span className="text-sm text-muted-foreground">プロファイル:</span>
        {isRenaming ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              className="h-7 w-32 text-sm px-2"
              value={tempProfileName}
              onChange={(e) => setTempProfileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameProfile();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
            />
            <Button size="sm" className="h-7 text-xs px-2" onClick={handleRenameProfile}>保存</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-semibold">{currentProfile}</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2"
              onClick={() => { setTempProfileName(currentProfile); setIsRenaming(true); }}
            >
              名前を変更
            </Button>
          </div>
        )}
        <div className="flex-1" />
        {stats && (
          <span className={cn('text-sm', stats.needs_train ? 'text-yellow-500' : 'text-muted-foreground')}>
            OK {stats.trainable} / 全 {stats.total} 件 [{stats.status_message}]
          </span>
        )}
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4 min-h-[420px]">
        {/* Step sidebar */}
        <nav className="w-[140px] shrink-0 flex flex-col gap-0.5">
          {STEPS.map(({ id, step, label }) => (
            <button
              key={id}
              onClick={() => setActiveSubTab(id)}
              className={cn(
                'w-full text-left px-3 py-2.5 transition-colors border-l-2',
                activeSubTab === id
                  ? 'rounded-r-md border-primary bg-primary/20'
                  : 'rounded-md border-transparent hover:bg-accent'
              )}
            >
              <div className={cn('text-[10px] font-semibold uppercase tracking-wider mb-0.5', activeSubTab === id ? 'text-primary' : 'text-muted-foreground/60')}>
                {step}
              </div>
              <div className={cn('text-sm font-medium', activeSubTab === id ? 'text-primary' : 'text-muted-foreground')}>
                {label}
                {id === 'adapters' && stats?.needs_train && (
                  <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 align-middle" />
                )}
              </div>
            </button>
          ))}
        </nav>

        {/* Main content */}
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          <p className="text-sm text-muted-foreground">
            {activeSubTab === 'knowledge' && '新しい知識をテキストまたはURLから入力し、学習用データを生成します。'}
            {activeSubTab === 'edit' && '生成されたデータを編集・確認します。「OK」または「修正」済みのデータが学習に使用されます。'}
            {activeSubTab === 'adapters' && '準備されたデータを元に、AIモデルの追加学習（LoRA）を実行します。'}
          </p>

          {activeSubTab === 'knowledge' && (
            <div className="space-y-2">
              <Textarea
                placeholder="新しい知識やウェブサイトのURLを入力してください..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isGenerating}
                className="min-h-[200px] text-sm resize-none"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleAddKnowledge}
                  disabled={isGenerating || !input.trim()}
                >
                  {isGenerating ? 'AIが解析中...' : 'データを解析して追加'}
                </Button>
              </div>
            </div>
          )}

          {activeSubTab === 'adapters' && (
            <div className="space-y-4">
              {stats?.needs_train ? (
                <div className="rounded-md bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-sm text-yellow-500">
                  未学習のデータが <strong>{stats.trainable}件</strong> あります。学習を開始してモデルに反映しましょう。
                </div>
              ) : (
                <div className="rounded-md bg-green-700/10 border border-green-700/30 px-3 py-2 text-sm text-green-500">
                  すべての有効なデータは学習済みです。
                </div>
              )}

              {trainingStatus && ['running', 'starting', 'completed', 'failed'].includes(trainingStatus.status) && (
                <Card>
                  <CardContent className="pt-4 pb-3 px-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {trainingStatus.status === 'starting' && '処理準備中...'}
                        {trainingStatus.status === 'running' && '追加学習を実行中'}
                        {trainingStatus.status === 'completed' && '学習が正常に完了しました'}
                        {trainingStatus.status === 'failed' && 'エラーが発生しました'}
                      </span>
                      <span className="text-sm tabular-nums">{trainingStatus.progress}%</span>
                    </div>
                    <Progress value={trainingStatus.progress} className="h-2" />
                    {isTrainingActive && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Iteration: {trainingStatus.current_iter} / {trainingStatus.total_iters}</span>
                        <span>Loss: {trainingStatus.loss?.toFixed(4) || '---'}</span>
                      </div>
                    )}
                    {trainingStatus.status === 'running' && (
                      <p className="text-xs text-yellow-500">⚡️ 学習中：パルセラは一時的にオフラインになります</p>
                    )}
                    {trainingStatus.status === 'completed' && (
                      <p className="text-xs text-green-500">学習が正常に完了しました！LLM設定で該当プロファイルを選択し直してください。</p>
                    )}
                    {trainingStatus.error && (
                      <p className="text-xs text-destructive"><strong>エラー詳細:</strong> {trainingStatus.error}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex flex-col items-center gap-2 pt-2">
                <Button
                  className="w-full"
                  onClick={handleRunTraining}
                  disabled={!hasTrainableData || isTrainingActive}
                >
                  {isTrainingActive ? '⚡️ 学習を実行しています...' : '追加学習を開始する'}
                </Button>
                {!hasTrainableData && (
                  <p className="text-xs text-destructive">※学習可能なデータ（OK/修正済み）が1つ以上必要です。</p>
                )}
              </div>
            </div>
          )}

          {activeSubTab !== 'adapters' && (
            <div className="flex-1 overflow-y-auto space-y-2">
              {loading && <p className="text-sm text-muted-foreground text-center py-4">データを読み込み中...</p>}
              {!loading && pairs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  データが登録されていません。Step 1 で知識を入力してください。
                </p>
              )}
              {pairs.map(renderNotebookEntry)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
