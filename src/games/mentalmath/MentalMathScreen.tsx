import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../app/routes';
import { difficultyLabel, Difficulty, normalizeDifficulty } from '../types';
import { generateQuestions } from './logic/questions';
import HUD from './components/HUD';
import Button from '../../shared/ui/Button';
import Card from '../../shared/ui/Card';
import { useAppTheme } from '../../shared/theme/theme';
import { clearMentalMathState, getMentalMathState, saveMentalMathState } from './storage/mentalmathState';
import { trackSessionStart, trackWin } from '../../shared/storage/stats';
import { grantXp } from '../../shared/gamification/xp';
import { grantSeasonPoints } from '../../shared/gamification/seasonPoints';
import { claimDailyReward, markDailyCompleted } from '../../shared/storage/daily';
import { getProfile } from '../../shared/storage/profile';

type Props = NativeStackScreenProps<RootStackParamList, 'MentalMath'>;

export default function MentalMathScreen({ route }: Props) {
  const { theme } = useAppTheme();
  const difficulty = normalizeDifficulty(route.params?.difficulty, 'avanzado') as Difficulty;
  const isDaily = !!route.params?.isDaily;
  const dailyDateISO = route.params?.dailyDateISO;
  const dailySeed = route.params?.dailySeed;

  const [questions, setQuestions] = useState(generateQuestions(difficulty, 40, isDaily ? dailySeed : undefined));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [inputValue, setInputValue] = useState('');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [didFinish, setDidFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const saved = await getMentalMathState();
      if (
        saved &&
        saved.difficulty === difficulty &&
        !!saved.isDaily === isDaily &&
        (!isDaily || saved.dailyDateISO === dailyDateISO)
      ) {
        if (!mounted) return;
        setQuestions(saved.questions);
        setCurrentIndex(saved.currentIndex);
        setCorrect(saved.correct);
        setWrong(saved.wrong);
        setTimeLeft(saved.timeLeft);
        setInputValue(saved.inputValue);
        setSessionStarted(Boolean(saved.sessionStarted));
        setDidFinish(Boolean(saved.didFinish));
        if (!saved.sessionStarted) {
          await trackSessionStart({ gameId: 'mentalmath', mode: isDaily ? 'daily' : 'normal' });
          setSessionStarted(true);
        }
        return;
      }

      if (!mounted) return;
      setQuestions(generateQuestions(difficulty, 40, isDaily ? dailySeed : undefined));
      setCurrentIndex(0);
      setCorrect(0);
      setWrong(0);
      setTimeLeft(60);
      setInputValue('');
      setSessionStarted(true);
      setDidFinish(false);
      await trackSessionStart({ gameId: 'mentalmath', mode: isDaily ? 'daily' : 'normal' });
    };

    init();
    return () => {
      mounted = false;
    };
  }, [difficulty, isDaily, dailyDateISO, dailySeed]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    saveMentalMathState({
      questions,
      currentIndex,
      correct,
      wrong,
      timeLeft,
      inputValue,
      sessionStarted,
      didFinish,
      difficulty,
      isDaily,
      dailyDateISO,
      seed: dailySeed,
    });
  }, [questions, currentIndex, correct, wrong, timeLeft, inputValue, sessionStarted, didFinish, difficulty, isDaily, dailyDateISO, dailySeed]);

  const current = useMemo(() => questions[currentIndex % questions.length], [questions, currentIndex]);

  const finish = async () => {
    if (finishing || didFinish) return;
    setFinishing(true);
    setDidFinish(true);
    await trackWin({
      gameId: 'mentalmath',
      mode: isDaily ? 'daily' : 'normal',
      difficulty,
      durationMs: 60000,
      score: correct,
    });
    let earnedXp = 0;
    let earnedSp = 0;

    if (isDaily) {
      await markDailyCompleted();
      const { alreadyClaimed } = await claimDailyReward();
      if (!alreadyClaimed) {
        const profile = await getProfile();
        const xpResult = await grantXp({
          gameId: 'mentalmath',
          difficulty,
          won: true,
          durationMs: 60000,
          score: correct,
          mode: 'daily',
          streakCurrent: profile.streakCurrent,
        });
        earnedXp = xpResult.earnedXp;

        const spResult = await grantSeasonPoints({
          gameId: 'mentalmath',
          difficulty,
          durationMs: 60000,
          isDaily: true,
          dailyCompletedAndClaimable: true,
        });
        earnedSp = spResult.earnedSeasonPoints;
      }
    } else {
      const xpResult = await grantXp({
        gameId: 'mentalmath',
        difficulty,
        won: true,
        durationMs: 60000,
        score: correct,
        mode: 'normal',
      });
      earnedXp = xpResult.earnedXp;

      const spResult = await grantSeasonPoints({
        gameId: 'mentalmath',
        difficulty,
        durationMs: 60000,
        isDaily: false,
      });
      earnedSp = spResult.earnedSeasonPoints;
    }

    await clearMentalMathState();
    setSessionStarted(false);
    Alert.alert('Sesión terminada', `Aciertos: ${correct} · +${earnedXp} XP · +${earnedSp} SP`);
    setFinishing(false);
  };

  useEffect(() => {
    if (timeLeft === 0) {
      finish();
    }
  }, [timeLeft]);

  const submit = () => {
    const answer = Number(inputValue);
    if (!Number.isFinite(answer)) return;

    if (answer === current.answer) setCorrect((prev) => prev + 1);
    else setWrong((prev) => prev + 1);

    setCurrentIndex((prev) => prev + 1);
    setInputValue('');
  };

  const appendDigit = (digit: string) => {
    if (digit === '-' && inputValue.includes('-')) return;
    setInputValue((prev) => (prev === '0' ? digit : prev + digit));
  };

  const resetSession = () => {
    setQuestions(generateQuestions(difficulty, 40, isDaily ? dailySeed : undefined));
    setCurrentIndex(0);
    setCorrect(0);
    setWrong(0);
    setTimeLeft(60);
    setInputValue('');
    setDidFinish(false);
    setSessionStarted(true);
    trackSessionStart({ gameId: 'mentalmath', mode: isDaily ? 'daily' : 'normal' });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <HUD timeLeft={timeLeft} correct={correct} wrong={wrong} />

      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Mental Math · {difficultyLabel(difficulty)}</Text>
        <Text style={{ color: theme.colors.text, fontSize: 32, fontWeight: '700', marginTop: 10 }}>{current?.text ?? '-'}</Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 10 }}>Respuesta: {inputValue || '...'}</Text>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0'].map((digit) => (
          <Button key={digit} title={digit} onPress={() => appendDigit(digit)} style={{ width: 68 }} />
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="Borrar" variant="secondary" onPress={() => setInputValue('')} style={{ flex: 1 }} />
        <Button title="Enviar" onPress={submit} style={{ flex: 1 }} />
      </View>

      <Button title="Reiniciar" variant="ghost" onPress={resetSession} />
    </ScrollView>
  );
}