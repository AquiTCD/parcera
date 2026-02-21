import React from 'react';
import { TabProps, inputStyle } from './types';
import { SettingGroup } from './controls/SettingGroup';
import { CheckboxSetting } from './controls/CheckboxSetting';
import { InputSetting } from './controls/InputSetting';
import { WindowSettingsSection } from './WindowSettingsSection';

export const VisualTab: React.FC<TabProps> = ({ settings, updateNested, renderTabHeader, handleSelectDir }) => {
  return (
    <section className="animate-fade-in">
      {renderTabHeader?.('体・アバター (Visual)')}

      <div style={{ display: 'flex', gap: '20px', flexDirection: 'column' }}>
        <SettingGroup label="アバター画像ディレクトリ (Assets Path)">
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <div style={{ flex: 1 }}>
              <InputSetting
                label="USERアバター"
                placeholder="/assets/user"
                value={settings.avatars?.user?.assets_dir ?? ''}
                onChange={(val: string) => updateNested('avatars', 'user', { ...settings.avatars?.user, assets_dir: val })}
              />
              <button
                onClick={() => handleSelectDir?.('user')}
                style={{ marginTop: '5px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}
              >
                📁 フォルダ選択
              </button>
            </div>
            <div style={{ flex: 1 }}>
              <InputSetting
                label="AIアバター"
                placeholder="/assets/ai"
                value={settings.avatars?.ai?.assets_dir ?? ''}
                onChange={(val: string) => updateNested('avatars', 'ai', { ...settings.avatars?.ai, assets_dir: val })}
              />
              <button
                onClick={() => handleSelectDir?.('ai')}
                style={{ marginTop: '5px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}
              >
                📁 フォルダ選択
              </button>
            </div>
          </div>
        </SettingGroup>

        <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          <h3 style={{ marginTop: 0, fontSize: '16px' }}>背景透過 (Chroma Key)</h3>
          <CheckboxSetting
            label="背景透過フィルタを有効にする"
            checked={settings.chroma_key_enabled ?? true}
            onChange={(checked) => updateNested?.('chroma_key_enabled' as any, '', checked)}
          />
          <div style={{ marginTop: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>透過する色 (Target Color)</label>
            <select
              value={settings.chroma_key_color ?? 'green'}
              onChange={(e) => updateNested?.('chroma_key_color' as any, '', e.target.value)}
              style={inputStyle}
              disabled={!(settings.chroma_key_enabled ?? true)}
            >
              <option value="green">グリーンバック (#00FF00)</option>
              <option value="blue">ブルーバック (#0000FF)</option>
            </select>
          </div>
          <small style={{ color: '#888', display: 'block', marginTop: '5px' }}>
            ※画像に背景色が含まれている場合に自動で透過します。
          </small>
        </div>

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
          label="デバッグUIを表示する (VADバー、状態テキスト)"
          checked={settings.avatars?.show_debug ?? true}
          onChange={(checked: boolean) => updateNested('avatars', 'show_debug', checked)}
        />
      </div>

      <SettingGroup label="呼吸アニメーション設定 (Breathe)">
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="縮尺 (Scale)"
              type="number"
              placeholder="1.01"
              value={settings.avatars?.breathe_scale ?? ''}
              onChange={(val: number) => updateNested('avatars', 'breathe_scale', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="振幅 (Amplitude px)"
              type="number"
              placeholder="5"
              value={settings.avatars?.breathe_amplitude ?? ''}
              onChange={(val: number) => updateNested('avatars', 'breathe_amplitude', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="周期 (Duration ms)"
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
