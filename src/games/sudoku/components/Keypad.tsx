import React from 'react';
import { View } from 'react-native';
import Button from '../../../shared/ui/Button';

type KeypadProps = {
  onInput: (value: number) => void;
  onClear: () => void;
};

export default function Keypad({ onInput, onClear }: KeypadProps) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <Button key={i + 1} title={String(i + 1)} onPress={() => onInput(i + 1)} style={{ width: 58 }} />
        ))}
      </View>
      <Button title="Borrar" variant="secondary" onPress={onClear} />
    </View>
  );
}