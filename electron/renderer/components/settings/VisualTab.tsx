import React from 'react';
import { TabProps, inputStyle } from './types';
import { SettingGroup } from './controls/SettingGroup';
import { CheckboxSetting } from './controls/CheckboxSetting';
import { InputSetting } from './controls/InputSetting';

export const VisualTab: React.FC<TabProps> = ({ settings, updateNested, renderTabHeader, handleSelectDir }) => {
  return (
    <section className="animate-fade-in">
      {renderTabHeader?.('体・アバター (Visual)')}

      <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>アバターパス＆ウィンドウ設定</h3>

        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>ユーザーアバターのパス</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              <input
                type="text"
                placeholder="/assets/user"
                value={(settings.avatars?.user as any)?.assets_dir ?? ''}
                onChange={(e) => updateNested('avatars', 'user', { ...(settings.avatars?.user as any), assets_dir: e.target.value })}
                style={inputStyle}
              />
              <button onClick={() => handleSelectDir?.('user')} style={{ padding: '0 15px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>...</button>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>AIアバターのパス</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              <input
                type="text"
                placeholder="/assets/ai"
                value={(settings.avatars?.ai as any)?.assets_dir ?? ''}
                onChange={(e) => updateNested('avatars', 'ai', { ...(settings.avatars?.ai as any), assets_dir: e.target.value })}
                style={inputStyle}
              />
              <button onClick={() => handleSelectDir?.('ai')} style={{ padding: '0 15px', background: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>...</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
          <div style={{ flex: 1, padding: '10px', background: '#333', borderRadius: '4px' }}>
            <h4 style={{ marginTop: 0, marginBottom: '15px', fontSize: '14px', color: '#61dafb' }}>AIウィンドウ</h4>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <InputSetting
                  label="幅"
                  type="number"
                  placeholder="400"
                  value={settings.electron?.windows?.ai?.width ?? ''}
                  onChange={(val) => {
                    const winParams = settings.electron?.windows?.ai || {};
                    updateNested('electron', 'windows', { ...settings.electron?.windows, ai: { ...winParams, width: val } });
                  }}
                  labelStyle={{ fontSize: '12px' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <InputSetting
                  label="高さ"
                  type="number"
                  placeholder="400"
                  value={settings.electron?.windows?.ai?.height ?? ''}
                  onChange={(val) => {
                    const winParams = settings.electron?.windows?.ai || {};
                    updateNested('electron', 'windows', { ...settings.electron?.windows, ai: { ...winParams, height: val } });
                  }}
                  labelStyle={{ fontSize: '12px' }}
                />
              </div>
            </div>
            <CheckboxSetting
              label="最前面に表示する (Always on Top)"
              checked={settings.electron?.windows?.ai?.alwaysOnTop ?? false}
              onChange={(checked) => {
                const winParams = settings.electron?.windows?.ai || {};
                updateNested('electron', 'windows', { ...settings.electron?.windows, ai: { ...winParams, alwaysOnTop: checked } });
              }}
              labelStyle={{ fontSize: '13px' }}
            />
          </div>

          <div style={{ flex: 1, padding: '10px', background: '#333', borderRadius: '4px' }}>
            <h4 style={{ marginTop: 0, marginBottom: '15px', fontSize: '14px', color: '#61dafb' }}>ユーザーウィンドウ</h4>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <InputSetting
                  label="幅"
                  type="number"
                  placeholder="300"
                  value={settings.electron?.windows?.user?.width ?? ''}
                  onChange={(val) => {
                    const winParams = settings.electron?.windows?.user || {};
                    updateNested('electron', 'windows', { ...settings.electron?.windows, user: { ...winParams, width: val } });
                  }}
                  labelStyle={{ fontSize: '12px' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <InputSetting
                  label="高さ"
                  type="number"
                  placeholder="300"
                  value={settings.electron?.windows?.user?.height ?? ''}
                  onChange={(val) => {
                    const winParams = settings.electron?.windows?.user || {};
                    updateNested('electron', 'windows', { ...settings.electron?.windows, user: { ...winParams, height: val } });
                  }}
                  labelStyle={{ fontSize: '12px' }}
                />
              </div>
            </div>
            <CheckboxSetting
              label="最前面に表示する (Always on Top)"
              checked={settings.electron?.windows?.user?.alwaysOnTop ?? false}
              onChange={(checked) => {
                const winParams = settings.electron?.windows?.user || {};
                updateNested('electron', 'windows', { ...settings.electron?.windows, user: { ...winParams, alwaysOnTop: checked } });
              }}
              labelStyle={{ fontSize: '13px' }}
            />
          </div>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: '20px' }}>
        <CheckboxSetting
          label="デバッグUIを表示する (VADバー、状態テキスト)"
          checked={settings.avatars?.show_debug ?? true}
          onChange={(checked) => updateNested('avatars', 'show_debug', checked)}
        />
      </div>

      <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>アニメーション設定</h3>

        <div className="form-group" style={{ marginBottom: '15px' }}>
          <InputSetting
            label="呼吸スケール (Breathe Scale)"
            type="number"
            step="0.001"
            placeholder="1.005"
            value={settings.avatars?.breathe_scale ?? 1.005}
            onChange={(val) => updateNested('avatars', 'breathe_scale', val)}
          />
          <small style={{ color: '#888' }}>1.0で呼吸拡大なし</small>
        </div>

        <InputSetting
          label="呼吸の縦揺れ (px)"
          type="number"
          step="1"
          placeholder="2"
          value={settings.avatars?.breathe_amplitude ?? 2}
          onChange={(val) => updateNested('avatars', 'breathe_amplitude', val)}
        />

        <InputSetting
          label="呼吸の周期 (ミリ秒)"
          type="number"
          step="100"
          placeholder="5000"
          value={settings.avatars?.breathe_duration ?? 5000}
          onChange={(val) => updateNested('avatars', 'breathe_duration', val)}
        />

        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="まばたき最短 (ms)"
              type="number"
              placeholder="5000"
              value={settings.avatars?.blink_interval_min ?? 5000}
              onChange={(val) => updateNested('avatars', 'blink_interval_min', val)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InputSetting
              label="まばたき最長 (ms)"
              type="number"
              placeholder="15000"
              value={settings.avatars?.blink_interval_max ?? 15000}
              onChange={(val) => updateNested('avatars', 'blink_interval_max', val)}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
