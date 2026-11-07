# PyInstaller Windows x64 onedir build. The resulting EXE is placed beside _internal.
from PyInstaller.utils.hooks import collect_all

_datas = [("site_list.html", ".")]
_binaries = []
_hidden = [
    "uvicorn.logging", "uvicorn.loops.auto", "uvicorn.loops.asyncio",
    "uvicorn.protocols.http.auto", "uvicorn.protocols.http.h11_impl",
    "uvicorn.lifespan.on", "multipart", "multipart.multipart",
]

for package in [
    "fastapi", "starlette", "uvicorn", "httpx", "httpcore", "anyio",
    "certifi", "idna", "sniffio", "h11", "click", "multipart", "pydantic",
    "pydantic_core", "annotated_types", "typing_extensions",
]:
    try:
        datas, binaries, hidden = collect_all(package)
        _datas += datas
        _binaries += binaries
        _hidden += hidden
    except Exception:
        # Optional package data may not exist in every pinned package release.
        pass

_analysis = Analysis(
    ["server.py"], pathex=["."], binaries=_binaries, datas=_datas,
    hiddenimports=sorted(set(_hidden)), hookspath=[], hooksconfig={},
    runtime_hooks=[], excludes=["tkinter", "pytest", "IPython", "notebook"],
    noarchive=False,
)
_pyz = PYZ(_analysis.pure)
_exe = EXE(
    _pyz, _analysis.scripts, [], exclude_binaries=True,
    name="启动站点列表", debug=False, bootloader_ignore_signals=False,
    strip=False, upx=False, console=True,
    disable_windowed_traceback=False,
)
_coll = COLLECT(
    _exe, _analysis.binaries, _analysis.datas,
    strip=False, upx=False, name="WebHomeTV-站点列表",
)
