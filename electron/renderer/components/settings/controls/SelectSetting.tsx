import React from 'react';
import { SettingGroup } from './SettingGroup';

interface SelectSettingProps {
  label: string;
  description?: string;
  value: string | number;
  defaultValue?: string | number;
  onChange: (val: string) => void;
  options: { value: string | number; label: string }[];
  disabled?: boolean;
  style?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
}

export const SelectSetting: React.FC<SelectSettingProps> = ({
  label,
  description,
  value,
  defaultValue,
  onChange,
  options,
  disabled,
  style,
  labelStyle
}) => {
  const selectId = React.useId();
  const currentValue = value ?? defaultValue ?? '';

  return (
    <SettingGroup label={label} description={description} contentId={selectId} labelStyle={labelStyle}>
      <select
        id={selectId}
        value={currentValue}
        className="setting-input"
        onChange={(e) => onChange(e.target.value)}
        style={style}
        disabled={disabled}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </SettingGroup>
  );
};
