import React from 'react';
import { InputSetting } from './controls/InputSetting';
import { ModelDownloaderUI, useModelDownloader } from './controls/ModelDownloader';

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

  const handleApplyProfile = (name: string, shouldApply: boolean) => {
    if (shouldApply) {
      fetch(`http://127.0.0.1:${port}/training/adapter-path?profile=${encodeURIComponent(name)}`)
        .then(res => res.json())
        .then(data => {
          if (data.adapter_path) {
            updateProvider('llm', 'local', 'adapter_path', data.adapter_path);
          }
        })
        .catch(err => console.error('Apply failed:', err));
    } else {
      updateProvider('llm', 'local', 'adapter_path', '');
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

        <InputSetting
          label="1. 使用するモデル (HuggingFace Repo)"
          description="mlx-community/ から始まるリポジトリ名を指定してください。"
          placeholder="mlx-community/gemma-2-9b-it-4bit"
          value={settings.llm?.providers?.local?.model ?? ''}
          onChange={(val) => updateProvider('llm', 'local', 'model', val)}
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

        <InputSetting
          label="LoRAアダプタ パス (手動指定)"
          description="通常は以下のプロファイル一覧から選択してください。"
          placeholder="/path/to/adapter"
          value={activeAdapterPath}
          onChange={(val) => updateProvider('llm', 'local', 'adapter_path', val)}
        />
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
          {profileList.map(p => {
            const name = p.name;
            const isApplied = activeAdapterPath.includes(`/${name}`) || activeAdapterPath.endsWith(name);
            const canApply = p.status_message !== 'データなし' && p.status_message !== '未学習';

            return (
              <div key={name} className="lora-profile-item" style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 15px',
                background: '#1a1a1a',
                borderRadius: '8px',
                border: isApplied ? '1px solid #61dafb' : '1px solid #333'
              }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    className={`btn btn-small ${isApplied ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ minWidth: '60px', fontSize: '11px', padding: '4px 8px' }}
                    onClick={() => handleApplyProfile(name, !isApplied)}
                    title={!canApply ? 'まず特訓を完了させる必要があります' : ''}
                  >
                    {isApplied ? '適用解除' : '適用する'}
                  </button>
                  <span style={{ fontWeight: 600, color: isApplied ? '#61dafb' : '#eee' }}>{name}</span>
                  <span style={{
                    fontSize: '10px',
                    color: p.needs_train ? '#ffcc00' : '#888',
                    border: p.needs_train ? '1px solid #ffcc0066' : '1px solid #444',
                    padding: '1px 5px',
                    borderRadius: '4px'
                  }}>
                    {p.status_message}
                  </span>
                  {isApplied && <span style={{ fontSize: '10px', background: '#61dafb', color: '#000', padding: '1px 5px', borderRadius: '4px' }}>適用中</span>}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => window.electronAPI.openTrainingWindow(name)}
                  >
                    📝 編集
                  </button>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => handleDeleteProfile(name)}
                    style={{ padding: '4px 8px' }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>

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
        <p style={{ fontSize: '10px', color: '#555', marginTop: '10px' }}>
          ※ アダプタの重ねがけは現在1つまでに制限されています。
        </p>
      </div>
    </div>
  );
};
