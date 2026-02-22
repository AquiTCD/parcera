import React from 'react';
import { TabProps, inputStyle } from './types';
import { SettingGroup } from './controls/SettingGroup';
import { CheckboxSetting } from './controls/CheckboxSetting';
import { InputSetting } from './controls/InputSetting';
import { WindowSettingsSection } from './WindowSettingsSection';

export const VisualTab: React.FC<TabProps> = ({ settings, updateNested, renderTabHeader, handleSelectDir }) => {
  return (
    <section className="animate-fade-in">
      {renderTabHeader?.('アバター設定')}

      <div style={{ display: 'flex', gap: '20px', flexDirection: 'column' }}>
        <SettingGroup label="アバター画像・透過設定">
          <div style={{ display: 'flex', gap: '15px' }}>
            {/* USER Avatar Column */}
            <div style={{ flex: 1, background: '#2d2d30', padding: '15px', borderRadius: '8px' }}>
              <InputSetting
                label="USERアバター パス"
                placeholder="/assets/user"
                value={settings.avatars?.user?.assets_dir ?? ''}
                onChange={(val: string) => updateNested('avatars', 'user', { ...settings.avatars?.user, assets_dir: val })}
              />
              <button
                onClick={() => handleSelectDir?.('user')}
                style={{ marginTop: '5px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer', marginBottom: '15px' }}
              >
                📁 フォルダ選択
              </button>

              <div style={{ borderTop: '1px solid #444', paddingTop: '15px' }}>
                <CheckboxSetting
                  label="背景透過 (クロマキー)"
                  checked={settings.avatars?.user?.chroma_key_enabled ?? false}
                  onChange={(checked: boolean) => updateNested('avatars', 'user', { ...settings.avatars?.user, chroma_key_enabled: checked })}
                />
                <select
                  value={settings.avatars?.user?.chroma_key_color ?? 'green'}
                  onChange={(e) => updateNested('avatars', 'user', { ...settings.avatars?.user, chroma_key_color: e.target.value })}
                  style={{ ...inputStyle, marginTop: '10px' }}
                  disabled={!settings.avatars?.user?.chroma_key_enabled}
                >
                  <option value="green">グリーンバック</option>
                  <option value="blue">ブルーバック</option>
                </select>
              </div>
            </div>

            {/* AI Avatar Column */}
            <div style={{ flex: 1, background: '#2d2d30', padding: '15px', borderRadius: '8px' }}>
              <InputSetting
                label="AIアバター パス"
                placeholder="/assets/ai"
                value={settings.avatars?.ai?.assets_dir ?? ''}
                onChange={(val: string) => updateNested('avatars', 'ai', { ...settings.avatars?.ai, assets_dir: val })}
              />
              <button
                onClick={() => handleSelectDir?.('ai')}
                style={{ marginTop: '5px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer', marginBottom: '15px' }}
              >
                📁 フォルダ選択
              </button>

              <div style={{ borderTop: '1px solid #444', paddingTop: '15px' }}>
                <CheckboxSetting
                  label="背景透過 (クロマキー)"
                  checked={settings.avatars?.ai?.chroma_key_enabled ?? false}
                  onChange={(checked: boolean) => updateNested('avatars', 'ai', { ...settings.avatars?.ai, chroma_key_enabled: checked })}
                />
                <select
                  value={settings.avatars?.ai?.chroma_key_color ?? 'green'}
                  onChange={(e) => updateNested('avatars', 'ai', { ...settings.avatars?.ai, chroma_key_color: e.target.value })}
                  style={{ ...inputStyle, marginTop: '10px' }}
                  disabled={!settings.avatars?.ai?.chroma_key_enabled}
                >
                  <option value="green">グリーンバック</option>
                  <option value="blue">ブルーバック</option>
                </select>
              </div>
            </div>
          </div>
        </SettingGroup>

        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
          <WindowSettingsSection
            type="user"
            settings={settings}
            updateNested={updateNested}
          />
          <WindowSettingsSection
            type="ai"
            settings={settings}
            updateNested={updateNested}
          />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: '20px' }}>
        <CheckboxSetting
          label="デバッグ情報を表示する (ピークメーター、状態テキスト)"
          checked={settings.avatars?.show_debug ?? true}
          onChange={(checked: boolean) => updateNested('avatars', 'show_debug', checked)}
        />
      </div>

      <SettingGroup label="呼吸アニメーション設定">
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="呼吸のスケーリング幅"
              type="number"
              placeholder="1.01"
              value={settings.avatars?.breathe_scale ?? ''}
              onChange={(val: number) => updateNested('avatars', 'breathe_scale', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="呼吸の上下動幅 (px)"
              type="number"
              placeholder="5"
              value={settings.avatars?.breathe_amplitude ?? ''}
              onChange={(val: number) => updateNested('avatars', 'breathe_amplitude', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="呼吸の周期基準 (ms)"
              type="number"
              placeholder="4000"
              value={settings.avatars?.breathe_duration ?? ''}
              onChange={(val: number) => updateNested('avatars', 'breathe_duration', val)}
            />
          </div>
        </div>
      </SettingGroup>
    </section>
  );
};
