import sqlite3
from pathlib import Path
import sys
import os

# Add the src directory to the path so we can import from api
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from api.config import sqlite_db_path, posts_table_name, users_table_name

def add_moderation_schema():
    """Add moderation-related tables and columns to the database"""
    
    print(f"Using database path: {sqlite_db_path}")
    
    with sqlite3.connect(sqlite_db_path) as conn:
        cursor = conn.cursor()
        
        # Check if posts table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='posts'")
        if not cursor.fetchone():
            print("Posts table does not exist. Please run the main database initialization first.")
            return
        
        # Check if moderation_status column already exists in posts table
        cursor.execute(f"PRAGMA table_info({posts_table_name})")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'moderation_status' not in columns:
            try:
                cursor.execute(f"ALTER TABLE {posts_table_name} ADD COLUMN moderation_status TEXT DEFAULT 'pending'")
                print("Added moderation_status column to posts table")
            except sqlite3.OperationalError as e:
                print(f"Error adding moderation_status column: {e}")
        else:
            print("moderation_status column already exists in posts table")
        
        # Create moderation_logs table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS moderation_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content_type TEXT NOT NULL,
                content_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                is_flagged BOOLEAN NOT NULL,
                severity TEXT NOT NULL,
                reason TEXT NOT NULL,
                action TEXT NOT NULL,
                confidence REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        print("Created/verified moderation_logs table")
        
        # Create index for faster queries
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_moderation_logs_content 
            ON moderation_logs (content_type, content_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_moderation_logs_user 
            ON moderation_logs (user_id)
        """)
        
        conn.commit()
        print("Moderation schema setup completed successfully!")

if __name__ == "__main__":
    add_moderation_schema()