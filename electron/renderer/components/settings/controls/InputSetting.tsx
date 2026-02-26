import React, { useState, useEffect } from 'react';
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
  const inputId = React.useId();
  // Use local state to handle trailing decimals in number inputs seamlessly
  const [localValue, setLocalValue] = useState<string>(String(value ?? ''));

  useEffect(() => {
    const effectiveValue = (value !== undefined && value !== null && value !== '')
      ? value
      : (defaultValue ?? '');

    if (type === 'number') {
      const parsedLocal = parseFloat(localValue);
      const parsedIncoming = parseFloat(String(effectiveValue));
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
      const num = Number(raw);
      if (!isNaN(num)) {
        onChange(num);
      }
    } else {
      onChange(raw);
    }
  };

  const displayPlaceholder = placeholder || (defaultValue !== undefined ? String(defaultValue) : undefined);

  return (
    <SettingGroup label={label} description={description} labelStyle={labelStyle} contentId={inputId}>
      <input
        id={inputId}
        type={type}
        placeholder={displayPlaceholder}
        value={localValue}
        step={step}
        onChange={handleChange}
        className="setting-input"
      />
    </SettingGroup>
  );
};
