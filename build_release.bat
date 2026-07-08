@echo off
rem Release build: signed APK (sideload/testing) + AAB (Play Store upload).
rem
rem Windows MAX_PATH workaround: the checkout path is long enough that the
rem native (CMake/ninja) release build exceeds the 260-char path limit, so we
rem map the project folder to a virtual drive and build from there.
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
subst H: /d >nul 2>&1
subst H: "%~dp0."
if errorlevel 1 (
    echo Could not map drive H: - is it already in use?
    exit /b 1
)
pushd H:\android
echo Building APK (assembleRelease)...
call gradlew.bat assembleRelease
if errorlevel 1 popd & subst H: /d & exit /b 1
echo Building AAB (bundleRelease)...
call gradlew.bat bundleRelease
if errorlevel 1 popd & subst H: /d & exit /b 1
popd
subst H: /d
echo Done!
echo   APK: android\app\build\outputs\apk\release\app-release.apk
echo   AAB: android\app\build\outputs\bundle\release\app-release.aab
