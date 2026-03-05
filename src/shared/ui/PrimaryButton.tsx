import React from 'react';
import Button from './Button';

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: object;
};

export default function PrimaryButton({ title, onPress, disabled, style }: PrimaryButtonProps) {
  return <Button title={title} onPress={onPress} disabled={disabled} variant="primary" style={style} />;
}
