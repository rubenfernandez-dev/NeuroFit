import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../app/routes';
import { Difficulty } from '../types';
import { generateQuestions } from './logic/questions';
import HUD from './components/HUD';
import Button from '../../shared/ui/Button';
import Card from '../../shared/ui/Card';
import { useAppTheme } from '../../shared/theme/theme';
import { clearMentalMathState, getMentalMathState, saveMentalMathState } from './storage/mentalmathState';
import { recordSession } from '../../shared/storage/stats';
import { grantXp } from '../../shared/gamification/xp';
import { markDailyCompleted } from '../../shared/storage/daily';

type Props = NativeStackScreenProps<RootStackParamList, 'MentalMath'>;

export default function MentalMathScreen({ route }: Props) {
  const { theme } = useAppTheme();
  const difficulty = (route.params?.difficulty ?? 'medium') as Difficulty;
  const isDaily = !!route.params?.isDaily;
  const dailyDateISO = route.params?.dailyDateISO;
  const dailySeed = route.params?.dailySeed;

  const [questions, setQuestions] = useState(generateQuestions(difficulty, 40, isDaily ? dailySeed : undefined));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [inputValue, setInputValue] = useState('');
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
        return;
      }

      if (!mounted) return;
      setQuestions(generateQuestions(difficulty, 40, isDaily ? dailySeed : undefined));
      setCurrentIndex(0);
      setCorrect(0);
      setWrong(0);
      setTimeLeft(60);
      setInputValue('');
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
      difficulty,
      isDaily,
      dailyDateISO,
      seed: dailySeed,
    });
  }, [questions, currentIndex, correct, wrong, timeLeft, inputValue, difficulty, isDaily, dailyDateISO, dailySeed]);

  const current = useMemo(() => questions[currentIndex % questions.length], [questions, currentIndex]);

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    await recordSession({ gameId: 'mentalmath', difficulty, durationMs: 60000, score: correct, won: true });
    const { earnedXp } = await grantXp({ gameId: 'mentalmath', difficulty, won: true, durationMs: 60000, score: correct });
    if (isDaily) await markDailyCompleted();
    await clearMentalMathState();
    Alert.alert('Sesión terminada', `Aciertos: ${correct} · +${earnedXp} XP`);
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
  };

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <HUD timeLeft={timeLeft} correct={correct} wrong={wrong} />

      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Pregunta</Text>
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