# NeuroFit Baseline Release Checklist (Tecnico)

Last updated: 2026-04-11

Este checklist prepara una release candidate interna y valida el baseline tecnico actual.

## 1) Hechos verificados

- App local-first (sin backend ni cuentas).
- 7 juegos disponibles en modo normal.
- Daily actual usa 3 etapas y pool de 7 juegos (selecciona 1 por familia cognitiva).
- Tests de dominio en verde (`npm run test:run`).
- Typecheck TypeScript en verde (`npx tsc --noEmit`).
- Wiring de signing release en Gradle activo via `NEUROFIT_UPLOAD_*`.

## 2) Hipotesis tecnicas (a validar manualmente)

- `@xml/secure_store_backup_rules` y `@xml/secure_store_data_extraction_rules` se inyectan por dependencias/plugins durante build release.

## 3) Validaciones manuales pendientes

- Confirmar manifest mergeado final del build release.
- Confirmar signing final con keystore de subida real.
- Ejecutar smoke test funcional completo en dispositivo real.

## 4) Comandos exactos de release Android

Ejecutar desde `android/`:

```powershell
.\gradlew.bat assembleRelease
.\gradlew.bat bundleRelease
.\gradlew.bat signingReport
```

Comandos de preflight recomendados desde raiz del repo:

```powershell
npm run test:run
npx tsc --noEmit
```

Nota:

- Evitar usar `clean assembleRelease` como gate principal mientras siga abierta la limitacion de clean nativo con New Architecture.

## 5) Artefactos y archivos a inspeccionar

Verificar existencia y fecha/hora de:

- `android/app/build/outputs/apk/release/app-release.apk`
- `android/app/build/outputs/bundle/release/app-release.aab`

Verificar firma/estado signing con salida de:

- `signingReport` (variant release)

Verificar manifest mergeado final (ruta habitual, puede variar por AGP):

- `android/app/build/intermediates/merged_manifests/release/processReleaseMainManifest/AndroidManifest.xml`
- Alternativa si cambia la ruta: buscar `AndroidManifest.xml` dentro de `android/app/build/intermediates/**/merged_manifests/**`.

## 6) Verificacion manual: secure store backup rules

En el manifest mergeado final de release confirmar en `<application>`:

- `android:fullBackupContent="@xml/secure_store_backup_rules"`
- `android:dataExtractionRules="@xml/secure_store_data_extraction_rules"`

Luego confirmar que los XML existen en el artefacto final (APK/AAB):

- `res/xml/secure_store_backup_rules.xml`
- `res/xml/secure_store_data_extraction_rules.xml`

Criterio de aceptacion:

- El manifest mergeado referencia ambos recursos sin placeholders invalidos.
- Los dos XML existen en el paquete final.

## 7) Smoke test manual (apto para persona no tecnica)

Preparacion:

- Instalar build release candidate en dispositivo Android.
- Abrir app con red habilitada y sonido/haptics activos.

Checklist:

1. Arranque inicial
- Abrir app por primera vez.
- Verificar que llega a Home sin errores visibles.

2. Daily de 3 etapas
- Entrar a reto diario.
- Completar 3 etapas.
- Verificar que muestra progreso por etapa y finalizacion del circuito.

3. Cierre de sesion de juegos
- Jugar al menos 1 partida en modo normal (cualquier juego).
- Verificar que aparece resultado final y vuelve correctamente a flujo principal.

4. Progreso y perfil
- Ir a pantalla de progreso.
- Verificar que XP/racha/nivel cambian tras partidas.

5. Leaderboard
- Abrir leaderboard.
- Verificar que lista semanal carga sin crashear.

6. Notificaciones
- Ir a ajustes.
- Activar recordatorio diario y ajustar hora.
- Cerrar/reabrir app y verificar que la preferencia se conserva.

7. Reset de progreso
- En ajustes, ejecutar reset de progreso.
- Verificar que perfil/daily/stats vuelven a estado inicial.

8. Estabilidad general basica
- Navegar entre pantallas principales 2-3 veces.
- Jugar rapido en dos juegos distintos.
- Verificar ausencia de bloqueos, pantallas en blanco o errores visibles.

Resultado esperado:

- Sin crasheos.
- Sin bloqueos de navegacion.
- Progreso y preferencias persisten correctamente.

## 8) Roadmap inmediato tras baseline

Si release build sale bien:

1. Crear tag/commit de baseline estable.
2. Publicar RC interna para QA funcional corta.
3. Abrir siguiente ciclo de features pequenas sobre base estable.

Si release build falla:

1. Capturar task exacta que falla y log completo.
2. Clasificar: signing, manifest/resources, native clean, o dependency issue.
3. Corregir minimo viable (sin refactor masivo) y repetir validacion completa.

Que se puede empezar despues:

- Features incrementales en juegos/pantallas sin tocar arquitectura base.
- Mas tests de regresion en storage/gamification.

Que no tocar todavia:

- No introducir backend/autenticacion/sync cloud.
- No refactorizar masivamente storage ni navegacion.
- No cambiar New Architecture/Hermes sin ticket de hardening dedicado.
