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
          label="LoRAアダプタ パス (オプション)"
          description="学習済みのアダプタを適用する場合、絶対パスを入力してください。"
          placeholder="/path/to/adapter"
          value={settings.llm?.providers?.local?.adapter_path ?? ''}
          onChange={(val) => updateProvider('llm', 'local', 'adapter_path', val)}
        />
      </div>
    </div>
  );
};
