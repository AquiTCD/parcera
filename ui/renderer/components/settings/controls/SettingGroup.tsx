import React from 'react';

export const SettingGroup: React.FC<{
  label: string;
  description?: string;
  children: React.ReactNode;
  labelStyle?: React.CSSProperties;
  contentId?: string;
}> = ({ label, description, children, labelStyle, contentId }) => (
  <div className="form-group" style={{ marginBottom: '14px' }}>
    <label
      htmlFor={contentId}
      className="setting-group-label"
      style={labelStyle}
    >
      {label}
    </label>
    {description && (
      <small className="setting-group-description">
        {description}
      </small>
    )}
    <div>
      {children}
    </div>
  </div>
);
