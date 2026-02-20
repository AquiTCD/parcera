import React from 'react';

export const SettingGroup: React.FC<{
  label: string;
  children: React.ReactNode;
  labelStyle?: React.CSSProperties
}> = ({ label, children, labelStyle }) => (
  <div className="form-group" style={{ marginBottom: '15px' }}>
    <label style={{ display: 'block', marginBottom: '5px', ...labelStyle }}>
      {label}
    </label>
    {children}
  </div>
);
