@echo off

git add .

timeout /t 3 /nobreak >nul

git commit --allow-empty -m "new"

timeout /t 1 /nobreak >nul

git push origin main

timeout /t 3 /nobreak >nul

echo Fertig.
