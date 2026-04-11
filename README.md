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
    numbermatch/
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

Actualmente hay 7 juegos habilitados:

- Sudoku
- Memory
- Mental Math
- Speed Match
- Pattern Memory
- Focus Grid
- Number Match

Todos están registrados en `src/games/registry.ts` y expuestos en navegación en `src/app/AppNavigator.tsx`.

Estado de integración en daily:

- El circuito diario sigue siendo de 3 etapas, con 1 juego por familia cognitiva (`speed`, `memory`, `logic`).
- `Number Match` ya está habilitado dentro del pool diario en la familia `logic`.

### Speed Match: diferencias reales por dificultad

- `principiante`: 3 símbolos, 50% de match, 900 ms entre estímulos, máximo 12 fallos.
- `avanzado`: 4 símbolos, 42% de match, 780 ms, máximo 11 fallos.
- `experto`: 5 símbolos, 34% de match, 670 ms, máximo 10 fallos.
- `maestro`: 6 símbolos, 27% de match, 560 ms, máximo 9 fallos.
- `gran_maestro`: 7 símbolos, 20% de match, 470 ms, máximo 8 fallos.

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
- Estados de sesión por juego: sudoku, memory, mentalmath, speedmatch, patternmemory, focusgrid, numbermatch.
- Preferencias de notificaciones y programación local de recordatorio.

## Observabilidad Y Errores

Estado actual implementado:

- Logging operativo estructurado en `src/shared/observability/observability.ts`.
- API compartida: `logWarning`, `logError`, `captureException`, `initCrashReporting`.
- Recuperación defensiva en storage crítico (`profile`, `stats`, `daily`, `notifications`, `feedback`) cuando hay datos corruptos.
- Fallback UX para cargas críticas en bootstrap y pantallas Home/Progress.

### Sentry (Expo) - Setup Manual

La integración quedó preparada, pero requiere variables de entorno para activarse.

1. Instalar dependencias del proyecto (`npm install`).
2. Configurar variable pública en entorno local/CI:

```bash
EXPO_PUBLIC_SENTRY_DSN=tu_dsn_de_sentry
EXPO_PUBLIC_APP_ENV=production
```

3. Reiniciar Metro o el build después de cambiar variables.

Comportamiento sin DSN:

- La app no falla.
- Sentry queda desactivado y se registra advertencia estructurada en logs.

## Publicacion Y Store Readiness

Base actual para publicacion:

- App local-first sin backend de cuentas.
- Ranking semanal local/simulado (no global en tiempo real).
- Persistencia local de progreso y ajustes.
- Notificaciones solo si el usuario las habilita.

### Privacidad (baseline tecnica)

Se incluyo una base honesta en `PRIVACY.md` con:

- Datos que realmente maneja la app hoy.
- Que no recopila el producto actual.
- Rol opcional de Sentry y decision pendiente de activarlo en produccion.
- Pendientes humanos para Play Console y politica legal final.

Checklist de publicacion operativa: `PLAYSTORE_CHECKLIST.md`.

### Permisos Android

Manifest fuente principal (`android/app/src/main/AndroidManifest.xml`):

- `android.permission.INTERNET`
- `android.permission.VIBRATE`

En merge de release tambien aparecen permisos transitivos de librerias (por ejemplo notificaciones, secure storage y utilidades de runtime Android). Esos permisos deben revisarse contra el artefacto final antes de publicar.

Nota tecnica sobre manifest y backup rules:

- `AndroidManifest.xml` referencia `@xml/secure_store_backup_rules` y `@xml/secure_store_data_extraction_rules`.
- Esos XML no estan en fuente bajo `android/app/src/main/res/xml` en este repo.
- Hipotesis verificada por build previo: se inyectan durante el proceso de build por dependencias/plugins de Expo Secure Store.
- Verificacion manual recomendada: inspeccionar el manifest mergeado final y el APK/AAB generado.

### Checklist Minimo Antes De Subir A Play Store

1. Definir y publicar URL final de politica de privacidad (legal revisada).
2. Confirmar decision de Sentry en produccion:
  - si se activa, revisar scrubbing/retencion/accesos.
3. Generar AAB release firmado y verificar manifest final de release.
4. Completar Data Safety de Play Console con base en `PRIVACY.md` y artefacto final.
5. Preparar ficha (titulo corto/largo, descripcion, screenshots, icon, feature graphic).
6. Validar que el copy de tienda no prometa backend ni competicion global real.

### Estado Android Release Validado

Validaciones tecnicas ya confirmadas en este repo:

- `android\\gradlew.bat assembleDebug` -> OK
- `android\\gradlew.bat assembleRelease` -> OK
- `android\\gradlew.bat bundleRelease` -> OK
- Salida AAB generada en `android/app/build/outputs/bundle/release/app-release.aab`

Estado de signing actual:

- El wiring de release signing ya existe en Gradle.
- `signingReport` sigue mostrando release sin store/alias configurados mientras no se definan las propiedades `NEUROFIT_UPLOAD_*`.
- Sin esas credenciales, el proyecto genera artefactos release validos para verificacion tecnica, pero no una AAB firmada final para subida a Play Console.

Limitacion tecnica abierta:

- `android\\gradlew.bat clean assembleRelease` puede fallar en `:app:externalNativeBuildCleanDebug`.
- El fallo actual apunta a autolinking/codegen JNI faltante durante el clean nativo con New Architecture en dependencias como Sentry, gesture-handler, reanimated y worklets.
- No bloquea `assembleRelease` ni `bundleRelease` en el estado actual del repo.
- No se dejo ningun workaround permanente en Gradle para este punto porque los intentos probados no resolvieron la causa real.

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

## Estado de tests (baseline estable)

- Suite actual: `src/**/*.test.ts` con Vitest.
- Cobertura de dominio: economy, neuroscore, xp, seasonPoints, streak, daily, leaderboard.
- Cobertura de modulos delicados agregada: `sessionCompletion` y `profile`.
- Estado esperado tras estabilizacion: `npm run test:run` en verde y `npx tsc --noEmit` sin errores.

## Baseline estable actual

Estado del proyecto:

- Base funcional estable para continuar desarrollo incremental sin cambios de arquitectura.
- Flujo core daily/sessionCompletion endurecido con regresion en tests.
- Documentacion principal alineada al estado real del producto (7 juegos; daily con Number Match habilitado en pool).

Tests en verde:

- Suite Vitest (`src/**/*.test.ts`) en verde.
- Typecheck TypeScript (`npx tsc --noEmit`) en verde.

Limitaciones conocidas:

- Sin backend ni sincronizacion cloud.
- Leaderboard semanal local/simulado.
- El daily sigue limitado a 3 etapas por diseno (una por familia), aunque Number Match ya entra en la familia logic.
- Sin suite automatizada dedicada para UI end-to-end.

Validaciones manuales pendientes:

- Generar release Android final y revisar manifest mergeado real del artefacto.
- Verificar signing final con credenciales `NEUROFIT_UPLOAD_*`.
- Ejecutar smoke test funcional (daily, progreso, leaderboard, notificaciones, reset).

Riesgos abiertos conocidos:

- `clean assembleRelease` puede fallar en clean nativo (`externalNativeBuildCleanDebug`) con New Architecture.
- Referencias a `@xml/secure_store_backup_rules` y `@xml/secure_store_data_extraction_rules` dependen de inyeccion en build final; verificar manualmente en artefacto release.

Checklist tecnico operativo para release y smoke test: `BASELINE_RELEASE_CHECKLIST.md`.

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

# Tests en watch
npm test

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
