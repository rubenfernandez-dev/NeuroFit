# NeuroFit - Estado iOS y Preparacion App Store

Ultima actualizacion: 2026-04-11

---

## Estado actual

**iOS NO esta configurado. App Store no es posible en el estado actual del repo.**

---

## Hechos verificados (revisado el 2026-04-11)

| Item | Estado |
|---|---|
| Carpeta `ios/` | NO existe en el repositorio |
| `bundleIdentifier` en app.json | NO declarado |
| Xcode project / workspace | NO existe |
| Provisioning profiles / certificados | NO configurados |
| Build number en app.json | Declarado: `"1"` (no usado aun) |
| `supportsTablet: true` en app.json iOS section | Declarado por defecto, no validado |
| Splash y icono en assets | Presentes en assets/ (1024x1024) |

---

## Que falta para publicar en App Store

### Bloqueantes tecnicos (impiden build iOS)

| Bloqueante | Detalle |
|---|---|
| Mac con Xcode 15+ | Requisito de Apple; no hay alternativa sin EAS Build |
| Generar `ios/` folder | Requiere: `npx expo prebuild --platform ios` |
| `bundleIdentifier` en app.json | Debe añadirse antes del prebuild (ej: `com.ruben.neurofit`) |
| Apple Developer Program | Cuenta anual de 99 USD obligatoria para distribuir en App Store |
| Signing: Distribution Certificate + Provisioning Profile | Generados en Apple Developer portal |
| Configuracion de firma en Xcode | Despues del prebuild, abrir `ios/NeuroFit.xcworkspace` y configurar signing |

### Bloqueantes logisticos

| Bloqueante | Detalle |
|---|---|
| App Store Connect listing | Crear ficha de app en ASC con screenshots, descripcion, etc. |
| Revision de App Store | Apple puede tardar 1-3 dias habil en primera revision |
| Screenshots iPhone y iPad | Si `supportsTablet: true` se mantiene, exige screenshots de iPad tambien |

### Pendientes tecnicos menores (no bloquean el build pero son necesarios antes de publicar)

| Pendiente | Detalle |
|---|---|
| Revisar `supportsTablet: true` | Si no se quiere soporte iPad, cambiar a `false`; si se quiere, probar layout en iPad simulator |
| Info.plist / permisos iOS | expo-notifications y expo-haptics pueden añadir entries; revisar despues del prebuild |
| Notch / Dynamic Island / Safe Area | RN Safe Area Context ya esta instalado; validar visualmente en iPhone 14+ simulador |
| Probar en iOS simulator | Antes de archivar, ejecutar en al menos un simulator de iPhone y uno de iPad si aplica |

---

## Ruta completa para preparar iOS (resumen paso a paso)

Requisito previo: Mac con Xcode 15+ y cuenta Apple Developer.

```bash
# 1. Añadir bundleIdentifier al ios section de app.json:
#    "bundleIdentifier": "com.ruben.neurofit"

# 2. Generar la carpeta ios/ nativa
npx expo prebuild --platform ios

# 3. Instalar pods
cd ios && pod install && cd ..

# 4. Abrir en Xcode y configurar signing
open ios/NeuroFit.xcworkspace

# 5. En Xcode: seleccionar tu equipo de firma, provisioning profile automatico o manual

# 6. Build de release desde Xcode (Product > Archive)
#    O via linea de comandos:
npx expo run:ios --configuration Release

# 7. Desde Xcode Organizer: validate & distribute to App Store Connect
```

---

## Recomendacion

**No intentar preparar iOS hasta no tener acceso a Mac con Xcode.**

Si el objetivo inmediato es Play Store, publicar Android primero y abordar iOS en un ciclo posterior.

Para iOS, el trabajo minimo estimado antes de enviar a revision:
1. Añadir `bundleIdentifier` a app.json (5 min)
2. Prebuild + pod install + configurar signing en Xcode (1-2 horas)
3. Probar en simulator + smoke test en dispositivo fisico (2-4 horas)
4. Crear ficha en App Store Connect + subir screenshots (1-2 horas)
5. Enviar a revision (revision de Apple: 1-3 dias)
