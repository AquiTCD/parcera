import React from 'react';
import { TabProps } from './types';
import { SettingGroup } from './controls/SettingGroup';
import { CheckboxSetting } from './controls/CheckboxSetting';
import { InputSetting } from './controls/InputSetting';
import { SelectSetting } from './controls/SelectSetting';
import { WindowSettingsSection } from './WindowSettingsSection';

export const VisualTab: React.FC<TabProps> = ({ settings, defaultSettings, updateNested, renderTabHeader, handleSelectDir }) => {
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
                defaultValue={defaultSettings?.avatars?.user?.assets_dir}
                value={settings.avatars?.user?.assets_dir}
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
                  label="左右反転する"
                  defaultValue={defaultSettings?.avatars?.user?.flip_horizontal}
                  checked={settings.avatars?.user?.flip_horizontal}
                  onChange={(checked: boolean) => updateNested('avatars', 'user', { ...settings.avatars?.user, flip_horizontal: checked })}
                  style={{ marginBottom: '10px' }}
                />
                <CheckboxSetting
                  label="背景透過 (クロマキー)"
                  defaultValue={defaultSettings?.avatars?.user?.chroma_key_enabled}
                  checked={settings.avatars?.user?.chroma_key_enabled}
                  onChange={(checked: boolean) => updateNested('avatars', 'user', { ...settings.avatars?.user, chroma_key_enabled: checked })}
                />
                <SelectSetting
                  label="クロマキー色"
                  value={settings.avatars?.user?.chroma_key_color ?? defaultSettings?.avatars?.user?.chroma_key_color ?? 'green'}
                  onChange={(val) => updateNested('avatars', 'user', { ...settings.avatars?.user, chroma_key_color: val })}
                  disabled={!settings.avatars?.user?.chroma_key_enabled}
                  options={[
                    { value: 'green', label: 'グリーンバック' },
                    { value: 'blue', label: 'ブルーバック' }
                  ]}
                  style={{ marginTop: '10px' }}
                />
              </div>
            </div>

            {/* AI Avatar Column */}
            <div style={{ flex: 1, background: '#2d2d30', padding: '15px', borderRadius: '8px' }}>
              <InputSetting
                label="AIアバター パス"
                defaultValue={defaultSettings?.avatars?.ai?.assets_dir}
                value={settings.avatars?.ai?.assets_dir}
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
                  label="左右反転する"
                  defaultValue={defaultSettings?.avatars?.ai?.flip_horizontal}
                  checked={settings.avatars?.ai?.flip_horizontal}
                  onChange={(checked: boolean) => updateNested('avatars', 'ai', { ...settings.avatars?.ai, flip_horizontal: checked })}
                  style={{ marginBottom: '10px' }}
                />
                <CheckboxSetting
                  label="背景透過 (クロマキー)"
                  defaultValue={defaultSettings?.avatars?.ai?.chroma_key_enabled}
                  checked={settings.avatars?.ai?.chroma_key_enabled}
                  onChange={(checked: boolean) => updateNested('avatars', 'ai', { ...settings.avatars?.ai, chroma_key_enabled: checked })}
                />
                <SelectSetting
                  label="クロマキー色"
                  value={settings.avatars?.ai?.chroma_key_color ?? defaultSettings?.avatars?.ai?.chroma_key_color ?? 'green'}
                  onChange={(val) => updateNested('avatars', 'ai', { ...settings.avatars?.ai, chroma_key_color: val })}
                  disabled={!settings.avatars?.ai?.chroma_key_enabled}
                  options={[
                    { value: 'green', label: 'グリーンバック' },
                    { value: 'blue', label: 'ブルーバック' }
                  ]}
                  style={{ marginTop: '10px' }}
                />
              </div>
            </div>
          </div>
        </SettingGroup>

        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
          <WindowSettingsSection
            type="user"
            settings={settings}
            defaultSettings={defaultSettings}
            updateNested={updateNested}
          />
          <WindowSettingsSection
            type="ai"
            settings={settings}
            defaultSettings={defaultSettings}
            updateNested={updateNested}
          />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: '20px' }}>
        <CheckboxSetting
          label="デバッグ情報を表示する (ピークメーター、状態テキスト)"
          defaultValue={defaultSettings?.avatars?.show_debug}
          checked={settings.avatars?.show_debug}
          onChange={(checked: boolean) => updateNested('avatars', 'show_debug', checked)}
        />
      </div>

      <SettingGroup label="呼吸アニメーション設定">
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="呼吸のスケーリング幅"
              type="number"
              defaultValue={defaultSettings?.avatars?.breathe_scale}
              value={settings.avatars?.breathe_scale}
              onChange={(val: number) => updateNested('avatars', 'breathe_scale', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="呼吸の上下動幅 (px)"
              type="number"
              defaultValue={defaultSettings?.avatars?.breathe_amplitude}
              value={settings.avatars?.breathe_amplitude}
              onChange={(val: number) => updateNested('avatars', 'breathe_amplitude', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="呼吸の周期基準 (ms)"
              type="number"
              defaultValue={defaultSettings?.avatars?.breathe_duration}
              value={settings.avatars?.breathe_duration}
              onChange={(val: number) => updateNested('avatars', 'breathe_duration', val)}
            />
          </div>
        </div>
      </SettingGroup>
    </section>
  );
};
