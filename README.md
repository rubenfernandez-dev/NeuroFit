# NeuroFit

NeuroFit es una app móvil de entrenamiento cognitivo construida con Expo + React Native + TypeScript.

Objetivo del proyecto: ofrecer sesiones cortas de juegos mentales con progresión, reto diario por etapas y gamificación local.

## Estado Actual Del Proyecto

Este README refleja el estado real del código en marzo de 2026.

- Stack activo: Expo 55, React Native 0.83, React 19, TypeScript.
- Navegación: React Navigation (native stack).
- Persistencia: Expo Secure Store (sin backend).
- Testing: Vitest para lógica de dominio.
- Plataforma objetivo principal: Android/iOS (web disponible en modo Expo, no priorizada).

## Stack Y Dependencias

Dependencias clave del proyecto:

- `expo`
- `react-native`
- `@react-navigation/native`
- `@react-navigation/native-stack`
- `expo-secure-store`
- `expo-notifications`
- `react-native-reanimated`
- `react-native-gesture-handler`
- `react-native-safe-area-context`
- `react-native-screens`

Herramientas de desarrollo:

- `typescript`
- `vitest`

## Arquitectura

La arquitectura está organizada por capas funcionales:

- `src/app`: navegación y contrato de rutas.
- `src/screens`: pantallas de producto (Home, Games, Daily, Progress, Leaderboard, Settings).
- `src/games`: implementación por juego (UI, lógica y estado local de sesión).
- `src/core`: lógica de dominio transversal de bajo nivel (economía, neuro score).
- `src/shared`: servicios compartidos (gamificación, storage, utils, UI base, tema, notificaciones).

Patrones activos:

- Registro de juegos centralizado en `src/games/registry.ts`.
- Params de rutas normalizados en `src/app/routes.ts` mediante `normalizeGameRouteParams`.
- Flujo unificado de cierre de sesión en `src/shared/gamification/sessionCompletion.ts`.

## Estructura De Carpetas (Resumen)

```txt
src/
  app/
    AppNavigator.tsx
    routes.ts

  screens/
    HomeScreen.tsx
    GamesScreen.tsx
    DailyChallengeScreen.tsx
    LeaderboardScreen.tsx
    ProgressScreen.tsx
    SettingsScreen.tsx

  core/
    gamification/
      economy.ts
      neuroscore.ts

  games/
    registry.ts
    types.ts
    sudoku/
    memory/
    mentalmath/
    speedmatch/
    patternmemory/
    focusgrid/
    storage/
      persistence.ts

  shared/
    gamification/
      levels.ts
      leagues.ts
      seasonPoints.ts
      streak.ts
      xp.ts
      sessionCompletion.ts
    leaderboard/
      leaderboard.ts
    notifications/
      notifications.ts
    storage/
      profile.ts
      stats.ts
      daily.ts
      notifications.ts
      secureStore.ts
      keys.ts
    ui/
    theme/
    utils/
```

## Juegos Disponibles

Actualmente hay 6 juegos habilitados:

- Sudoku
- Memory
- Mental Math
- Speed Match
- Pattern Memory
- Focus Grid

Todos están registrados en `src/games/registry.ts` y expuestos en navegación en `src/app/AppNavigator.tsx`.

## Daily Challenge (Estado Real)

El reto diario actual no es una sola partida: es un circuito de 3 etapas.

Cómo funciona hoy:

- `ensureDailyToday()` crea o recupera el estado del día.
- Se generan 3 etapas desde un pool de juegos/dificultades con semilla determinista.
- Cada etapa se marca con `markDailyStageStarted()` y se completa con `completeDailyStage()`.
- Al cerrar una partida, cada juego delega en `completeGameSession()`.
- Cuando se completa la etapa 3:
  - se marca circuito completo,
  - se aplica streak,
  - se intenta reclamar recompensa diaria una sola vez (`claimDailyReward`).

Robustez implementada:

- Serialización de mutaciones del daily en `daily.ts` para evitar carreras dentro del proceso.
- Dedupe en vuelo en `sessionCompletion.ts` para evitar doble cierre diario en taps concurrentes.

## Gamificación

Componentes principales:

- XP/SP: `src/core/gamification/economy.ts`
  - cálculo por score normalizado,
  - multiplicador por dificultad,
  - bono fijo diario.
- Niveles: `src/shared/gamification/levels.ts`.
- Ligas/temporada: `src/shared/gamification/leagues.ts` + `profile.ts`.
- NeuroScore: `src/core/gamification/neuroscore.ts` (dimensiones speed/memory/logic/attention).

Leaderboard semanal:

- Se simula localmente con generación determinista (`src/shared/leaderboard/leaderboard.ts`).
- No hay backend ni ranking global real multiusuario.

## Persistencia Local

Todo persiste en dispositivo vía Secure Store.

Claves de persistencia activas:

- Perfil: XP, nivel, liga, NeuroScore, dificultad preferida por juego.
- Daily: estado del circuito diario, etapas y recompensa reclamada.
- Stats: métricas acumuladas por juego.
- Estados de sesión por juego: sudoku, memory, mentalmath, speedmatch, patternmemory, focusgrid.
- Preferencias de notificaciones y programación local de recordatorio.

## Zonas En Migración / Deuda Activa

Estas áreas están vivas en el código y conviene conocerlas al entrar:

- Compatibilidad de rutas:
  - `mode` es fuente de verdad.
  - `isDaily` sigue soportado como legado para compatibilidad.
- Hardening de persistencia:
  - ya aplicado en `memory` y `mentalmath` mediante normalización defensiva,
  - pendiente de extender en el resto de storages de juego.
- Funciones de stats marcadas como deprecadas:
  - se mantienen por compatibilidad (`recordSession`, `recordSudokuStarted`, `recordSudokuOutcome`).

## Limitaciones Actuales

- Sin backend: no hay autenticación, sincronización cloud ni multi-dispositivo.
- Leaderboard semanal simulado localmente.
- Idempotencia diaria robusta dentro del proceso, pero sin garantías transaccionales entre procesos/dispositivos.
- La app depende de estado local; al reinstalar se pierde progreso.
- Cobertura de tests enfocada en dominio; UI no tiene suite de tests automatizada dedicada.

## Ejecutar El Proyecto

Requisitos:

- Node.js LTS
- npm
- entorno Expo/Android Studio o Xcode según plataforma

Instalación y arranque:

```bash
npm install
npx expo start
```

Comandos útiles:

```bash
# Android nativo
npm run android

# iOS nativo
npm run ios

# Web (no priorizada)
npm run web

# Tests de dominio
npm run test:run

# Typecheck
npx tsc --noEmit
```

## Para Devs Nuevos

Orden recomendado para entender el flujo:

1. `src/app/routes.ts` y `src/app/AppNavigator.tsx`
2. `src/games/registry.ts`
3. `src/screens/DailyChallengeScreen.tsx`
4. `src/shared/gamification/sessionCompletion.ts`
5. `src/shared/storage/daily.ts`, `src/shared/storage/profile.ts`, `src/shared/storage/stats.ts`

Con eso se entiende la mayor parte del comportamiento funcional actual del producto.
