# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules
from PyInstaller.utils.hooks import collect_all

datas = [('L:/Inventory_management/ToolCrib_SOFTWARE/backend/dist', 'dist'), ('L:/Inventory_management/ToolCrib_SOFTWARE/backend/ed25519_public.b64', '.'), ('L:/Inventory_management/ToolCrib_SOFTWARE/backend/public_key.pem', '.')]
binaries = []
hiddenimports = ['uvicorn', 'fastapi', 'psycopg2', 'pony', 'pony.orm.dbproviders', 'pony.orm.dbproviders.postgres', 'passlib', 'passlib.handlers', 'passlib.handlers.bcrypt', 'passlib.handlers.sha256_crypt', 'bcrypt', 'tkinter', 'tkinter.ttk', 'db_setup_gui', 'sqlalchemy', 'dotenv']
hiddenimports += collect_submodules('pony')
hiddenimports += collect_submodules('passlib')
tmp_ret = collect_all('passlib')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]


a = Analysis(
    ['L:/Inventory_management/ToolCrib_SOFTWARE/backend/main.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='ToolCribSoftware',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='ToolCribSoftware',
)
