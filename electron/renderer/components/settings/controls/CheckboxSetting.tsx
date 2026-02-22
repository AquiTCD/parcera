import React from 'react';

export const CheckboxSetting: React.FC<{
  label: string;
  description?: string;
  checked: boolean | undefined | null;
  defaultValue?: boolean;
  onChange: (checked: boolean) => void;
  style?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
}> = ({ label, description, checked, defaultValue, onChange, style, labelStyle }) => {
  const isChecked = (checked !== undefined && checked !== null) ? checked : (defaultValue ?? false);
  return (
    <div className="form-group" style={{ marginBottom: '15px', ...style }}>
      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', ...labelStyle }}>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ marginRight: '10px' }}
        />
        {label}
      </label>
      {description && (
        <small style={{ display: 'block', color: '#888', marginTop: '4px', marginLeft: '26px', fontSize: '12px', lineHeight: '1.4' }}>
          {description}
        </small>
      )}
    </div>
  );
};
