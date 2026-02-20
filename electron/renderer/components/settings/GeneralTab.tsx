import React from 'react';
import { TabProps, inputStyle } from './types';

export const GeneralTab: React.FC<TabProps> = ({ settings, updateRoot, renderTabHeader }) => {
  return (
    <section className="animate-fade-in">
      {renderTabHeader?.('一般 (General)')}

      <div className="form-group" style={{ marginBottom: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.verbose ?? false}
            onChange={(e) => updateRoot('verbose', e.target.checked)}
            style={{ marginRight: '10px' }}
          />
          詳細ログを出力する (Verbose)
        </label>
      </div>

      <div className="form-group" style={{ marginBottom: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.profile_mode ?? false}
            onChange={(e) => updateRoot('profile_mode', e.target.checked)}
            style={{ marginRight: '10px' }}
          />
          パフォーマンス計測ログを出力する (Profile Mode)
        </label>
      </div>

      <div className="form-group" style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>ログレベル</label>
        <select
          value={settings.log_level ?? 'INFO'}
          onChange={(e) => updateRoot('log_level', e.target.value)}
          style={inputStyle}
        >
          <option value="DEBUG">DEBUG</option>
          <option value="INFO">INFO</option>
          <option value="WARNING">WARNING</option>
          <option value="ERROR">ERROR</option>
        </select>
      </div>
    </section>
  );
};
