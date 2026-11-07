from __future__ import annotations

import json
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path
from urllib.parse import urlparse

import httpx
import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from webhtv.db import connect, init_db

APP_VERSION = "1.0.1"
HOST = "127.0.0.1"
PORT = 9981

# PyInstaller onedir stores bundled read-only resources in _internal (sys._MEIPASS).
# User data must stay beside the EXE so it survives upgrades and remains portable.
if getattr(sys, "frozen", False):
    APP_DIR = Path(sys.executable).resolve().parent
    RESOURCE_DIR = Path(getattr(sys, "_MEIPASS", APP_DIR))
else:
    APP_DIR = Path(__file__).resolve().parent
    RESOURCE_DIR = APP_DIR

PAGE_FILE = RESOURCE_DIR / "site_list.html"

app = FastAPI(
    title="WebHomeTV 站点列表独立版",
    version=APP_VERSION,
    docs_url=None,
    redoc_url=None,
)


class ImportUrl(BaseModel):
    url: str
    userAgent: str = "WebHomeTV-Windows/0.1"
    referer: str = ""
    headers: dict[str, str] = Field(default_factory=dict)
    name: str = ""
    timeout: int = 30


class ConfigBody(BaseModel):
    config: dict
    name: str = "本地配置"
    source_url: str = ""


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    try:
        return PAGE_FILE.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise HTTPException(500, "网页资源缺失：请保持完整的绿色版文件夹，不要单独移动 EXE")


def active_config():
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM configs WHERE active=1 ORDER BY id DESC LIMIT 1"
        ).fetchone()
    return dict(row) if row else None


def payload_of(row):
    if not row:
        return {}
    try:
        return json.loads(row.get("payload") or "{}")
    except (TypeError, json.JSONDecodeError):
        return {}


def save_config(config: dict, name: str = "本地配置", source_url: str = ""):
    if not isinstance(config, dict):
        raise HTTPException(400, "配置根节点必须是 JSON 对象")
    sites = config.get("sites", [])
    if not isinstance(sites, list):
        raise HTTPException(400, "配置中的 sites 必须是数组")
    with connect() as conn:
        conn.execute("UPDATE configs SET active=0")
        cur = conn.execute(
            "INSERT INTO configs(name,source_url,payload,active) VALUES(?,?,?,1)",
            (name or "本地配置", source_url, json.dumps(config, ensure_ascii=False)),
        )
        config_id = cur.lastrowid
    return {"ok": True, "id": config_id, "name": name or "本地配置", "siteCount": len(sites)}


@app.get("/api/config/status")
def config_status():
    row = active_config()
    cfg = payload_of(row)
    sites = cfg.get("sites", []) if isinstance(cfg, dict) else []
    return {
        "loaded": bool(row),
        "name": row.get("name") if row else "",
        "sourceUrl": row.get("source_url") if row else "",
        "siteCount": len(sites) if isinstance(sites, list) else 0,
    }


@app.post("/api/config/import-file")
async def import_file(file: UploadFile = File(...)):
    raw = await file.read()
    try:
        cfg = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(400, f"JSON 解析失败：{exc}")
    return save_config(cfg, Path(file.filename or "本地配置.json").stem)


@app.post("/api/config/import-url")
async def import_url(body: ImportUrl):
    url = body.url.strip()
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(400, "请输入完整的 http/https 订阅地址")

    headers = {str(k): str(v) for k, v in (body.headers or {}).items()}
    if body.userAgent.strip() and not any(k.lower() == "user-agent" for k in headers):
        headers["User-Agent"] = body.userAgent.strip()
    if body.referer.strip() and not any(k.lower() == "referer" for k in headers):
        headers["Referer"] = body.referer.strip()
    headers.setdefault("Accept", "application/json, text/plain, */*")

    try:
        timeout = max(5, min(int(body.timeout), 120))
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=timeout, trust_env=True
        ) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            cfg = response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(502, f"订阅服务器返回 HTTP {exc.response.status_code}")
    except (httpx.HTTPError, json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(502, f"订阅读取失败：{type(exc).__name__}: {exc}")

    if not isinstance(cfg, dict):
        raise HTTPException(400, "远程响应不是 JSON 对象")
    name = body.name.strip() or parsed.hostname or "网络配置"
    return save_config(cfg, name, url)


@app.post("/api/config/set")
def config_set(body: ConfigBody):
    return save_config(body.config, body.name, body.source_url)


@app.get("/api/config/current")
def current_config():
    row = active_config()
    return {"loaded": bool(row), "config": payload_of(row) if row else None}


def sites_now():
    cfg = payload_of(active_config())
    sites = cfg.get("sites", []) if isinstance(cfg, dict) else []
    return sites if isinstance(sites, list) else []


@app.get("/api/sites")
def list_sites():
    sites = sites_now()
    return {"sites": sites, "total": len(sites)}


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "version": APP_VERSION,
        "siteCount": len(sites_now()),
    }


def open_browser_when_ready() -> None:
    import urllib.request

    target = f"http://{HOST}:{PORT}/"
    health_url = f"http://{HOST}:{PORT}/api/health"
    for _ in range(60):
        try:
            with urllib.request.urlopen(health_url, timeout=1) as response:
                if response.status == 200:
                    webbrowser.open_new_tab(target)
                    return
        except Exception:
            time.sleep(0.5)


def main() -> int:
    # Ensure errors from a double-clicked EXE remain visible in its console.
    (APP_DIR / "data").mkdir(parents=True, exist_ok=True)
    init_db()

    # Fail clearly instead of silently opening a blank page when the port is occupied.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind((HOST, PORT))
        except OSError:
            print(f"端口 {PORT} 已被占用。请关闭已经运行的站点列表，或释放该端口后重试。")
            input("按回车键退出……")
            return 2

    print("WebHomeTV 站点列表独立版正在启动……")
    print(f"本地网页：http://{HOST}:{PORT}/")
    print(f"本机数据目录：{APP_DIR / 'data'}")
    threading.Thread(target=open_browser_when_ready, daemon=True).start()
    try:
        uvicorn.run(app, host=HOST, port=PORT, reload=False, log_level="warning")
    except Exception as exc:
        print(f"启动失败：{type(exc).__name__}: {exc}")
        input("按回车键退出……")
        return 1
    return 0


if __name__ == "__main__":
    if getattr(sys, "frozen", False):
        import multiprocessing
        multiprocessing.freeze_support()
    raise SystemExit(main())
