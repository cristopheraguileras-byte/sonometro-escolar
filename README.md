# Sonómetro Escolar — primera versión

Aplicación HTML/JavaScript que usa el micrófono para estimar niveles de ruido, mostrar un semáforo, registrar una muestra por segundo, resumir el tiempo por color y guardar sesiones localmente.

## Importante sobre los dB
Esta versión estima el nivel desde la señal digital del micrófono (`dBFS + ajuste`). **No es un sonómetro calibrado ni garantiza dB SPL reales.** El ajuste inicial es 90 dB y se puede modificar en Configuración y calibración, comparando con un sonómetro de referencia. Los micrófonos, controles automáticos y WebView de cada teléfono cambian la medición.

## Probar localmente en el navegador
El acceso al micrófono suele requerir HTTPS o localhost. No abras `index.html` como `file://`. Puedes subir el proyecto a GitHub y habilitar GitHub Pages, o usar un servidor local seguro.

## Crear el APK en Windows (opción recomendada: GitHub Actions)
1. Descomprime el ZIP.
2. Crea un repositorio en GitHub y sube todos los archivos de esta carpeta.
3. Abre **Actions** en el repositorio. El workflow `Build Android APK` compila el proyecto.
4. Cuando termine, abre la ejecución correcta y descarga el artefacto `Sonometro-Escolar-debug-apk`.
5. Descomprime el artefacto y copia `app-debug.apk` a tu teléfono.
6. Abre el APK en Android y autoriza la instalación desde esa fuente si el sistema lo solicita.

El workflow genera un APK debug para pruebas, instalable externamente. Para distribuirlo formalmente después, conviene generar una versión firmada de release.

## Compilar manualmente (opcional)
Instala Node.js 22, Java JDK 21 y Android Studio con Android SDK.
```bash
npm install
npx cap add android
npx cap sync android
```
En `android/app/src/main/AndroidManifest.xml`, confirma que exista:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```
Luego abre `android/` en Android Studio y compila la variante `debug`, o desde la carpeta `android` ejecuta `gradlew.bat assembleDebug`.

## Qué incluye
- Semáforo verde: <=45 dB estimados.
- Amarillo: >45 y <=70 dB estimados.
- Rojo: >70 dB estimados.
- Lectura y muestra cada segundo.
- Tiempo acumulado por color, promedio, mínimo y máximo.
- Gráfico de la sesión, historial local y exportación CSV.
- Ajuste de calibración.
