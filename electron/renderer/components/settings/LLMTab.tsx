import React from 'react';
import { TabProps, inputStyle } from './types';
import { SettingGroup, CheckboxSetting, InputSetting, PasswordSetting } from './FormControls';

export const LLMTab: React.FC<TabProps> = ({
  settings,
  updateNested,
  updateProvider,
  setStatus,
  renderTabHeader,
  showApiKeysState,
  isFetchingLLM,
  llmModels,
  handleFetchLLMModels
}) => {
  const currentLLMProvider = settings.llm?.provider || 'gemini';

  return (
    <section className="animate-fade-in">
      {renderTabHeader?.('頭脳・思考 (LLM)')}

      <SettingGroup label="使用するプロバイダ">
        <select
          value={settings.llm?.provider ?? 'gemini'}
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
          showPasswordState={showApiKeysState!}
          buttonAction={
            <button
              onClick={handleFetchLLMModels}
              style={{ padding: '6px 12px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
              disabled={isFetchingLLM}
            >
              {isFetchingLLM ? '取得中...' : 'APIキーを使ってモデル一覧を取得する'}
            </button>
          }
        />

        <SettingGroup label="2. モデル名">
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
                {llmModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </>
            ) : (
              <option value="">(取得失敗: APIキーを確認してください)</option>
            )}
          </select>
        </SettingGroup>

        <InputSetting
          label="温度 (Temperature) 0.0〜1.0"
          type="number"
          step="0.1"
          placeholder="0.7"
          value={(settings.llm?.providers as any)?.[currentLLMProvider]?.temperature ?? 0.7}
          onChange={(val) => updateProvider('llm', currentLLMProvider, 'temperature', val)}
        />

        <SettingGroup label="ストリーミング時の文分割文字数">
          <input
            type="number"
            placeholder="15"
            value={(settings.llm?.providers as any)?.[currentLLMProvider]?.option_split_threshold ?? 15}
            onChange={(e) => updateProvider('llm', currentLLMProvider, 'option_split_threshold', Number(e.target.value))}
            style={inputStyle}
          />
          <small style={{ color: '#888' }}>音声合成を早く開始するためのチャンク分割の目安</small>
        </SettingGroup>

        <CheckboxSetting
          label="会話履歴を保存する (SQLite)"
          checked={(settings.llm?.providers as any)?.[currentLLMProvider]?.persist_history ?? false}
          onChange={(checked) => updateProvider('llm', currentLLMProvider, 'persist_history', checked)}
        />
      </div>
    </section>
  );
};
