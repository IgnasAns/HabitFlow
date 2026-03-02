@echo off
set JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.17.10-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%
cd /d "C:\Applications\Habit tracker\HabitFlow"
call android\gradlew.bat -p android assembleRelease
