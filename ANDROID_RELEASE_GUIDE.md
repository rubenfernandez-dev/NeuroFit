# NeuroFit - Guia Operativa de Publicacion Android

Ultima actualizacion: 2026-04-11

---

## Estado del proyecto

- Package ID: `com.ruben.neurofit`
- Version: 1.0.0 (versionCode 1)
- New Architecture: activada (newArchEnabled=true)
- Hermes: activado
- R8/minify: activado para release desde 2026-04-11
- Plataforma objetivo: Android API 21+ (armeabi-v7a, arm64-v8a, x86, x86_64)

---

## 1. Requisitos previos

Antes de generar el build de release verifica que tienes:

- [ ] Java 17 o superior en PATH
- [ ] Android SDK instalado y ANDROID_HOME configurado
- [ ] Node.js >= 20 en PATH
- [ ] Keystore de subida: `android/keystores/neurofit-upload-key.jks` (ya existe en el repo)
- [ ] Las cuatro propiedades de firma disponibles (ver seccion 2)

---

## 2. Configuracion de firma

La firma del release se configura via propiedades Gradle. Opciones:

### Opcion A: variables de entorno en la sesion de terminal

```powershell
$env:ORG_GRADLE_PROJECT_NEUROFIT_UPLOAD_STORE_FILE    = "keystores/neurofit-upload-key.jks"
$env:ORG_GRADLE_PROJECT_NEUROFIT_UPLOAD_STORE_PASSWORD = "TU_CONTRASEÑA_DE_STORE"
$env:ORG_GRADLE_PROJECT_NEUROFIT_UPLOAD_KEY_ALIAS      = "TU_ALIAS"
$env:ORG_GRADLE_PROJECT_NEUROFIT_UPLOAD_KEY_PASSWORD   = "TU_CONTRASEÑA_DE_CLAVE"
```

### Opcion B: archivo local no versionado

Crear `android/gradle-signing.properties` (NO añadir a git):

```
NEUROFIT_UPLOAD_STORE_FILE=keystores/neurofit-upload-key.jks
NEUROFIT_UPLOAD_STORE_PASSWORD=TU_CONTRASEÑA_DE_STORE
NEUROFIT_UPLOAD_KEY_ALIAS=TU_ALIAS
NEUROFIT_UPLOAD_KEY_PASSWORD=TU_CONTRASEÑA_DE_CLAVE
```

Y en `android/gradle.properties` añadir al final:

```
# Local signing override (not committed):
# properties file loaded via -P or direct Gradle file()
```

O añadir directamente en el bloque `signingConfigs.release` en `build.gradle` localmente.

### Nota importante

Si las propiedades de firma NO estan disponibles durante el build, Gradle construye el AAB/APK sin firma de subida. El build no falla, pero el artefacto no es valido para Play Console.

---

## 3. Preflight (antes de cualquier build de release)

Ejecutar desde la raiz del repositorio:

```powershell
npm run test:run
npx tsc --noEmit
```

Criterio de aceptacion: 0 fallos en tests, 0 errores de typecheck.

---

## 4. Build de release

Ejecutar desde `android/`:

```powershell
cd android

# AAB (formato requerido por Play Console)
.\gradlew.bat bundleRelease

# APK (para smoke test en dispositivo local)
.\gradlew.bat assembleRelease
```

### Atencion: no usar `clean` como gate principal

```powershell
# EVITAR como paso de CI/release, puede fallar en clean nativo con New Architecture:
.\gradlew.bat clean bundleRelease

# Si necesitas forzar clean, usar solo:
.\gradlew.bat clean
# Y luego bundleRelease en invocacion separada
```

---

## 5. Validacion de artefactos

Tras el build, verificar existencia y fecha de:

```
android/app/build/outputs/bundle/release/app-release.aab
android/app/build/outputs/apk/release/app-release.apk
```

En PowerShell:

```powershell
Get-Item "android/app/build/outputs/bundle/release/app-release.aab" | Select-Object FullName, Length, LastWriteTime
Get-Item "android/app/build/outputs/apk/release/app-release.apk"   | Select-Object FullName, Length, LastWriteTime
```

Tamanios de referencia razonables:

- AAB: entre 25 MB y 80 MB dependiendo de assets y arquitecturas incluidas
- APK universal: puede ser mayor (incluye todas las arquitecturas)

---

## 6. Verificar firma del artefacto

```powershell
cd android
.\gradlew.bat signingReport
```

Localizar el bloque `Variant: release` en la salida. Verificar que:

- `Signing Config: release` (no `debug`)
- `Store: ...neurofit-upload-key.jks`
- `Alias: TU_ALIAS`
- El fingerprint SHA-1/SHA-256 coincide con el keystore registrado en Play Console

Si la salida muestra `Signing Config: null` o apunta al keystore de debug, las propiedades de firma no estan configuradas correctamente.

---

## 7. Verificar manifest mergeado final

El manifest mergeado de release esta en la ruta:

```
android/app/build/intermediates/merged_manifests/release/processReleaseMainManifest/AndroidManifest.xml
```

Si esa ruta no existe, buscar:

```powershell
Get-ChildItem -Path "android/app/build/intermediates" -Recurse -Filter "AndroidManifest.xml" |
  Where-Object FullName -like "*merged*" |
  Select-Object FullName, LastWriteTime
```

En el manifest mergeado confirmar:

- `android.permission.INTERNET` presente
- `android.permission.VIBRATE` presente
- `android.permission.POST_NOTIFICATIONS` presente (se declaró en src manifest; también puede venir de expo-notifications merge)
- `android:fullBackupContent="@xml/secure_store_backup_rules"` en `<application>`
- `android:dataExtractionRules="@xml/secure_store_data_extraction_rules"` en `<application>`
- Sin permisos sorpresa no esperados por el producto (revisar manualmente)

---

## 8. Smoke test obligatorio en dispositivo real

Instalar el APK release firmado en un dispositivo Android fisico:

```powershell
adb install -r "android/app/build/outputs/apk/release/app-release.apk"
```

Checklist de smoke test minimo:

- [ ] La app abre sin crasheo
- [ ] Home carga correctamente
- [ ] Jugar una partida completa en modo normal (cualquier juego)
- [ ] Completar el reto diario (3 etapas)
- [ ] XP/racha se actualizan en pantalla de progreso
- [ ] Leaderboard carga sin errores
- [ ] Ajustes: activar notificacion, cerrar y reabrir app; preferencia conservada
- [ ] Reset de progreso en ajustes no crashea
- [ ] Navegar 2-3 veces entre pantallas principales sin bloqueos
- [ ] Haptics y audio funcionan correctamente

### Smoke test especifico post-R8 (nuevo desde 2026-04-11)

Dado que minify/R8 se activo en esta version, verificar especificamente:

- [ ] `react-native-reanimated` animations funcionan (comparar con build debug)
- [ ] `react-native-worklets` no causa crash al abrir juegos que lo usen
- [ ] Notificaciones locales se programan y disparan correctamente
- [ ] Secure Store lee/escribe sin excepcion (datos de perfil, stats, estado de juegos)
- [ ] Sentry (si DSN esta configurado): los eventos llegan al dashboard

---

## 9. Preparar subida a Play Console

### Antes de subir

- [ ] Tener privacidad policy URL publica en HTTPS (requerida por Play Console)
- [ ] Haber completado Data Safety form en Play Console
- [ ] Tener feature graphic 1024x500 px listo (no esta en el repo, es asset humano)
- [ ] Tener al menos 2-4 screenshots de telefono listas
- [ ] Decidir si Sentry esta ON en produccion (ver PRIVACY.md)
- [ ] Confirmar que la descripcion de la app NO afirma:
  - Multiusuario global en tiempo real (el leaderboard es local/simulado)
  - Sincronizacion de perfil en la nube
  - Cuentas de usuario

### Pasos en Play Console

1. Abrir Play Console > Tu app > Produccion > Crear nueva version
2. Subir el archivo `app-release.aab`
3. Rellenar notas de version (primera version publica)
4. Completar o verificar: nombre de app, descripcion corta, descripcion larga
5. Subir iconos, feature graphic y screenshots
6. Revisar Content Rating (cuestionario IARC)
7. Revisar Data Safety (coherente con PRIVACY.md y manifest final)
8. Enviar a revision

---

## 10. Propiedades clave de Release Build

Para referencia, estas propiedades en `android/gradle.properties` controlan el release:

| Propiedad | Valor actual | Proposito |
|---|---|---|
| `android.enableMinifyInReleaseBuilds` | `true` | R8/ProGuard optimization (activo desde 2026-04-11) |
| `android.enableShrinkResourcesInReleaseBuilds` | `true` | Eliminar recursos no usados (activo desde 2026-04-11) |
| `android.enablePngCrunchInReleaseBuilds` | `true` | Comprimir PNGs en release |
| `newArchEnabled` | `true` | New React Native Architecture |
| `hermesEnabled` | `true` | Motor JS Hermes |
| `EX_DEV_CLIENT_NETWORK_INSPECTOR` | `false` | Inspector de red desactivado en release |
| `reactNativeArchitectures` | armeabi-v7a,arm64-v8a,x86,x86_64 | Todas las arquitecturas para Play Store |

---

## 11. Pendientes manuales que el repo no puede resolver

Estos requieren accion humana fuera del codigo:

| Pendiente | Impacto |
|---|---|
| Credentials de firma (NEUROFIT_UPLOAD_*) | Sin esto el AAB no esta firmado para Play Store |
| Privacy policy URL publica (HTTPS) | Obligatorio para Play Console |
| Feature graphic 1024x500 px | Obligatorio para listado en Play Store |
| Screenshots del telefono (minimo 2) | Obligatorio para listado en Play Store |
| Crear/completar ficha en Play Console | Prerequisito para publicacion |
| Data Safety form en Play Console | Obligatorio post-Android 13 |
| Decision sobre Sentry en produccion | Afecta Data Safety y privacidad |

---

## 12. Riesgos abiertos

| Riesgo | Probabilidad | Mitigacion |
|---|---|---|
| R8 rompe clase de worklets o reanimated | Baja (keep rules implementadas) | Smoke test completo obligatorio; si falla, deshabilitar minify temporalmente |
| `POST_NOTIFICATIONS` duplicado en manifest mergeado | Muy baja (merge deduplica) | Verificar manifest mergeado en paso 7 |
| Firma no configurada al hacer bundleRelease | Media | Verificar signingReport en paso 6 |
| Transitive permission inesperada de dependencias | Baja | Revisar manifest mergeado final |
