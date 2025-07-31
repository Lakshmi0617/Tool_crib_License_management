# This is a sample Python script.

# Press Shift+F10 to execute it or replace it with your code.
# Press Double Shift to search everywhere for classes, files, tool windows, actions, and settings.

import logging
import uvicorn
import sys
import os
import platform
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
from starlette.responses import Response
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
import time
from cachetools import TTLCache, cached
from functools import lru_cache

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

# CORS configuration with proper preflight handling
origins = [

    "http://172.18.100.33:5173",  # Vite dev server
    "http://172.18.100.33",       # Production frontend
    "http://localhost:5173",      # Local development
    "http://localhost:8000",      # Local backend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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


# Include routers
app.include_router(register_router, prefix="", tags=["Authentication"])
app.include_router(tools_router, prefix="/api", tags=["Tools"])
app.include_router(tool_requests_router, prefix="/api", tags=["Tool Requests"])
app.include_router(tool_issues_router, prefix="/api", tags=["Tool Issues"])
app.include_router(tool_returns_router, prefix="/api", tags=["Tool Returns"])
app.include_router(new_tool_requests_router, tags=["New Tool Requests"])


@app.get("/", tags=["Health"])
def read_root():
    return {"message": "Welcome to ToolCrib API"}


@app.get("/health", tags=["Health"])
@lru_cache(maxsize=1)
async def health_check():
    return {"status": "ok", "message": "API is running"}


# Press the green button in the gutter to run the script.
if __name__ == "__main__":
    logger.info("Starting Tool Crib API Server")
    uvicorn.run(
        "main:app",
        host="172.18.100.33",
        port=8000,
        reload=True,
        workers=1,
        log_level="debug"
    )

# See PyCharm help at https://www.jetbrains.com/help/pycharm/