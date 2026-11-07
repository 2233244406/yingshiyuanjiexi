from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
import sys

# 本机独立绿色版数据库固定放在 EXE 同级 data 目录，不读取虚拟机或原项目数据库。
APP_DIR = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parent.parent
DATA_DIR = APP_DIR / "data"
DB_PATH = DATA_DIR / "site_list.db"
DATA_DIR.mkdir(parents=True, exist_ok=True)


@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH, timeout=20)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=20000")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                source_url TEXT DEFAULT '',
                payload TEXT NOT NULL,
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_configs_active ON configs(active, id DESC)")
