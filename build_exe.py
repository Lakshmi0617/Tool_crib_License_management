"""
ToolCrib Automated EXE Build Script
This script:
1. Builds the React frontend (npm run build)
2. Copies frontend dist folder into backend/dist
3. Packages the Python FastAPI application into a standalone Windows EXE using PyInstaller
"""

import os
import shutil
import subprocess
import sys

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
BACKEND_DIST = os.path.join(BACKEND_DIR, "dist")
FRONTEND_BUILD = os.path.join(FRONTEND_DIR, "dist")

def run_cmd(cmd, cwd=None):
    print(f"--> Running: {cmd} (CWD: {cwd or os.getcwd()})")
    res = subprocess.run(cmd, shell=True, cwd=cwd)
    if res.returncode != 0:
        print(f"Error executing command: {cmd}")
        sys.exit(1)

def main():
    print("=== Step 1: Building React Frontend ===")
    run_cmd("npm run build", cwd=FRONTEND_DIR)

    print("=== Step 2: Copying Frontend dist to Backend ===")
    subprocess.run("taskkill /f /im ToolCribSoftware.exe", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.path.exists(BACKEND_DIST):
        try:
            shutil.rmtree(BACKEND_DIST)
        except Exception as e:
            print(f"Warning cleaning dist folder: {e}")
    shutil.copytree(FRONTEND_BUILD, BACKEND_DIST, dirs_exist_ok=True)
    print("Frontend assets copied successfully.")

    print("=== Step 3: Compiling Python Backend into Executable ===")
    venv_python = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe")
    venv_pyinstaller = os.path.join(BACKEND_DIR, "venv", "Scripts", "pyinstaller.exe")
    
    pyinstaller_bin = venv_pyinstaller if os.path.exists(venv_pyinstaller) else "pyinstaller"

    pyinstaller_cmd = (
        f'"{pyinstaller_bin}" --noconfirm --onedir --console '
        f'--name "ToolCribSoftware" '
        f'--add-data "{BACKEND_DIST};dist" '
        f'--add-data "{os.path.join(BACKEND_DIR, "ed25519_public.b64")};." '
        f'--add-data "{os.path.join(BACKEND_DIR, "public_key.pem")};." '
        f'--collect-submodules "pony" '
        f'--collect-submodules "passlib" '
        f'--collect-all "passlib" '
        f'--hidden-import "uvicorn" '
        f'--hidden-import "fastapi" '
        f'--hidden-import "psycopg2" '
        f'--hidden-import "pony" '
        f'--hidden-import "pony.orm.dbproviders" '
        f'--hidden-import "pony.orm.dbproviders.postgres" '
        f'--hidden-import "passlib" '
        f'--hidden-import "passlib.handlers" '
        f'--hidden-import "passlib.handlers.bcrypt" '
        f'--hidden-import "passlib.handlers.sha256_crypt" '
        f'--hidden-import "bcrypt" '
        f'--hidden-import "tkinter" '
        f'--hidden-import "tkinter.ttk" '
        f'--hidden-import "db_setup_gui" '
        f'--hidden-import "sqlalchemy" '
        f'--hidden-import "dotenv" '
        f'"{os.path.join(BACKEND_DIR, "main.py")}"'
    )
    run_cmd(pyinstaller_cmd, cwd=BACKEND_DIR)

    # Copy default .env file to the output directory
    target_env = os.path.join(BACKEND_DIR, "dist", "ToolCribSoftware", ".env")
    source_env = os.path.join(BACKEND_DIR, ".env")
    if os.path.exists(source_env):
        shutil.copyfile(source_env, target_env)
        print(f"Copied .env config to {target_env}")

    print("=== Step 4: Compiling NSIS Installer Executable ===")
    nsis_paths = [
        r"C:\Program Files (x86)\NSIS\makensis.exe",
        r"C:\Program Files\NSIS\makensis.exe",
        shutil.which("makensis")
    ]
    makensis_bin = next((p for p in nsis_paths if p and os.path.exists(p)), None)

    nsi_script = os.path.join(PROJECT_ROOT, "installer.nsi")

    if makensis_bin:
        print(f"Found NSIS Compiler at: {makensis_bin}")
        run_cmd(f'"{makensis_bin}" "{nsi_script}"', cwd=PROJECT_ROOT)
        setup_exe = os.path.join(PROJECT_ROOT, "ToolCrib_Setup.exe")
        print("\n=========================================")
        print("NSIS INSTALLER BUILD SUCCESSFUL!")
        print(f"Installer Executable Package created at:\n{setup_exe}")
        print("=========================================\n")
    else:
        print("\n[NOTICE] NSIS compiler (makensis.exe) was not detected in PATH or standard installation folders.")
        print(f"The frontend and backend have been successfully compiled into PyInstaller package:")
        print(f"  -> {os.path.join(BACKEND_DIR, 'dist', 'ToolCribSoftware')}")
        print(f"To build the final NSIS Setup .exe:")
        print(f"  1. Install NSIS from https://nsis.sourceforge.io/ (or via 'choco install nsis')")
        print(f"  2. Run: makensis installer.nsi")
        print("=========================================\n")

if __name__ == "__main__":
    main()

