from sqlalchemy import text
from db import engine

def update_all_tool_status():
    try:
        # SQL to update status based on Quantity
        update_sql = text("""
            UPDATE toolcrib.tools_list 
            SET status = CASE 
                WHEN Quantity > 0 THEN 'available'
                ELSE 'Not Available'
            END;
        """)
        
        with engine.begin() as connection:
            connection.execute(update_sql)
            print("✅ Successfully updated all tools status based on quantity")
            
    except Exception as e:
        print(f"❌ Error updating tool status: {str(e)}")

if __name__ == "__main__":
    update_all_tool_status() 