import React from 'react';
import { TabProps, inputStyle } from './types';

export const GeneralTab: React.FC<TabProps> = ({ settings, updateRoot, renderTabHeader }) => {
  return (
    <section className="animate-fade-in">
      {renderTabHeader?.('一般 (General)')}

      <div style={{ background: '#2d2d30', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>デバッグ・ログ設定</h3>

        <div className="form-group" style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>ログ出力レベル</label>
          <select
            value={settings.log_level ?? 'INFO'}
            onChange={(e) => updateRoot('log_level', e.target.value)}
            style={inputStyle}
          >
            <option value="INFO">INFO (基本のみ: 正常・エラー)</option>
            <option value="WARNING">WARNING (標準: INFO + 警告)</option>
            <option value="DEBUG">DEBUG (開発用: すべて出力)</option>
          </select>
          <p style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
            ※WARNING は INFOレベルも含んだ累積表示になります
          </p>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.profile_mode ?? false}
              onChange={(e) => updateRoot('profile_mode', e.target.checked)}
              style={{ marginRight: '10px' }}
            />
            パフォーマンス計測ログを表示 (Profile Mode)
          </label>
        </div>
      </div>
    </section>
  );
};
