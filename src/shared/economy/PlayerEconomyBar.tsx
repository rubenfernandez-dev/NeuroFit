import React from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getProfile } from '../storage/profile';
import { useAppTheme } from '../theme/theme';
import { formatNeuroCoinsCompact } from './neuroCoins';
import { getLeagueById } from '../gamification/leagues';

type PlayerEconomyBarProps = {
  xp?: number;
  neuroCoins?: number;
  compact?: boolean;
  middleLabel?: string;
  middleSubLabel?: string;
  middleColor?: string;
};

export default function PlayerEconomyBar({
  xp,
  neuroCoins,
  compact = false,
  middleLabel,
  middleSubLabel,
  middleColor,
}: PlayerEconomyBarProps) {
  const { theme } = useAppTheme();
  const [state, setState] = React.useState({ xp: 0, neuroCoins: 0, leagueLabel: 'Bronce' });

  const hasExternalValues = typeof xp === 'number' || typeof neuroCoins === 'number';
  const xpValue = typeof xp === 'number' ? Math.max(0, Math.floor(xp)) : state.xp;
  const neuroCoinValue = typeof neuroCoins === 'number' ? Math.max(0, Math.floor(neuroCoins)) : state.neuroCoins;
  const leagueLabel = middleLabel && middleLabel.trim().length > 0 ? middleLabel : `🏆 ${state.leagueLabel}`;
  const leagueSubLabel = middleSubLabel;

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;

      const load = async () => {
        try {
          const profile = await getProfile();
          if (!mounted) return;

          setState({
            xp: typeof xp === 'number' ? Math.max(0, Math.floor(xp)) : Math.max(0, Math.floor(profile.xpTotal)),
            neuroCoins:
              typeof neuroCoins === 'number' ? Math.max(0, Math.floor(neuroCoins)) : Math.max(0, Math.floor(profile.seasonPoints)),
            leagueLabel: getLeagueById(profile.leagueId).name,
          });
        } catch {
          if (!mounted) return;
          setState((prev) => ({ ...prev, xp: 0, neuroCoins: 0 }));
        }
      };

      load();
      return () => {
        mounted = false;
      };
    }, [hasExternalValues, neuroCoins, xp]),
  );

  const pillHeight = compact ? 34 : 40;
  const valueSize = compact ? 13 : 15;

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.mode === 'dark' ? 'rgba(148,163,184,0.35)' : 'rgba(71,85,105,0.25)',
        backgroundColor: theme.mode === 'dark' ? 'rgba(15,23,42,0.9)' : 'rgba(241,245,249,0.98)',
        paddingHorizontal: compact ? 10 : 12,
        paddingVertical: compact ? 8 : 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View
          style={{
            flex: 1,
            minHeight: pillHeight,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.mode === 'dark' ? 'rgba(253,224,71,0.45)' : 'rgba(202,138,4,0.35)',
            backgroundColor: theme.mode === 'dark' ? 'rgba(250,204,21,0.14)' : 'rgba(250,204,21,0.2)',
            paddingHorizontal: 8,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: valueSize }} numberOfLines={1}>⭐ {xpValue.toLocaleString()} XP</Text>
        </View>

        <View
          style={{
            flex: 1,
            minHeight: pillHeight,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: middleColor
              ? `${middleColor}99`
              : theme.mode === 'dark'
                ? 'rgba(167,139,250,0.45)'
                : 'rgba(109,40,217,0.35)',
            backgroundColor: middleColor
              ? `${middleColor}22`
              : theme.mode === 'dark'
                ? 'rgba(139,92,246,0.16)'
                : 'rgba(167,139,250,0.16)',
            paddingHorizontal: 8,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: valueSize }} numberOfLines={1}>
            {leagueLabel}
          </Text>
          {leagueSubLabel ? (
            <Text style={{ color: theme.colors.textMuted, fontWeight: '700', fontSize: compact ? 10 : 11 }} numberOfLines={1}>
              {leagueSubLabel}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            flex: 1,
            minHeight: pillHeight,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.mode === 'dark' ? 'rgba(45,212,191,0.45)' : 'rgba(13,148,136,0.35)',
            backgroundColor: theme.mode === 'dark' ? 'rgba(20,184,166,0.14)' : 'rgba(20,184,166,0.16)',
            paddingHorizontal: 8,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: valueSize }} numberOfLines={1}>
            {formatNeuroCoinsCompact(neuroCoinValue)}
          </Text>
        </View>
      </View>
    </View>
  );
}