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

from db_setup_gui import prompt_db_credentials

# Load environment variables from .env file if present
load_dotenv()

env_path = os.path.abspath(".env")

# Database configuration
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "root1234")
DB_NAME = os.getenv("DB_NAME", "ToolCrib_v1")

DATABASE_URL = os.getenv("DATABASE_URL", f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}")

def create_db_engine(retries=2, delay=1):
    global DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DATABASE_URL
    for attempt in range(retries):
        current_url = os.getenv("DATABASE_URL", f"postgresql://{os.getenv('DB_USER','postgres')}:{os.getenv('DB_PASSWORD','') }@{os.getenv('DB_HOST','localhost')}:{os.getenv('DB_PORT','5432')}/{os.getenv('DB_NAME','ToolCrib_v1')}")
        try:
            engine = create_engine(
                current_url,
                poolclass=QueuePool,
                pool_size=20,
                max_overflow=30,
                pool_timeout=30,
                pool_pre_ping=True,
                pool_recycle=3600,
                connect_args={'connect_timeout': 4}
            )
            engine.connect().close()
            logger.info("Database connection established successfully")
            return engine
        except Exception as e:
            logger.warning(f"Database connection attempt failed: {str(e)}")
            # Show GUI dialog for entering DB credentials
            print("\nDatabase connection could not be established.")
            print("Opening Database Credentials Configuration Window...")
            prompt_db_credentials(env_path)
            load_dotenv(override=True)
            DB_HOST = os.getenv("DB_HOST", "localhost")
            DB_PORT = os.getenv("DB_PORT", "5432")
            DB_USER = os.getenv("DB_USER", "postgres")
            DB_PASSWORD = os.getenv("DB_PASSWORD", "")
            DB_NAME = os.getenv("DB_NAME", "ToolCrib_v1")
            DATABASE_URL = os.getenv("DATABASE_URL", f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}")

    # Create final engine instance
    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_size=20,
        max_overflow=30,
        pool_timeout=30,
        pool_pre_ping=True
    )
    return engine

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