@echo off
set JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.17.10-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%
cd /d "C:\Applications\Habit tracker\HabitFlow"
echo Building APK (assembleRelease)...
call android\gradlew.bat -p android assembleRelease
echo Building AAB (bundleRelease)...
call android\gradlew.bat -p android bundleRelease
echo Done! APK and AAB built.
