import React from 'react';
import useSWR from 'swr';
import { TabProps } from './types';
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
  const apiKey = (settings.llm?.providers as any)?.[currentLLMProvider]?.api_key;

  const { data: models, error, isValidating: isFetchingModels, mutate: retryModels } = useSWR(
    apiKey && (currentLLMProvider === 'gemini' || currentLLMProvider === 'openai') ? ['models', currentLLMProvider, apiKey] : null,
    async ([_, provider, key]) => {
      if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (!res.ok) throw new Error('API要求に失敗しました。キーを確認してください');
        const data = await res.json();
        return data.models.map((m: any) => m.name.replace('models/', ''));
      } else {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` }
        });
        if (!res.ok) throw new Error('API要求に失敗しました。キーを確認してください');
        const data = await res.json();
        return data.data.map((m: any) => m.id);
      }
    },
    { revalidateOnFocus: false, errorRetryCount: 1 }
  );

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
    <section className="animate-fade-in">
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

      <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>{currentLLMProvider} の設定</h3>
        <PasswordSetting
          label="1. APIキー (必須)"
          placeholder="API Key"
          value={(settings.llm?.providers as any)?.[currentLLMProvider]?.api_key ?? ''}
          onChange={(val) => updateProvider('llm', currentLLMProvider, 'api_key', val)}
          buttonAction={
            <button
              onClick={handleFetchModels}
              style={{ padding: '6px 12px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
              disabled={isFetchingModels}
            >
              APIキーを使ってモデル一覧を取得する
            </button>
          }
        />

        <SelectSetting
          label="2. 使用するモデル"
          value={(settings.llm?.providers as any)?.[currentLLMProvider]?.model ?? ''}
          onChange={(val) => updateProvider('llm', currentLLMProvider, 'model', val)}
          disabled={isFetchingModels || !models || models.length === 0}
          options={isFetchingModels ? [{ value: '', label: 'モデル一覧を取得中...' }] : (models && models.length > 0 ? [
            { value: '', label: '-- 指定なし (デフォルト) --' },
            ...models.map((m: string) => ({ value: m, label: m }))
          ] : [{ value: '', label: '(取得失敗: APIキーを確認してください)' }])}
        />

        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="表現のランダム性 (Temperature)"
              description="0.0で安定、高いほど独創的になります。"
              type="number"
              step="0.1"
              defaultValue={(defaultSettings?.llm?.providers as any)?.[currentLLMProvider]?.temperature}
              value={(settings.llm?.providers as any)?.[currentLLMProvider]?.temperature}
              onChange={(val) => updateProvider('llm', currentLLMProvider, 'temperature', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="文章の分割文字数 (ストリーミング)"
              description="TTSへの受け渡しをスムーズにするための分割。10〜20文字程度を推奨。"
              type="number"
              step="1"
              defaultValue={(defaultSettings?.llm?.providers as any)?.[currentLLMProvider]?.option_split_threshold}
              value={(settings.llm?.providers as any)?.[currentLLMProvider]?.option_split_threshold}
              onChange={(val) => updateProvider('llm', currentLLMProvider, 'option_split_threshold', val)}
            />
          </div>
        </div>

        <CheckboxSetting
          label="前回の会話内容を記憶し続ける"
          description="有効にすると、セッションを越えて記憶を保持します（長期間の運用でコストや精度に影響する場合があります）。"
          defaultValue={(defaultSettings?.llm?.providers as any)?.[currentLLMProvider]?.persist_history}
          checked={(settings.llm?.providers as any)?.[currentLLMProvider]?.persist_history}
          onChange={(checked) => updateProvider('llm', currentLLMProvider, 'persist_history', checked)}
        />
      </div>
    </section>
  );
};
