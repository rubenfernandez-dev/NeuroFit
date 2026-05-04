import React from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getProfile } from '../storage/profile';
import { useAppTheme } from '../theme/theme';
import { formatNeuroCoinsCompact } from './neuroCoins';

type PlayerEconomyBarProps = {
  xp?: number;
  neuroCoins?: number;
  compact?: boolean;
};

export default function PlayerEconomyBar({ xp, neuroCoins, compact = true }: PlayerEconomyBarProps) {
  const { theme } = useAppTheme();
  const [state, setState] = React.useState({ xp: 0, neuroCoins: 0 });

  const hasExternalValues = typeof xp === 'number' || typeof neuroCoins === 'number';
  const xpValue = typeof xp === 'number' ? Math.max(0, Math.floor(xp)) : state.xp;
  const neuroCoinValue = typeof neuroCoins === 'number' ? Math.max(0, Math.floor(neuroCoins)) : state.neuroCoins;

  useFocusEffect(
    React.useCallback(() => {
      if (hasExternalValues) {
        return () => {};
      }

      let mounted = true;
      const load = async () => {
        try {
          const profile = await getProfile();
          if (!mounted) return;
          setState({
            xp: Math.max(0, Math.floor(profile.xpTotal)),
            neuroCoins: Math.max(0, Math.floor(profile.seasonPoints)),
          });
        } catch {
          if (!mounted) return;
          setState({ xp: 0, neuroCoins: 0 });
        }
      };

      load();
      return () => {
        mounted = false;
      };
    }, [hasExternalValues]),
  );

  return (
    <View
      style={{
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.mode === 'dark' ? 'rgba(148,163,184,0.35)' : 'rgba(71,85,105,0.25)',
        backgroundColor: theme.mode === 'dark' ? 'rgba(15,23,42,0.82)' : 'rgba(241,245,249,0.92)',
        paddingHorizontal: compact ? 10 : 12,
        paddingVertical: compact ? 6 : 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: theme.mode === 'dark' ? 'rgba(253,224,71,0.45)' : 'rgba(202,138,4,0.35)',
            backgroundColor: theme.mode === 'dark' ? 'rgba(250,204,21,0.14)' : 'rgba(250,204,21,0.18)',
            paddingHorizontal: compact ? 8 : 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '800', fontSize: compact ? 12 : 13 }}>⭐ {xpValue.toLocaleString()} XP</Text>
        </View>

        <View
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: theme.mode === 'dark' ? 'rgba(45,212,191,0.45)' : 'rgba(13,148,136,0.35)',
            backgroundColor: theme.mode === 'dark' ? 'rgba(20,184,166,0.14)' : 'rgba(20,184,166,0.16)',
            paddingHorizontal: compact ? 8 : 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '800', fontSize: compact ? 12 : 13 }}>{formatNeuroCoinsCompact(neuroCoinValue)}</Text>
        </View>
      </View>
    </View>
  );
}