import React from 'react';
import { ParceraSettings } from '../../../shared/types';
import { CheckboxSetting } from './controls/CheckboxSetting';
import { InputSetting } from './controls/InputSetting';
import { SelectSetting } from './controls/SelectSetting';

interface WindowSettingsSectionProps {
  type: 'user' | 'ai';
  settings: ParceraSettings;
  defaultSettings?: ParceraSettings;
  updateNested: (category: keyof ParceraSettings, key: string, value: any) => void;
}

export const WindowSettingsSection: React.FC<WindowSettingsSectionProps> = ({ type, settings, defaultSettings, updateNested }) => {
  const winParams = settings.electron?.windows?.[type] || {};
  const defaultWinParams = defaultSettings?.electron?.windows?.[type] || {};
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
        label="常に最前面に表示する"
        defaultValue={defaultWinParams.alwaysOnTop}
        checked={winParams.alwaysOnTop}
        onChange={(checked: boolean) => updateWinParam('alwaysOnTop', checked)}
        labelStyle={{ fontSize: '13px' }}
      />

      <CheckboxSetting
        label="起動時にウィンドウ位置をロックする"
        defaultValue={defaultWinParams.locked}
        checked={winParams.locked}
        onChange={(checked: boolean) => updateWinParam('locked', checked)}
        labelStyle={{ fontSize: '13px' }}
      />

      <div style={{ marginTop: '12px', marginBottom: '12px' }}>
        <button
          onClick={async () => {
            const bounds = await (window as any).electronAPI.getAvatarWindowBounds(type);
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
            defaultValue={defaultWinParams.x}
            value={winParams.x}
            onChange={(val: number) => updateWinParam('x', val)}
            labelStyle={{ fontSize: '12px' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <InputSetting
            label="Y座標"
            type="number"
            defaultValue={defaultWinParams.y}
            value={winParams.y}
            onChange={(val: number) => updateWinParam('y', val)}
            labelStyle={{ fontSize: '12px' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <InputSetting
            label="幅"
            type="number"
            defaultValue={defaultWinParams.width}
            value={winParams.width}
            onChange={(val: number) => updateWinParam('width', val)}
            labelStyle={{ fontSize: '12px' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <InputSetting
            label="高さ"
            type="number"
            defaultValue={defaultWinParams.height}
            value={winParams.height}
            onChange={(val: number) => updateWinParam('height', val)}
            labelStyle={{ fontSize: '12px' }}
          />
        </div>
      </div>

      <SelectSetting
        label="操作ボタンの表示位置"
        value={winParams.control_corner ?? defaultWinParams.control_corner ?? 'bottom-right'}
        onChange={(val) => updateWinParam('control_corner', val)}
        options={[
          { value: 'top-left', label: '左上' },
          { value: 'top-right', label: '右上' },
          { value: 'bottom-left', label: '左下' },
          { value: 'bottom-right', label: '右下' }
        ]}
        labelStyle={{ fontSize: '12px', color: '#ccc' }}
      />
    </div>
  );
};
