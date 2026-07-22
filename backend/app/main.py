from contextlib import asynccontextmanager
import asyncio
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db, close_db, get_db
from app.routes import auth, scans, lists, whatsapp, feedback
import logging

# Configure logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

async def cleanup_unverified_users():
    """
    Background worker that runs every 60 seconds and deletes users 
    who registered but failed to verify within 15 minutes.
    """
    logger.info("Starting unverified users cleanup worker thread...")
    while True:
        try:
            db = await get_db()
            if db is not None:
                cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)
                result = await db.temp_users.delete_many({
                    "created_at": {"$lt": cutoff}
                })
                if result.deleted_count > 0:
                    logger.info(f"Cleanup Worker: Deleted {result.deleted_count} expired unverified accounts.")
        except asyncio.CancelledError:
            logger.info("Cleanup Worker: Stopping cleanup thread.")
            break
        except Exception as e:
            logger.error(f"Cleanup Worker error: {e}")
        
        await asyncio.sleep(60)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI Lifespan context manager that handles startup database initialization 
    and cleanup on application shutdown.
    """
    logger.info("Initializing TruthGuard AI API startup tasks...")
    await init_db()
    
    # Start the unverified users cleaner task
    cleanup_task = asyncio.create_task(cleanup_unverified_users())
    
    yield
    
    logger.info("Running TruthGuard AI API shutdown tasks...")
    cleanup_task.cancel()
    await close_db()

app = FastAPI(
    title="TruthGuard AI API",
    description="AI-Powered WhatsApp Fake News & Scam Detection Bot Backend API",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS for frontend dashboard communication
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",  # Allows all origins dynamically while supporting credentials
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register application routers under /api prefix
app.include_router(auth.router, prefix="/api")
app.include_router(scans.router, prefix="/api")
app.include_router(lists.router, prefix="/api")
app.include_router(whatsapp.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")

@app.get("/")
async def root():
    """
    Health check endpoint.
    """
    return {
        "status": "healthy",
        "service": "TruthGuard AI API",
        "version": "1.0.0"
    }
