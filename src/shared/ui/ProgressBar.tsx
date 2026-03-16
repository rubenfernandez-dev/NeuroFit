import React from 'react';
import type { CognitiveCategory } from '../theme/categoryColors';
import AnimatedProgressBar from './AnimatedProgressBar';

type ProgressBarProps = {
  value: number;
  label?: string;
  color?: string;
  category?: CognitiveCategory;
};

export default function ProgressBar({ value, label, color, category }: ProgressBarProps) {
  return <AnimatedProgressBar value={value} label={label} color={color} category={category} />;
}
