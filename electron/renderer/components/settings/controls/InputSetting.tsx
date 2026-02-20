import React, { useState, useEffect } from 'react';
import { inputStyle } from '../types';
import { SettingGroup } from './SettingGroup';

interface InputSettingProps {
  label: string;
  type?: 'text' | 'number';
  value: string | number;
  onChange: (val: any) => void;
  placeholder?: string;
  step?: string;
  labelStyle?: React.CSSProperties;
}

export const InputSetting: React.FC<InputSettingProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  step,
  labelStyle
}) => {
  // Use local state to handle trailing decimals in number inputs seamlessly
  const [localValue, setLocalValue] = useState<string>(String(value ?? ''));

  useEffect(() => {
    if (value !== undefined && value !== null) {
      if (type === 'number') {
        const parsedLocal = parseFloat(localValue);
        const parsedIncoming = parseFloat(String(value));
        // Only override local typing if the incoming external value actually differs in quantity
        if (isNaN(parsedLocal) || parsedLocal !== parsedIncoming) {
          setLocalValue(String(value));
        }
      } else {
        setLocalValue(String(value));
      }
    }
  }, [value, type]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalValue(raw);

    if (type === 'number') {
      // Replicate the previous behavior: onChange gets Number(value)
      // which safely defaults to 0 on empty strings in JS.
      onChange(Number(raw));
    } else {
      onChange(raw);
    }
  };

  return (
    <SettingGroup label={label} labelStyle={labelStyle}>
      <input
        type={type}
        placeholder={placeholder}
        value={localValue}
        step={step}
        onChange={handleChange}
        style={inputStyle}
      />
    </SettingGroup>
  );
};
