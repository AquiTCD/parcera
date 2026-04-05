import React from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';

export const FieldRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-sm font-medium">{label}</Label>
    {children}
  </div>
);

export interface SliderRowProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (val: number) => void;
}

export const SliderRow: React.FC<SliderRowProps> = ({
  label,
  description,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <Label className="text-sm font-medium">{label}</Label>
      <span className="text-sm text-muted-foreground tabular-nums w-14 text-right">
        {Number(value).toFixed(2)}{unit}
      </span>
    </div>
    {description && <p className="text-xs text-muted-foreground">{description}</p>}
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([val]) => onChange(val)}
    />
  </div>
);

export interface PasswordFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  actionButton?: React.ReactNode;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({
  value,
  onChange,
  placeholder,
  actionButton,
}) => {
  const [show, setShow] = React.useState(false);
  return (
    <div className="flex gap-2">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1"
      />
      <Button variant="outline" size="sm" onClick={() => setShow((s) => !s)} type="button">
        {show ? '隠す' : '表示'}
      </Button>
      {actionButton}
    </div>
  );
};
