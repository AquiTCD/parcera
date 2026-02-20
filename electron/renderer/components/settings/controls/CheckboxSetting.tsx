import React from 'react';

export const CheckboxSetting: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  style?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
}> = ({ label, checked, onChange, style, labelStyle }) => (
  <div className="form-group" style={{ marginBottom: '15px', ...style }}>
    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', ...labelStyle }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginRight: '10px' }}
      />
      {label}
    </label>
  </div>
);
