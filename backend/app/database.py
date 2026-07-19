from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
import logging

logger = logging.getLogger(__name__)

client = None
db = None

async def init_db():
    global client, db
    try:
        logger.info(f"Connecting to MongoDB at: {settings.mongodb_uri}")
        client = AsyncIOMotorClient(settings.mongodb_uri)
        # Fallback to 'truthguard_db' if default database is not in connection string
        db_name = client.get_default_database().name if client.get_default_database() is not None else "truthguard_db"
        db = client[db_name]
        
        # Build indexes
        await db.users.create_index("username", unique=True)
        await db.users.create_index("email", unique=True)
        await db.scan_history.create_index("timestamp")
        await db.scan_history.create_index("source")
        await db.blacklist.create_index("value", unique=True)
        await db.whitelist.create_index("value", unique=True)
        
        logger.info("MongoDB initialized and indexes verified successfully.")
    except Exception as e:
        logger.error(f"Error initializing MongoDB: {e}")
        raise e

async def get_db():
    global db
    return db

async def close_db():
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed.")
