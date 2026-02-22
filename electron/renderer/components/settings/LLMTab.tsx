import React from 'react';
import { TabProps, inputStyle } from './types';
import { SettingGroup } from './controls/SettingGroup';
import { CheckboxSetting } from './controls/CheckboxSetting';
import { InputSetting } from './controls/InputSetting';
import { PasswordSetting } from './controls/PasswordSetting';
import useSWR from 'swr';

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
  const defaultProviderSettings = (defaultSettings?.llm?.providers as any)?.[currentLLMProvider];

  const { data: llmModels, error, isValidating: isFetchingLLM, mutate } = useSWR(
    apiKey ? ['llmModels', currentLLMProvider, apiKey] : null,
    async ([_, provider, key]) => {
      if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (!res.ok) throw new Error('API要求に失敗しました。キーを確認してください');
        const data = await res.json();
        if (!data.models) throw new Error('モデル一覧が取得できませんでした');
        return data.models.filter((m: any) => m.name.includes("gemini")).map((m: any) => m.name.replace("models/", ""));
      } else if (provider === 'openai') {
        const res = await fetch(`https://api.openai.com/v1/models`, { headers: { 'Authorization': `Bearer ${key}` } });
        if (!res.ok) throw new Error('API要求に失敗しました。キーを確認してください');
        const data = await res.json();
        if (!data.data) throw new Error('モデル一覧が取得できませんでした');
        return data.data.filter((m: any) => m.id.includes("gpt")).map((m: any) => m.id).reverse();
      }
      return [];
    },
    { revalidateOnFocus: false, errorRetryCount: 1 }
  );

  React.useEffect(() => {
    if (error) {
      setStatus({ message: `通信エラー: ${error.message}`, type: 'error' });
    }
  }, [error, setStatus]);

  const handleFetchClick = () => {
    if (!apiKey) {
      setStatus({ message: 'APIキーを入力してから、モデル一覧を取得してください。', type: 'error' });
      return;
    }
    mutate();
  };

  return (
    <section className="animate-fade-in">
      {renderTabHeader?.('思考・返答（頭脳）')}

      <SettingGroup label="使用するプロバイダ">
        <select
          value={settings.llm?.provider ?? defaultSettings?.llm?.provider ?? 'gemini'}
          onChange={(e) => updateNested('llm', 'provider', e.target.value)}
          style={inputStyle}
        >
          <option value="gemini">Google Gemini</option>
          <option value="openai">OpenAI</option>
        </select>
      </SettingGroup>

      <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>{currentLLMProvider} の設定</h3>

        <PasswordSetting
          label="1. APIキー (必須)"
          placeholder="API Key"
          value={(settings.llm?.providers as any)?.[currentLLMProvider]?.api_key ?? ''}
          onChange={(val) => updateProvider('llm', currentLLMProvider, 'api_key', val)}
          buttonAction={
            <button
              onClick={handleFetchClick}
              style={{ padding: '6px 12px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
              disabled={isFetchingLLM}
            >
              {isFetchingLLM ? '取得中...' : 'APIキーを使ってモデル一覧を取得する'}
            </button>
          }
        />

        <SettingGroup label="モデル名">
          <select
            value={(settings.llm?.providers as any)?.[currentLLMProvider]?.model ?? ''}
            onChange={(e) => updateProvider('llm', currentLLMProvider, 'model', e.target.value)}
            style={inputStyle}
            disabled={isFetchingLLM || !llmModels || llmModels.length === 0}
          >
            {isFetchingLLM ? (
              <option value="">モデル一覧を取得中...</option>
            ) : llmModels && llmModels.length > 0 ? (
              <>
                <option value="">-- 指定なし (デフォルト) --</option>
                {llmModels.map((m: string) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </>
            ) : (
              <option value="">(取得失敗: APIキーを確認してください)</option>
            )}
          </select>
        </SettingGroup>

        <InputSetting
          label="表現のランダム性 (Temperature)"
          description="0.0〜2.0で指定。0に近いほど事実に基づいた正確な回答に、1.0を超えると独創的で多様な表現になります。"
          type="number"
          step="0.1"
          defaultValue={defaultProviderSettings?.temperature}
          value={(settings.llm?.providers as any)?.[currentLLMProvider]?.temperature}
          onChange={(val) => updateProvider('llm', currentLLMProvider, 'temperature', val)}
        />

        <InputSetting
          label="文章の分割文字数 (ストリーミング)"
          description="音声合成を早く開始するための最小文字数の目安です。"
          type="number"
          defaultValue={defaultProviderSettings?.option_split_threshold}
          value={(settings.llm?.providers as any)?.[currentLLMProvider]?.option_split_threshold}
          onChange={(val) => updateProvider('llm', currentLLMProvider, 'option_split_threshold', val)}
        />

        <CheckboxSetting
          label="会話履歴を保存して記憶を保持する"
          description="会話履歴を保存して過去の記憶を保持します。※履歴が長くなると、消費トークン増大やレスポンス低下の原因になります。"
          defaultValue={defaultProviderSettings?.persist_history}
          checked={(settings.llm?.providers as any)?.[currentLLMProvider]?.persist_history}
          onChange={(checked) => updateProvider('llm', currentLLMProvider, 'persist_history', checked)}
        />
      </div>

    </section>
  );
};
