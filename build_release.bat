@echo off
rem Release build: signed APK (sideload/testing) + AAB (Play Store upload).
rem Uses the Android Studio bundled JDK and resolves the project dir from
rem this script's own location, so it works from any checkout path.
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "%~dp0"
echo Building APK (assembleRelease)...
call android\gradlew.bat -p android assembleRelease
if errorlevel 1 exit /b 1
echo Building AAB (bundleRelease)...
call android\gradlew.bat -p android bundleRelease
if errorlevel 1 exit /b 1
echo Done!
echo   APK: android\app\build\outputs\apk\release\app-release.apk
echo   AAB: android\app\build\outputs\bundle\release\app-release.aab
