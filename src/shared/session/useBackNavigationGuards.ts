import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BackHandler } from 'react-native';
import { RootStackParamList } from '../../app/routes';

const BACK_ACTION_TYPES = new Set(['GO_BACK', 'POP', 'POP_TO_TOP']);

function isBackAction(type?: string): boolean {
  if (!type) return false;
  return BACK_ACTION_TYPES.has(type);
}

export function useGameBackToGames(navigation: NativeStackNavigationProp<RootStackParamList, keyof RootStackParamList>) {
  useFocusEffect(
    React.useCallback(() => {
      const goGames = () => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Games' }],
        });
      };

      const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
        goGames();
        return true;
      });

      const beforeRemoveSub = navigation.addListener('beforeRemove', (event) => {
        if (!isBackAction(event.data.action.type)) return;
        event.preventDefault();
        goGames();
      });

      return () => {
        backSub.remove();
        beforeRemoveSub();
      };
    }, [navigation]),
  );
}

export function useGamesBackToHome(navigation: NativeStackNavigationProp<RootStackParamList, keyof RootStackParamList>) {
  useFocusEffect(
    React.useCallback(() => {
      const goHome = () => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      };

      const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
        goHome();
        return true;
      });

      const beforeRemoveSub = navigation.addListener('beforeRemove', (event) => {
        if (!isBackAction(event.data.action.type)) return;
        event.preventDefault();
        goHome();
      });

      return () => {
        backSub.remove();
        beforeRemoveSub();
      };
    }, [navigation]),
  );
}
