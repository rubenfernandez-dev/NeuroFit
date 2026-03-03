# NeuroFit

**NeuroFit** es una app Expo React Native (TypeScript) de *fitness mental motivador*.

Slogan: **“Entrena tu mente como entrenas tu cuerpo”**

## Setup (comandos)

```bash
# Crear proyecto Expo + TypeScript (si empiezas desde cero)
npx create-expo-app@latest neurofit --template blank-typescript
cd neurofit

# Dependencias requeridas
npx expo install @react-navigation/native @react-navigation/native-stack react-native-gesture-handler react-native-reanimated react-native-screens react-native-safe-area-context expo-secure-store expo-asset

# Arrancar
npx expo start
```

> Este repo ya incluye `babel.config.js` con `react-native-reanimated/plugin`.

## Estructura

```txt
assets/
  icon.png
  splash.png
  adaptive-icon.png
  favicon.png

src/
  app/
    AppNavigator.tsx
    routes.ts
  screens/
    HomeScreen.tsx
    GamesScreen.tsx
    DailyChallengeScreen.tsx
    ProgressScreen.tsx
    SettingsScreen.tsx
  games/
    types.ts
    registry.ts
    sudoku/
      SudokuScreen.tsx
      components/
        SudokuGrid.tsx
        SudokuCell.tsx
        Keypad.tsx
      logic/
        generator.ts
        solver.ts
        difficulty.ts
        validate.ts
      model/
        types.ts
      storage/
        sudokuState.ts
    memory/
      MemoryScreen.tsx
      logic/
        deck.ts
      components/
        MemoryCard.tsx
      storage/
        memoryState.ts
    mentalmath/
      MentalMathScreen.tsx
      logic/
        questions.ts
      components/
        HUD.tsx
      storage/
        mentalmathState.ts
  shared/
    theme/
      colors.ts
      spacing.ts
      typography.ts
      theme.ts
    ui/
      Button.tsx
      Card.tsx
      Pill.tsx
      Divider.tsx
      StatRow.tsx
    storage/
      keys.ts
      stats.ts
      daily.ts
      profile.ts
    gamification/
      levels.ts
      xp.ts
    utils/
      time.ts
      random.ts
      seed.ts
      format.ts
```

## Arquitectura modular (añadir juego nuevo)

Objetivo plug & play: **crear carpeta + registrar + añadir ruta**.

Pasos exactos:
1. Crear carpeta `src/games/<nuevo-juego>/` con `Screen`, `logic`, `components`, `storage`.
2. Exportar tipos/estado del juego si aplica.
3. Añadir definición en `src/games/registry.ts` (`id`, `title`, `subtitle`, `icon`, `routeName`, `difficulties`, `enabled`).
4. Añadir nuevo `routeName` en `src/app/routes.ts` (`RootStackParamList`).
5. Registrar pantalla en `src/app/AppNavigator.tsx`.
6. (Opcional) Incluir estado persistente propio usando `expo-secure-store`.

## Reto diario (seed + completado)

`shared/storage/daily.ts`:
- `ensureDailyToday()` genera un reto único por fecha si no existe.
- Seed diaria determinista:
  - fecha `YYYY-MM-DD`
  - `seed = hash("YYYY-MM-DD" + "neurofit")`
  - utilidades en `shared/utils/seed.ts` y `shared/utils/random.ts`.
- Al completar juego en modo daily:
  - `markDailyCompleted()`.

Cada juego recibe params:
- `isDaily`
- `dailySeed`
- `dailyDateISO`

Así puede elegir puzzle/deck/preguntas de forma determinista.

## XP y niveles

Niveles en `shared/gamification/levels.ts`:
- Bronze, Silver, Gold, Platinum, Diamond
- cada uno con `id`, `name`, `minXp`, `badgeEmoji`
- `getLevelByXp(xp)`

XP en `shared/gamification/xp.ts`:
- `calcXp({ gameId, difficulty, won, score, durationMs })`
- fórmula MVP:
  - base por sesión
  - bonus por dificultad
  - bonus por victoria
  - bonus por rapidez
  - bonus por rendimiento (score)

Al finalizar partida:
1. `recordSession(...)`
2. `grantXp(...)`
3. recalcular `levelId` del perfil
4. si `isDaily`, `markDailyCompleted()`

## Pantallas

- `Home`: branding + 3 CTAs + tarjeta nivel actual.
- `Games`: listado dinámico por `enabledGames()`.
- `DailyChallenge`: reto diario con estado y navegación al juego.
- `Progress`: sesiones, stats por juego, XP, nivel y progreso al siguiente nivel.
- `Settings`: tema (`system/light/dark`) y reset de progreso con confirmación.

## Ejecutar

```bash
npm install
npx expo start
```

## Notas MVP

- Sudoku: tablero 9x9, keypad 1-9 + borrar, comprobar, conflictos y guardado.
- Memory: flip/match, intentos, timer, grid por dificultad.
- MentalMath: sesión de 60s, preguntas por dificultad, input numérico propio.
- Persistencia segura con `expo-secure-store` para stats/perfil/daily/estado de partida.
