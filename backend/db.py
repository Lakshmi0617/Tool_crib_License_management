from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from pony.orm import Database, db_session
from sqlalchemy.pool import QueuePool
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import os
from dotenv import load_dotenv

# Load environment variables from .env file if present
load_dotenv()

# Database configuration
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "root1234")
DB_NAME = os.getenv("DB_NAME", "ToolCrib_v1")

# SQLAlchemy setup with optimized connection pooling
DATABASE_URL = os.getenv("DATABASE_URL", f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}")

def create_db_engine(retries=5, delay=2):
    for attempt in range(retries):
        try:
            engine = create_engine(
                DATABASE_URL,
                poolclass=QueuePool,
                pool_size=20,  # Maximum number of connections in the pool
                max_overflow=30,  # Maximum number of connections that can be created beyond pool_size
                pool_timeout=30,  # Timeout for getting a connection from the pool
                pool_pre_ping=True,  # Enable connection health checks
                pool_recycle=3600,  # Recycle connections after 1 hour
                connect_args={
                    'connect_timeout': 10,  # Connection timeout in seconds
                    'keepalives': 1,        # Enable TCP keepalive
                    'keepalives_idle': 30,  # Idle time before sending keepalive
                    'keepalives_interval': 10,  # Interval between keepalives
                    'keepalives_count': 5    # Number of keepalive attempts
                }
            )
            # Test the connection
            engine.connect().close()
            logger.info("Database connection established successfully")
            return engine
        except Exception as e:
            if attempt < retries - 1:
                logger.warning(f"Database connection attempt {attempt + 1} failed: {str(e)}")
                time.sleep(delay)
                continue
            else:
                logger.error(f"Failed to connect to database after {retries} attempts: {str(e)}")
                raise

# Create engine with retry logic
engine = create_db_engine()

# Create session factory with optimized settings
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False  # Prevent unnecessary database hits
)

Base = declarative_base()

# Pony ORM setup with consistent configuration
db = Database()
db.bind(
    provider='postgres',
    user=DB_USER,
    password=DB_PASSWORD,
    host=DB_HOST,
    port=int(DB_PORT),
    database=DB_NAME
)

def get_db():
    db = SessionLocal()
    try:
        # Test the connection before returning
        db.execute(text("SELECT 1"))
        yield db
    except Exception as e:
        logger.error(f"Database connection error: {str(e)}")
        raise
    finally:
        db.close()

# Generate Pony ORM mapping with optimized settings
def setup_database():
    try:
        # Create schema if it doesn't exist
        with engine.begin() as connection:
            connection.execute(text("CREATE SCHEMA IF NOT EXISTS toolcrib"))
            logger.info("Schema 'toolcrib' created or verified")

        # Import all models to ensure they are registered with SQLAlchemy
        from models import User, ToolsList, ToolRequest, ToolsReturned, ToolIssue, NewToolRequest, ActiveSession, Company

        # Drop all tables first (optional - uncomment if needed)
        # Base.metadata.drop_all(bind=engine)
        
        # Create all tables with SQLAlchemy
        Base.metadata.create_all(bind=engine)
        logger.info("SQLAlchemy tables created successfully")

        # Migrate missing columns for license_info and companies if tables already existed
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE toolcrib.license_info ADD COLUMN IF NOT EXISTS sha256_hash VARCHAR;"))
            connection.execute(text("ALTER TABLE toolcrib.license_info ADD COLUMN IF NOT EXISTS signature_ed25519 VARCHAR;"))
            connection.execute(text("ALTER TABLE toolcrib.license_info ADD COLUMN IF NOT EXISTS company_id INTEGER;"))
            connection.execute(text("ALTER TABLE toolcrib.companies ADD COLUMN IF NOT EXISTS project_name VARCHAR;"))
            logger.info("Database table columns migrated successfully")
    except Exception as e:
        logger.error(f"Error setting up database: {str(e)}")
        raise

def setup_pony():
    try:
        # Generate Pony ORM mapping
        if not db.schema:
            db.generate_mapping(create_tables=True)
            logger.info("Pony ORM mapping generated successfully")
    except Exception as e:
        logger.error(f"Error setting up Pony ORM: {str(e)}")
        raise

# Don't initialize tables immediately on import
# Instead, let main.py handle the initialization