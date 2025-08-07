import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api.db import init_db

async def main():
    try:
        await init_db()
        print("Database initialization completed successfully!")
    except Exception as e:
        print(f"Database initialization failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())