import React from 'react';
import { ParceraSettings } from '../../../shared/types';
import { CheckboxSetting } from './controls/CheckboxSetting';
import { InputSetting } from './controls/InputSetting';
import { inputStyle } from './types';

interface WindowSettingsSectionProps {
  type: 'user' | 'ai';
  settings: ParceraSettings;
  updateNested: (category: keyof ParceraSettings, key: string, value: any) => void;
}

export const WindowSettingsSection: React.FC<WindowSettingsSectionProps> = ({ type, settings, updateNested }) => {
  const winParams = settings.electron?.windows?.[type] || {};
  const labelPrefix = type === 'user' ? 'USER' : 'AI';

  const updateWinParam = (key: string, value: any) => {
    updateNested('electron', 'windows', {
      ...settings.electron?.windows,
      [type]: { ...winParams, [key]: value }
    });
  };

  return (
    <div style={{ flex: 1, padding: '10px', background: '#333', borderRadius: '4px' }}>
      <h4 style={{ marginTop: 0, marginBottom: '15px', fontSize: '14px', color: '#61dafb' }}>
        {labelPrefix}ウィンドウ
      </h4>

      <CheckboxSetting
        label="最前面に表示する (Always on Top)"
        checked={winParams.alwaysOnTop ?? false}
        onChange={(checked: boolean) => updateWinParam('alwaysOnTop', checked)}
        labelStyle={{ fontSize: '13px' }}
      />

      <CheckboxSetting
        label="起動時にウィンドウ位置をロックする"
        checked={winParams.locked ?? false}
        onChange={(checked: boolean) => updateWinParam('locked', checked)}
        labelStyle={{ fontSize: '13px' }}
      />

      <div style={{ marginTop: '12px', marginBottom: '12px' }}>
        <button
          onClick={async () => {
            const bounds = await window.electronAPI.getAvatarWindowBounds(type);
            if (bounds) {
              updateNested('electron', 'windows', {
                ...settings.electron?.windows,
                [type]: {
                  ...winParams,
                  x: bounds.x,
                  y: bounds.y,
                  width: bounds.width,
                  height: bounds.height
                }
              });
            } else {
              alert(`${labelPrefix}ウィンドウが見つかりません`);
            }
          }}
          style={{
            padding: '6px 12px',
            background: '#3368ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            width: '100%'
          }}
        >
          📍 現在の{labelPrefix}ウィンドウの座標・サイズを取得
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <InputSetting
            label="X座標"
            type="number"
            value={winParams.x ?? ''}
            onChange={(val: number) => updateWinParam('x', val)}
            labelStyle={{ fontSize: '12px' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <InputSetting
            label="Y座標"
            type="number"
            value={winParams.y ?? ''}
            onChange={(val: number) => updateWinParam('y', val)}
            labelStyle={{ fontSize: '12px' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <InputSetting
            label="幅 (Width)"
            type="number"
            placeholder={type === 'user' ? '300' : '400'}
            value={winParams.width ?? ''}
            onChange={(val: number) => updateWinParam('width', val)}
            labelStyle={{ fontSize: '12px' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <InputSetting
            label="高さ (Height)"
            type="number"
            placeholder={type === 'user' ? '300' : '400'}
            value={winParams.height ?? ''}
            onChange={(val: number) => updateWinParam('height', val)}
            labelStyle={{ fontSize: '12px' }}
          />
        </div>
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#ccc' }}>
          コントロールボタン位置
        </label>
        <select
          value={winParams.control_corner ?? 'bottom-right'}
          onChange={(e) => updateWinParam('control_corner', e.target.value)}
          style={inputStyle}
        >
          <option value="top-left">左上</option>
          <option value="top-right">右上</option>
          <option value="bottom-left">左下</option>
          <option value="bottom-right">右下</option>
        </select>
      </div>
    </div>
  );
};
