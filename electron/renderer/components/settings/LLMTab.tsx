import React from 'react';
import { TabProps } from './types';
import { useLLMModels } from '../../hooks/useLLMModels';
import { CheckboxSetting } from './controls/CheckboxSetting';
import { InputSetting } from './controls/InputSetting';
import { PasswordSetting } from './controls/PasswordSetting';
import { SelectSetting } from './controls/SelectSetting';

export const LLMTab: React.FC<TabProps> = ({
  settings,
  defaultSettings,
  updateNested,
  updateProvider,
  setStatus,
  renderTabHeader
}) => {
  const currentLLMProvider = settings.llm?.provider || 'gemini';
  const apiKey = settings.llm?.providers?.[currentLLMProvider]?.api_key;

  const { models, error, isFetchingModels, retryModels } = useLLMModels(currentLLMProvider, apiKey);

  React.useEffect(() => {
    if (error) {
      setStatus({ message: `モデル取得エラー: ${error.message}`, type: 'error' });
    }
  }, [error, setStatus]);

  const handleFetchModels = () => {
    if (!apiKey) {
      setStatus({ message: 'APIキーを入力してから、モデル一覧を取得してください。', type: 'error' });
      return;
    }
    retryModels();
  };

  return (
    <section className="tab-content-section">
      {renderTabHeader?.('対話エンジン（脳）')}

      <SelectSetting
        label="使用するプロバイダ"
        value={settings.llm?.provider ?? defaultSettings?.llm?.provider ?? 'gemini'}
        onChange={(val) => updateNested('llm', 'provider', val)}
        options={[
          { value: 'gemini', label: 'Google Gemini (推奨)' },
          { value: 'openai', label: 'OpenAI (GPT-4o等)' }
        ]}
      />

      <div className="setting-card">
        <h3 className="setting-card-title">{currentLLMProvider} の設定</h3>
        <PasswordSetting
          label="1. APIキー (必須)"
          placeholder="API Key"
          value={settings.llm?.providers?.[currentLLMProvider]?.api_key ?? ''}
          onChange={(val) => updateProvider('llm', currentLLMProvider, 'api_key', val)}
          buttonAction={
            <button
              onClick={handleFetchModels}
              className="btn btn-outline"
              disabled={isFetchingModels}
            >
              APIキーを使ってモデル一覧を取得する
            </button>
          }
        />

        <SelectSetting
          label="2. 使用するモデル"
          value={settings.llm?.providers?.[currentLLMProvider]?.model ?? ''}
          onChange={(val) => updateProvider('llm', currentLLMProvider, 'model', val)}
          disabled={isFetchingModels || !models || models.length === 0}
          options={isFetchingModels ? [{ value: '', label: 'モデル一覧を取得中...' }] : (models && models.length > 0 ? [
            { value: '', label: '-- 指定なし (デフォルト) --' },
            ...models.map((m: string) => ({ value: m, label: m }))
          ] : [{ value: '', label: '(取得失敗: APIキーを確認してください)' }])}
        />

        <div className="setting-form-row">
          <div style={{ flex: 1 }}>
            <InputSetting
              label="表現のランダム性 (Temperature)"
              description="0.0で安定、高いほど独創的になります。"
              type="number"
              step="0.1"
              defaultValue={defaultSettings?.llm?.providers?.[currentLLMProvider]?.temperature}
              value={settings.llm?.providers?.[currentLLMProvider]?.temperature}
              onChange={(val) => updateProvider('llm', currentLLMProvider, 'temperature', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="文章の分割文字数 (ストリーミング)"
              description="TTSへの受け渡しをスムーズにするための分割。10〜20文字程度を推奨。"
              type="number"
              step="1"
              defaultValue={defaultSettings?.llm?.providers?.[currentLLMProvider]?.option_split_threshold}
              value={settings.llm?.providers?.[currentLLMProvider]?.option_split_threshold}
              onChange={(val) => updateProvider('llm', currentLLMProvider, 'option_split_threshold', val)}
            />
          </div>
        </div>

        <CheckboxSetting
          label="前回の会話内容を記憶し続ける"
          description="有効にすると、セッションを越えて記憶を保持します（長期間の運用でコストや精度に影響する場合があります）。"
          defaultValue={defaultSettings?.llm?.providers?.[currentLLMProvider]?.persist_history}
          checked={settings.llm?.providers?.[currentLLMProvider]?.persist_history}
          onChange={(checked) => updateProvider('llm', currentLLMProvider, 'persist_history', checked)}
        />
      </div>
    </section>
  );
};
