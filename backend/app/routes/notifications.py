from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, Any, List
from app.dependencies.auth import get_current_user
from app.database import get_db
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["Notifications"])

class NotificationCreateRequest(BaseModel):
    title: str
    message: str
    resultData: Optional[Any] = None

def serialize_notif(doc) -> dict:
    timestamp = doc.get("timestamp", datetime.now(timezone.utc))
    if isinstance(timestamp, datetime) and timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)

    return {
        "id": str(doc.get("_id")) if "_id" in doc else doc.get("id"),
        "title": doc.get("title", ""),
        "message": doc.get("message", ""),
        "resultData": doc.get("resultData"),
        "timestamp": timestamp.isoformat(),
        "isRead": bool(doc.get("isRead", False)),
        "username": doc.get("username")
    }

@router.get("", response_model=List[dict])
async def get_notifications(current_user: dict = Depends(get_current_user)):
    db = await get_db()
    if db is None:
        return []
    try:
        cursor = db.notifications.find({"username": current_user["username"]}).sort("timestamp", -1).limit(50)
        docs = await cursor.to_list(length=50)
        return [serialize_notif(d) for d in docs]
    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        return []

@router.post("", response_model=dict)
async def create_notification(payload: NotificationCreateRequest, current_user: dict = Depends(get_current_user)):
    db = await get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    doc = {
        "title": payload.title,
        "message": payload.message,
        "resultData": payload.resultData,
        "timestamp": datetime.now(timezone.utc),
        "isRead": False,
        "username": current_user["username"]
    }
    
    try:
        res = await db.notifications.insert_one(doc)
        doc["_id"] = res.inserted_id
        return serialize_notif(doc)
    except Exception as e:
        logger.error(f"Error creating notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/read-all", response_model=dict)
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    db = await get_db()
    if db is None:
        return {"status": "ok"}
    try:
        await db.notifications.update_many(
            {"username": current_user["username"], "isRead": False},
            {"$set": {"isRead": True}}
        )
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error marking all notifications read: {e}")
        return {"status": "error"}

@router.put("/{notif_id}/read", response_model=dict)
async def mark_read(notif_id: str, current_user: dict = Depends(get_current_user)):
    db = await get_db()
    if db is None:
        return {"status": "ok"}
    try:
        from bson import ObjectId
        if ObjectId.is_valid(notif_id):
            await db.notifications.update_one(
                {"_id": ObjectId(notif_id), "username": current_user["username"]},
                {"$set": {"isRead": True}}
            )
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error marking notification read: {e}")
        return {"status": "error"}

@router.delete("", response_model=dict)
async def clear_all(current_user: dict = Depends(get_current_user)):
    db = await get_db()
    if db is None:
        return {"status": "ok"}
    try:
        await db.notifications.delete_many({"username": current_user["username"]})
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error clearing notifications: {e}")
        return {"status": "error"}
