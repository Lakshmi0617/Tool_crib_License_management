import sys
import traceback

# Top-level exception hook to catch any error during imports or startup and keep console open
def uncaught_exception_handler(exctype, value, tb):
    print("\n" + "=" * 70)
    print(" [FATAL ERROR DETECTED ON STARTUP] ")
    print("=" * 70)
    traceback.print_exception(exctype, value, tb)
    print("=" * 70)
    print("\nPlease read the error traceback above to diagnose the issue.")
    input("\nPress ENTER to exit...")

sys.excepthook = uncaught_exception_handler

print("[1/5] Starting ToolCrib Application...")
import logging
import uvicorn
import os
import platform
import time

print("[2/5] Loading FastAPI & Core Dependencies...")
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
from starlette.responses import Response

print("[3/5] Loading Routers & Database Modules...")
from Register import router as register_router
from ToolsList import router as tools_router
from tool_requests import router as tool_requests_router
from tool_issues import router as tool_issues_router
from tool_returns import router as tool_returns_router
from new_tool_requests import router as new_tool_requests_router
from sqlalchemy import text
from db import engine, Base, db, setup_database, SessionLocal
from models import User, ToolsList
import new_tool_requests
from typing import Callable
from cachetools import TTLCache, cached
from functools import lru_cache

print("[4/5] Configuring Middleware & Application Routers...")

# Configure logging
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add the current directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

# Create response cache
response_cache = TTLCache(maxsize=100, ttl=5)  # Cache responses for 5 seconds


# Rate limiting middleware
class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
            self,
            app: FastAPI,
            calls: int = 50,  # Number of calls allowed
            window: int = 10  # Time window in seconds
    ):
        super().__init__(app)
        self.calls = calls
        self.window = window
        self.cache = TTLCache(maxsize=10000, ttl=window)

    async def dispatch(self, request: Request, call_next: Callable):
        # Get client IP
        client_ip = request.client.host

        # Get current timestamp
        now = time.time()

        # Get client's request history
        if client_ip in self.cache:
            history = self.cache[client_ip]
        else:
            history = []

        # Clean old requests from history
        history = [ts for ts in history if ts > now - self.window]

        # Check if rate limit is exceeded
        if len(history) >= self.calls:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"}
            )

        # Add current request to history
        history.append(now)
        self.cache[client_ip] = history

        # Process the request
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            logger.error(f"Request failed: {str(e)}")
            return JSONResponse(
                status_code=500,
                content={"detail": str(e)}
            )


# Create FastAPI app
app = FastAPI()

# CORS configuration with proper preflight handling for all local IPs
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Add Gzip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Add rate limiting with more permissive settings
app.add_middleware(RateLimitMiddleware, calls=500, window=60)  # 500 calls per minute

# Error handling middleware
@app.middleware("http")
async def error_handling_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        logger.error(f"Request failed: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": str(e)}
        )


# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    try:
        # Initialize database schema and tables
        setup_database()
        logger.info("Database tables created successfully")

        # Initialize Pony ORM
        from db import setup_pony
        setup_pony()
        logger.info("Database initialization completed successfully")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise e


from license_routes import router as license_router
from license_utils import get_all_system_mac_addresses, verify_license_key
from models import LicenseInfo

# License Verification Middleware
class LicenseCheckMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        path = request.url.path
        # Exempt public/health/license management endpoints from blocking
        exempt_paths = [
            "/", "/health", "/docs", "/openapi.json", "/redoc",
            "/api/license", "/companies"
        ]
        if any(path == p or path.startswith("/api/license") or path.startswith("/docs") for p in exempt_paths):
            return await call_next(request)
            
        # Verify active license in database
        try:
            db_session = SessionLocal()
            try:
                active_lic = db_session.query(LicenseInfo).filter(LicenseInfo.is_active == "yes").order_by(LicenseInfo.id.desc()).first()
                if not active_lic:
                    return JSONResponse(
                        status_code=403,
                        content={"detail": "Software License is missing or not activated.", "code": "LICENSE_INVALID"}
                    )
                macs = get_all_system_mac_addresses()
                is_valid, payload, msg, details = verify_license_key(active_lic.license_key, target_macs=macs)
                if not is_valid:
                    return JSONResponse(
                        status_code=403,
                        content={"detail": f"Software License Error: {msg}", "code": "LICENSE_EXPIRED"}
                    )
            finally:
                db_session.close()
        except Exception as e:
            logger.error(f"License check middleware error: {e}")
            
        return await call_next(request)


# Include routers
app.include_router(license_router)
app.include_router(register_router, prefix="", tags=["Authentication"])
app.include_router(tools_router, prefix="/api", tags=["Tools"])
app.include_router(tool_requests_router, prefix="/api", tags=["Tool Requests"])
app.include_router(tool_issues_router, prefix="/api", tags=["Tool Issues"])
app.include_router(tool_returns_router, prefix="/api", tags=["Tool Returns"])
app.include_router(new_tool_requests_router, tags=["New Tool Requests"])
app.add_middleware(LicenseCheckMiddleware)



@app.get("/", tags=["Health"])
def read_root():
    return {"message": "Welcome to ToolCrib API"}


@app.get("/health", tags=["Health"])
@lru_cache(maxsize=1)
async def health_check():
    return {"status": "ok", "message": "API is running"}


# Serve React frontend static assets when packaged/built
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

dist_dir = os.path.join(current_dir, "dist")
if not os.path.exists(dist_dir):
    dist_dir = os.path.abspath(os.path.join(current_dir, "..", "frontend", "dist"))

if os.path.exists(dist_dir):
    logger.info(f"Serving frontend static files from: {dist_dir}")
    assets_dir = os.path.join(dist_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", tags=["Frontend"])
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = os.path.join(dist_dir, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_dir, "index.html"))



import webbrowser
import threading

def open_browser():
    time.sleep(1.5)
    try:
        webbrowser.open("http://localhost:8000")
    except Exception as e:
        logger.warning(f"Could not automatically open browser: {e}")

if __name__ == "__main__":
    try:
        logger.info("Starting Tool Crib Application Server...")
        is_frozen = getattr(sys, 'frozen', False)
        
        if is_frozen:
            print("==================================================")
            print(" ToolCrib Application Server Starting...")
            print(" Access URL: http://localhost:8000")
            print("==================================================")
            # Auto open browser in packaged mode
            threading.Thread(target=open_browser, daemon=True).start()
            uvicorn.run(app, host="0.0.0.0", port=8000, reload=False, log_level="info")
        else:
            uvicorn.run("main:app", host="localhost", port=8000, reload=True, workers=1, log_level="debug")
    except Exception as ex:
        print("\n" + "="*50)
        print(f"FATAL ERROR ON STARTUP: {ex}")
        print("="*50 + "\n")
        input("Press Enter to exit...")


# See PyCharm help at https://www.jetbrains.com/help/pycharm/