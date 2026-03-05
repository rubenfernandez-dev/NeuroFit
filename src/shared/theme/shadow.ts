import { Platform, ViewStyle } from 'react-native';

export function shadow(level: 1 | 2 = 1): ViewStyle {
  const config =
    level === 1
      ? { radius: 8, opacity: 0.08, y: 4, elevation: 2 }
      : { radius: 12, opacity: 0.14, y: 8, elevation: 4 };

  return {
    shadowColor: '#0F172A',
    shadowOpacity: config.opacity,
    shadowRadius: config.radius,
    shadowOffset: { width: 0, height: config.y },
    elevation: Platform.OS === 'android' ? config.elevation : 0,
  };
}
