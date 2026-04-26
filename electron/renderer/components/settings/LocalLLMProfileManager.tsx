import React from 'react';
import type { ParceraSettings } from '../../../shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Slider } from '../ui/slider';

type StatusMessage = { message: string; type: 'success' | 'error' | '' };

interface Profile {
  name: string;
  status_message: string;
  needs_train: boolean;
  base_model: string | null;
}

interface BlendConfig {
  weight: number;
  isMain: boolean;
}

interface Props {
  settings: ParceraSettings;
  updateProvider: (category: 'llm' | 'stt' | 'tts', provider: string, key: string, value: unknown) => void;
  port: number;
  setStatus?: (status: StatusMessage) => void;
}

export const LocalLLMProfileManager: React.FC<Props> = ({ settings, updateProvider, port, setStatus }) => {
  const localModelName = settings.llm?.providers?.local?.model || 'mlx-community/gemma-2-9b-it-4bit';
  const activeAdapterPath = settings.llm?.providers?.local?.adapter_path || '';

  const [profileList, setProfileList] = React.useState<Profile[]>([]);
  const [blendWeights, setBlendWeights] = React.useState<Record<string, BlendConfig>>({});
  const [newProfileName, setNewProfileName] = React.useState('');
  const [isApplying, setIsApplying] = React.useState(false);

  const fetchProfiles = React.useCallback(async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/training/profiles`);
      const data = await res.json();
      setProfileList(data || []);
    } catch (e) {
      console.error('Failed to fetch profiles:', e);
    }
  }, [port]);

  React.useEffect(() => {
    fetchProfiles();
    if (window.electronAPI.onProfilesUpdated) {
      return window.electronAPI.onProfilesUpdated(() => fetchProfiles());
    }
  }, [fetchProfiles]);

  React.useEffect(() => {
    if (profileList.length > 0 && Object.keys(blendWeights).length === 0) {
      const initial: Record<string, BlendConfig> = {};
      profileList.forEach(p => {
        const isCurrentlySingle = activeAdapterPath.includes(`/${p.name}`) || activeAdapterPath.endsWith(p.name);
        initial[p.name] = { weight: isCurrentlySingle ? 1.0 : 0, isMain: isCurrentlySingle };
      });
      setBlendWeights(initial);
    }
  }, [profileList, activeAdapterPath]);

  const updateWeight = (name: string, weight: number) =>
    setBlendWeights(prev => ({ ...prev, [name]: { ...prev[name], weight } }));

  const toggleMain = (name: string) =>
    setBlendWeights(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        next[k] = { ...next[k], isMain: k === name ? !prev[k].isMain : false };
      });
      return next;
    });

  const handleApplyBlends = async () => {
    setIsApplying(true);
    try {
      const activeProfiles = Object.entries(blendWeights)
        .filter(([_, cfg]) => cfg.weight > 0)
        .map(([name, cfg]) => ({ name, weight: cfg.weight, is_main: cfg.isMain }));

      const res = await fetch(`http://127.0.0.1:${port}/training/apply-profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profiles: activeProfiles }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        updateProvider('llm', 'local', 'adapter_path', data.adapter_path);
        setStatus?.({ message: 'ブレンドを適用しました', type: 'success' });
      } else {
        setStatus?.({ message: `適用に失敗しました: ${data.detail || 'Unknown error'}`, type: 'error' });
      }
    } catch {
      setStatus?.({ message: '適用中にエラーが発生しました', type: 'error' });
    } finally {
      setIsApplying(false);
    }
  };

  const handleImportProfile = async () => {
    try {
      const sourcePath = await window.electronAPI.selectDirectory();
      if (!sourcePath) return;
      const defaultName = sourcePath.split(/[\\/]/).pop() || 'imported_profile';
      const name = window.prompt('プロファイル名を入力してください', defaultName);
      if (!name) return;
      const res = await fetch(`http://127.0.0.1:${port}/training/profiles/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_path: sourcePath, name }),
      });
      if (res.ok) {
        fetchProfiles();
        setStatus?.({ message: 'プロファイルをインポートしました', type: 'success' });
      } else {
        const data = await res.json();
        setStatus?.({ message: `インポートに失敗しました: ${data.detail}`, type: 'error' });
      }
    } catch (e) {
      console.error('Import failed:', e);
    }
  };

  const handleExportProfile = async (profileName: string) => {
    try {
      const destPath = await window.electronAPI.selectDirectory();
      if (!destPath) return;
      const res = await fetch(`http://127.0.0.1:${port}/training/profiles/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_name: profileName, destination_path: destPath }),
      });
      if (res.ok) {
        setStatus?.({ message: `${profileName} をエクスポートしました`, type: 'success' });
      } else {
        const data = await res.json();
        setStatus?.({ message: `エクスポートに失敗しました: ${data.detail}`, type: 'error' });
      }
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const handleDeleteProfile = async (name: string) => {
    if (!window.confirm(`プロファイル「${name}」と学習データを削除しますか？\nこの操作は取り消せません。`)) return;
    try {
      await fetch(`http://127.0.0.1:${port}/training/profiles/${name}`, { method: 'DELETE' });
      fetchProfiles();
      if (window.electronAPI.broadcastProfilesUpdated) {
        window.electronAPI.broadcastProfilesUpdated();
      }
      if (activeAdapterPath.endsWith(name)) {
        updateProvider('llm', 'local', 'adapter_path', '');
      }
    } catch (e) {
      setStatus?.({ message: `削除に失敗しました: ${e}`, type: 'error' });
    }
  };

  const handleCreateProfile = async () => {
    const name = newProfileName.trim();
    if (!name) return;
    try {
      await fetch(`http://127.0.0.1:${port}/training/profiles/init?profile=${encodeURIComponent(name)}`, { method: 'POST' });
      if (window.electronAPI.broadcastProfilesUpdated) {
        window.electronAPI.broadcastProfilesUpdated();
      }
      setTimeout(() => window.electronAPI.openTrainingWindow(name), 100);
      setNewProfileName('');
    } catch {
      window.electronAPI.openTrainingWindow(name);
    }
  };

  const visibleProfiles = profileList.filter(p => p.base_model == null || p.base_model === localModelName);
  const totalIntensity = Object.values(blendWeights).reduce((sum, cfg) => sum + cfg.weight, 0);
  const intensityColor = totalIntensity <= 1.0 ? 'text-blue-400' : totalIntensity <= 1.5 ? 'text-yellow-400' : 'text-red-400';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>LoRA プロファイル管理</CardTitle>
          <Button variant="outline" size="sm" onClick={handleImportProfile}>
            外部から取り込む
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          学習済みプロファイルを選択・ブレンドして適用します。学習の実行は「追加学習」セクションから行ってください。
        </p>
      </CardHeader>
      <CardContent className="space-y-4">

        {visibleProfiles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            プロファイルがありません。「新規作成」から始めましょう。
          </p>
        ) : (
          <div className="space-y-2">
            {visibleProfiles.map(p => {
              const cfg = blendWeights[p.name] || { weight: 0, isMain: false };
              const canApply = p.status_message !== 'データなし' && p.status_message !== '未学習';
              return (
                <div
                  key={p.name}
                  className={`rounded-lg border p-3 space-y-2 transition-colors ${cfg.weight > 0 ? 'border-primary/60 bg-primary/5' : 'border-border'} ${!canApply ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => canApply && toggleMain(p.name)}
                      className="text-lg leading-none"
                      title={cfg.isMain ? 'メイン性格' : 'メインに設定'}
                    >
                      {cfg.isMain ? '⭐' : '☆'}
                    </button>
                    <span className={`flex-1 text-sm font-medium ${cfg.weight > 0 ? 'text-primary' : ''}`}>
                      {p.name}
                    </span>
                    <Badge variant={p.needs_train ? 'warning' : 'secondary'} className="text-xs">
                      {p.status_message}
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => window.electronAPI.openTrainingWindow(p.name)} title="学習ウィンドウを開く">
                      📝
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleExportProfile(p.name)} title="エクスポート">
                      📤
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteProfile(p.name)} title="削除">
                      🗑️
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    <Slider
                      value={[cfg.weight]}
                      min={0}
                      max={1}
                      step={0.1}
                      disabled={!canApply}
                      onValueChange={([val]) => updateWeight(p.name, val)}
                      className="flex-1"
                    />
                    <span className="text-xs tabular-nums w-10 text-right font-semibold text-muted-foreground">
                      {Math.round(cfg.weight * 100)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {visibleProfiles.length > 0 && (
          <div className="rounded-lg border border-border bg-card/50 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">ブレンド強度合計</span>
              <span className={`text-sm font-bold tabular-nums ${intensityColor}`}>
                {Math.round(totalIntensity * 100)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${totalIntensity <= 1.0 ? 'bg-primary' : totalIntensity <= 1.5 ? 'bg-yellow-400' : 'bg-red-400'}`}
                style={{ width: `${Math.min(100, (totalIntensity / 2.0) * 100)}%` }}
              />
            </div>
            <Button className="w-full" disabled={isApplying} onClick={handleApplyBlends}>
              {isApplying ? '適用中...' : 'ブレンド内容を適用する'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              合計が 120% を超えると自動バランス調整が働きます
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-border">
          <Input
            placeholder="新規プロファイル名"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateProfile()}
          />
          <Button variant="outline" disabled={!newProfileName.trim()} onClick={handleCreateProfile}>
            作成
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
