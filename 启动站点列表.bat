@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "启动站点列表.exe" (
  echo 找不到 启动站点列表.exe。请先取得完整的 Windows x64 绿色版构建产物。
  pause
  exit /b 1
)
start "WebHomeTV 站点列表" "%~dp0启动站点列表.exe"
