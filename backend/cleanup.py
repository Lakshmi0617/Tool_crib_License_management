import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import ToolsList

# Connect to database
conn = psycopg2.connect(
    user='postgres',
    password='12345678',
    host='localhost',
    database='postgres'
)

try:
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    
    # Drop tables if they exist
    cursor.execute('DROP TABLE IF EXISTS public.users CASCADE')
    cursor.execute('DROP TABLE IF EXISTS toolcrib.users CASCADE')
    
    # Recreate schema
    cursor.execute('DROP SCHEMA IF EXISTS toolcrib CASCADE')
    cursor.execute('CREATE SCHEMA toolcrib')
    
    print("Database cleaned successfully!")
finally:
    if 'cursor' in locals():
        cursor.close()
    conn.close()

def fix_tool_statuses():
    """Fix any invalid tool status values in the database"""
    try:
        # Create database engine and session
        engine = create_engine('postgresql://postgres:postgres@localhost:5432/postgres')
        Session = sessionmaker(bind=engine)
        session = Session()

        # Get all tools
        tools = session.query(ToolsList).all()
        fixed_count = 0

        # Fix invalid status values
        for tool in tools:
            old_status = tool.status
            # Set status based on quantity
            if tool.Quantity <= 0:
                tool.status = "Not Available"
            else:
                # If status is not one of the allowed values, set to available
                if tool.status not in ["available", "Not Available"]:
                    tool.status = "available"
            
            if old_status != tool.status:
                fixed_count += 1

        # Commit changes
        session.commit()
        print(f"Fixed {fixed_count} tool status values")

    except Exception as e:
        print(f"Error fixing tool statuses: {str(e)}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    fix_tool_statuses() 