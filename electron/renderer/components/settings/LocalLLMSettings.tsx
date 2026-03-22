import React from 'react';
import { InputSetting } from './controls/InputSetting';
import { SelectSetting } from './controls/SelectSetting';
import { ModelDownloaderUI, useModelDownloader } from './controls/ModelDownloader';

const MODEL_PRESETS = [
  { label: 'Gemma 2 9B (MLX)', value: 'mlx-community/gemma-2-9b-it-4bit' },
  { label: 'Qwen3.5 9B (MLX)', value: 'mlx-community/Qwen3.5-9B-MLX-4bit' },
  { label: 'Qwen3.5 4B (MLX) - 軽量', value: 'mlx-community/Qwen3.5-4B-MLX-4bit' },
] as const;

interface LocalLLMSettingsProps {
  settings: any;
  defaultSettings: any;
  updateProvider: (category: 'llm' | 'stt' | 'tts', provider: string, key: string, value: any) => void;
  port: number;
}

export const LocalLLMSettings: React.FC<LocalLLMSettingsProps> = ({
  settings,
  defaultSettings,
  updateProvider,
  port
}) => {
  const localModelName = settings.llm?.providers?.local?.model || 'mlx-community/gemma-2-9b-it-4bit';
  const downloader = useModelDownloader(localModelName, port);
  const [profileList, setProfileList] = React.useState<any[]>([]);
  const [newProfileName, setNewProfileName] = React.useState('');
  const activeAdapterPath = settings.llm?.providers?.local?.adapter_path || '';

  // Weights state: { [name: string]: { weight: number, isMain: boolean } }
  const [blendWeights, setBlendWeights] = React.useState<Record<string, { weight: number, isMain: boolean }>>({});
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
      const cleanup = window.electronAPI.onProfilesUpdated(() => {
        fetchProfiles();
      });
      return cleanup;
    }
  }, [fetchProfiles]);

  // Load current blending config if available in settings (optional future persist)
  // For now, we'll derive it from what's folder-named in activeAdapterPath if it's not fused
  React.useEffect(() => {
    if (profileList.length > 0 && Object.keys(blendWeights).length === 0) {
      const initial: Record<string, any> = {};
      profileList.forEach(p => {
        const name = typeof p === 'string' ? p : p.name;
        // If it's currently applied as a single adapter, set to 1.0
        const isCurrentlySingle = activeAdapterPath.includes(`/${name}`) || activeAdapterPath.endsWith(name);
        initial[name] = { weight: isCurrentlySingle ? 1.0 : 0, isMain: isCurrentlySingle };
      });
      setBlendWeights(initial);
    }
  }, [profileList, activeAdapterPath]);

  const handleApplyBlends = async () => {
    setIsApplying(true);
    try {
      const activeProfiles = Object.entries(blendWeights)
        .filter(([_, cfg]) => cfg.weight > 0)
        .map(([name, cfg]) => ({ name, weight: cfg.weight, is_main: cfg.isMain }));

      const res = await fetch(`http://127.0.0.1:${port}/training/apply-profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profiles: activeProfiles })
      });
      const data = await res.json();
      if (data.status === 'success') {
        updateProvider('llm', 'local', 'adapter_path', data.adapter_path);
      } else {
        alert(`適用に失敗したよ: ${data.detail || 'Unknown error'}`);
      }
    } catch (e) {
      console.error('Apply blends failed:', e);
      alert('適用中にエラーが発生しちゃった。');
    } finally {
      setIsApplying(false);
    }
  };

  const updateWeight = (name: string, weight: number) => {
    setBlendWeights(prev => ({
      ...prev,
      [name]: { ...prev[name], weight }
    }));
  };

  const toggleMain = (name: string) => {
    setBlendWeights(prev => {
      const newWeights = { ...prev };
      // Only one main allowed
      Object.keys(newWeights).forEach(k => {
        newWeights[k] = { ...newWeights[k], isMain: k === name ? !prev[k].isMain : false };
      });
      return newWeights;
    });
  };

  const handleImportProfile = async () => {
    try {
      // Use electron's directory picker
      const sourcePath = await window.electronAPI.selectDirectory();
      if (!sourcePath) return;

      const defaultName = sourcePath.split(/[\\/]/).pop() || 'imported_profile';
      const name = window.prompt('プロファイル名を入力してください', defaultName);
      if (!name) return;

      const res = await fetch(`http://127.0.0.1:${port}/training/profiles/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_path: sourcePath, name })
      });
      
      if (res.ok) {
        fetchProfiles();
      } else {
        const data = await res.json();
        alert(`インポートに失敗したよ: ${data.detail}`);
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
        body: JSON.stringify({ profile_name: profileName, destination_path: destPath })
      });

      if (res.ok) {
        alert(`${profileName} をエクスポートしたよ！`);
      } else {
        const data = await res.json();
        alert(`エクスポートに失敗したよ: ${data.detail}`);
      }
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const totalIntensityRaw = Object.values(blendWeights).reduce((sum, cfg) => sum + cfg.weight, 0);

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
      alert(`削除に失敗しました: ${e}`);
    }
  };

  return (
    <div className="local-llm-settings">
      <div style={{ marginBottom: '20px' }}>
        <ModelDownloaderUI
          status={downloader.modelStatus}
          progress={downloader.progress}
          progressDetail={downloader.progressDetail}
          errorMsg={downloader.errorMsg}
          onDownload={downloader.handleDownload}
          notCachedDescription="ローカルでの推論にはモデルのダウンロードが必要です（約6GB）。安定したネット環境で実行してください。"
        />
      </div>

      <div className="setting-card">
        <h3 className="setting-card-title">Local Brain (MLX) の詳細設定</h3>

        <SelectSetting
          label="1. 使用するモデル"
          description="ローカル推論に使用するモデルを選択してください。LoRAプロファイルは選択したモデルと互換性があるものだけ表示されます。"
          value={settings.llm?.providers?.local?.model ?? MODEL_PRESETS[0].value}
          options={MODEL_PRESETS.map(p => ({ value: p.value, label: p.label }))}
          onChange={(val) => {
            updateProvider('llm', 'local', 'model', val);
            updateProvider('llm', 'local', 'adapter_path', '');
            setBlendWeights({});
          }}
        />

        <div className="setting-form-row">
          <div style={{ flex: 1 }}>
            <InputSetting
              label="生成時のランダム性 (Temperature)"
              description="0.0で安定、高いほど独創的になります。"
              type="number"
              step="0.1"
              defaultValue={defaultSettings?.llm?.providers?.local?.temperature}
              value={settings.llm?.providers?.local?.temperature}
              onChange={(val) => updateProvider('llm', 'local', 'temperature', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="最大出力トークン数 (Max Tokens)"
              description="一度の返答で生成する最大文字数。150〜300程度を推奨。"
              type="number"
              step="1"
              defaultValue={defaultSettings?.llm?.providers?.local?.max_tokens}
              value={settings.llm?.providers?.local?.max_tokens}
              onChange={(val) => updateProvider('llm', 'local', 'max_tokens', val)}
            />
          </div>
        </div>

        <div style={{ marginTop: '10px' }}>
          <button 
            className="btn btn-secondary btn-small"
            onClick={handleImportProfile}
            style={{ width: '100%', padding: '5px', fontSize: '11px', background: '#333' }}
          >
            🔗 外部プロンプトセットを取り込む
          </button>
        </div>
      </div>

      <div className="setting-card" style={{ border: '1px solid #61dafb33' }}>
        <h3 className="setting-card-title">📖 追加学習 (LoRA) プロファイル</h3>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '15px' }}>
          性格や知識を強化した「特訓済みモデル」を管理します。
        </p>

        <div className="lora-profile-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {profileList.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#555', background: '#00000033', borderRadius: '8px' }}>
              プロファイルがありません。「新規作成」から始めましょう。
            </div>
          )}
          {profileList.filter(p => {
            const base = typeof p === 'string' ? null : p.base_model;
            // Show profiles with no adapter yet (not yet trained) or trained on current model
            return base == null || base === localModelName;
          }).map(p => {
            const name = typeof p === 'string' ? p : p.name;
            const statusMessage = typeof p === 'string' ? 'データなし' : p.status_message;
            const needsTrain = typeof p === 'string' ? false : p.needs_train;

            const cfg = blendWeights[name] || { weight: 0, isMain: false };
            const canApply = statusMessage !== 'データなし' && statusMessage !== '未学習';

            return (
              <div key={name} className="lora-profile-item" style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '12px 15px',
                background: '#1a1a1a',
                borderRadius: '8px',
                border: cfg.weight > 0 ? '1px solid #61dafb' : '1px solid #333',
                opacity: canApply ? 1 : 0.6
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <button
                    onClick={() => canApply && toggleMain(name)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: canApply ? 'pointer' : 'default',
                      fontSize: '18px',
                      color: cfg.isMain ? '#ffcc00' : '#444',
                      padding: 0
                    }}
                    title={cfg.isMain ? 'メイン性格' : 'メインに設定'}
                  >
                    {cfg.isMain ? '⭐' : '☆'}
                  </button>
                  <span style={{ flex: 1, fontWeight: 600, color: cfg.weight > 0 ? '#61dafb' : '#eee' }}>{name}</span>
                  <span style={{
                    fontSize: '10px',
                    color: needsTrain ? '#ffcc00' : '#888',
                    border: needsTrain ? '1px solid #ffcc0066' : '1px solid #444',
                    padding: '1px 5px',
                    borderRadius: '4px'
                  }}>
                    {statusMessage}
                  </span>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => window.electronAPI.openTrainingWindow(name)}
                      style={{ padding: '2px 8px' }}
                    >
                      📝
                    </button>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => handleExportProfile(name)}
                        title="エクスポート"
                        style={{ padding: '2px 8px', fontSize: '10px' }}
                      >
                        📤
                      </button>
                      <button
                        className="btn btn-danger btn-small"
                        onClick={() => handleDeleteProfile(name)}
                        title="削除"
                        style={{ padding: '2px 8px', fontSize: '10px' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    disabled={!canApply}
                    value={cfg.weight}
                    onChange={(e) => updateWeight(name, parseFloat(e.target.value))}
                    style={{ flex: 1, height: '4px', cursor: canApply ? 'pointer' : 'default' }}
                  />
                  <span style={{ fontSize: '12px', color: '#61dafb', minWidth: '35px', textAlign: 'right', fontWeight: 'bold' }}>
                    {Math.round(cfg.weight * 100)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {profileList.length > 0 && (
          <div style={{ marginTop: '20px', padding: '15px', background: '#00000055', borderRadius: '8px', border: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#eee' }}>ブレンド強度 (Total Intensity)</span>
              <span style={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: totalIntensityRaw <= 1.0 ? '#61dafb' : totalIntensityRaw <= 1.5 ? '#ffcc00' : '#ff4444'
              }}>
                {Math.round(totalIntensityRaw * 100)}%
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#222', borderRadius: '4px', overflow: 'hidden', marginBottom: '15px' }}>
              <div style={{
                width: `${Math.min(100, (totalIntensityRaw / 2.0) * 100)}%`,
                height: '100%',
                background: totalIntensityRaw <= 1.0 ? '#61dafb' : totalIntensityRaw <= 1.5 ? '#ffcc00' : '#ff4444',
                transition: 'width 0.3s ease, background-color 0.3s ease'
              }} />
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px', fontSize: '14px', fontWeight: 'bold' }}
              disabled={isApplying}
              onClick={handleApplyBlends}
            >
              {isApplying ? '適用中...' : '🚀 ブレンド内容を適用する'}
            </button>
            <p style={{ fontSize: '11px', color: '#666', marginTop: '10px', textAlign: 'center' }}>
              ※ 合計が120%を超えると「スマート・オートバランス」が働き、比率を保ったまま自動調整されます。
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
          <input
            type="text"
            className="settings-input"
            style={{ flex: 1, marginBottom: 0 }}
            placeholder="新規プロファイル名"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={!newProfileName.trim()}
            onClick={async () => {
              const name = newProfileName.trim();
              try {
                // Initialize in backend so it shows up in list
                await fetch(`http://127.0.0.1:${port}/training/profiles/init?profile=${encodeURIComponent(name)}`, { method: 'POST' });
                if (window.electronAPI.broadcastProfilesUpdated) {
                  window.electronAPI.broadcastProfilesUpdated();
                }
                setTimeout(() => window.electronAPI.openTrainingWindow(name), 100);
                setNewProfileName('');
              } catch (e) {
                console.error('Failed to init profile:', e);
                window.electronAPI.openTrainingWindow(name);
              }
            }}
          >
            ➕ 作成
          </button>
        </div>
      </div>
    </div>
  );
};
