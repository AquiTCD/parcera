import React from 'react';

export const SettingGroup: React.FC<{
  label: string;
  description?: string;
  children: React.ReactNode;
  labelStyle?: React.CSSProperties
}> = ({ label, description, children, labelStyle }) => (
  <div className="form-group" style={{ marginBottom: '15px' }}>
    <label style={{ display: 'block', marginBottom: description ? '2px' : '5px', ...labelStyle }}>
      {label}
    </label>
    {description && (
      <small style={{ display: 'block', color: '#888', marginBottom: '8px', fontSize: '12px', lineHeight: '1.4' }}>
        {description}
      </small>
    )}
    {children}
  </div>
);
