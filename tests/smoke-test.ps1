param([string]$OutputDirectory = "dist/WebHomeTV-站点列表")
$ErrorActionPreference = "Stop"
$out = (Resolve-Path $OutputDirectory).Path
$exe = Join-Path $out "启动站点列表.exe"
if (!(Test-Path $exe)) { throw "未找到程序入口：$exe" }
if (!(Test-Path (Join-Path $out "_internal/site_list.html"))) { throw "网页资源未被打入 _internal" }

$proc = Start-Process -FilePath $exe -WorkingDirectory $out -PassThru -WindowStyle Hidden
try {
    $ready = $false
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 500
        if ($proc.HasExited) { throw "程序提前退出，ExitCode=$($proc.ExitCode)" }
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:9981/api/health" -TimeoutSec 2
            if ($health.ok -eq $true) { $ready = $true; break }
        } catch { }
    }
    if (!$ready) { throw "EXE 启动后未能在 20 秒内响应健康检查接口" }

    $page = Invoke-WebRequest -Uri "http://127.0.0.1:9981/" -UseBasicParsing -TimeoutSec 5
    if ($page.StatusCode -ne 200 -or $page.Content -notmatch "站点列表") { throw "首页加载检查失败" }
    if (!(Test-Path (Join-Path $out "data/site_list.db"))) { throw "未在 EXE 同级 data 目录生成独立数据库" }
    Write-Host "Windows EXE 冒烟测试通过：健康接口、首页和本机数据库均正常。"
}
finally {
    if (!$proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
}
