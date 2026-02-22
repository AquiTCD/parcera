import React, { useState, useEffect } from 'react';
import { inputStyle } from '../types';
import { SettingGroup } from './SettingGroup';

interface InputSettingProps {
  label: string;
  description?: string;
  type?: 'text' | 'number';
  value: string | number | undefined | null;
  defaultValue?: string | number;
  onChange: (val: any) => void;
  placeholder?: string;
  step?: string;
  labelStyle?: React.CSSProperties;
}

export const InputSetting: React.FC<InputSettingProps> = ({
  label,
  description,
  type = 'text',
  value,
  defaultValue,
  onChange,
  placeholder,
  step,
  labelStyle
}) => {
  // Use local state to handle trailing decimals in number inputs seamlessly
  // If value is empty/undefined, fall back to literal empty string here.
  // The actual display value will be managed in useEffect if defaultValue is provided.
  const [localValue, setLocalValue] = useState<string>(String(value ?? ''));

  useEffect(() => {
    // If external value is explicitly set (not null/undefined/empty string), use it
    const effectiveValue = (value !== undefined && value !== null && value !== '')
      ? value
      : (defaultValue ?? '');

    if (type === 'number') {
      const parsedLocal = parseFloat(localValue);
      const parsedIncoming = parseFloat(String(effectiveValue));
      // Only override local typing if the incoming external value actually differs in quantity
      if (isNaN(parsedLocal) || parsedLocal !== parsedIncoming) {
        setLocalValue(String(effectiveValue));
      }
    } else {
      setLocalValue(String(effectiveValue));
    }
  }, [value, defaultValue, type]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalValue(raw);

    if (type === 'number') {
      onChange(Number(raw));
    } else {
      onChange(raw);
    }
  };

  const displayPlaceholder = placeholder || (defaultValue !== undefined ? String(defaultValue) : undefined);

  return (
    <SettingGroup label={label} description={description} labelStyle={labelStyle}>
      <input
        type={type}
        placeholder={displayPlaceholder}
        value={localValue}
        step={step}
        onChange={handleChange}
        style={inputStyle}
      />
    </SettingGroup>
  );
};
