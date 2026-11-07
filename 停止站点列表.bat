@echo off
chcp 65001 >nul
taskkill /IM "启动站点列表.exe" /T /F >nul 2>nul
if errorlevel 1 (
  echo 当前没有运行中的站点列表程序。
) else (
  echo 已请求关闭站点列表程序。
)
timeout /t 2 >nul
