from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies.auth import get_current_user
from app.database import get_db
from app.schemas.rules import RuleCreate, RuleOut
from bson import ObjectId
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/lists", tags=["Rules Management"])

def require_admin(current_user: dict = Depends(get_current_user)):
    """
    Dependency helper to enforce that the logged-in user is an admin.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Admin role required."
        )
    return current_user

def serialize_rule(doc, list_type: str) -> dict:
    return {
        "id": str(doc["_id"]),
        "type": list_type,
        "value": doc["value"],
        "notes": doc.get("notes", ""),
        "created_at": doc.get("created_at", datetime.now(timezone.utc))
    }

@router.get("/blacklist")
async def get_blacklist(current_user: dict = Depends(require_admin)):
    db = await get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
    try:
        cursor = db.blacklist.find().sort("created_at", -1)
        docs = await cursor.to_list(length=200)
        return [serialize_rule(d, "blacklist") for d in docs]
    except Exception as e:
        logger.error(f"Error fetching blacklist: {e}")
        raise HTTPException(status_code=500, detail="Failed to load blacklist")

@router.post("/blacklist")
async def add_to_blacklist(rule: RuleCreate, current_user: dict = Depends(require_admin)):
    db = await get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
    try:
        existing = await db.blacklist.find_one({"value": rule.value})
        if existing:
            raise HTTPException(status_code=400, detail="Value is already blacklisted")
            
        doc = {
            "value": rule.value.strip(),
            "notes": rule.notes or "",
            "created_at": datetime.now(timezone.utc)
        }
        res = await db.blacklist.insert_one(doc)
        doc["_id"] = res.inserted_id
        return serialize_rule(doc, "blacklist")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding to blacklist: {e}")
        raise HTTPException(status_code=500, detail="Failed to add to blacklist")

@router.delete("/blacklist/{rule_id}")
async def remove_from_blacklist(rule_id: str, current_user: dict = Depends(require_admin)):
    db = await get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
    try:
        res = await db.blacklist.delete_one({"_id": ObjectId(rule_id)})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Blacklist entry not found")
        return {"success": True, "message": "Blacklist entry removed successfully"}
    except Exception as e:
        logger.error(f"Error removing blacklist rule: {e}")
        raise HTTPException(status_code=400, detail="Invalid rule ID format or delete failed")

@router.get("/whitelist")
async def get_whitelist(current_user: dict = Depends(require_admin)):
    db = await get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
    try:
        cursor = db.whitelist.find().sort("created_at", -1)
        docs = await cursor.to_list(length=200)
        return [serialize_rule(d, "whitelist") for d in docs]
    except Exception as e:
        logger.error(f"Error fetching whitelist: {e}")
        raise HTTPException(status_code=500, detail="Failed to load whitelist")

@router.post("/whitelist")
async def add_to_whitelist(rule: RuleCreate, current_user: dict = Depends(require_admin)):
    db = await get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
    try:
        existing = await db.whitelist.find_one({"value": rule.value})
        if existing:
            raise HTTPException(status_code=400, detail="Value is already whitelisted")
            
        doc = {
            "value": rule.value.strip(),
            "notes": rule.notes or "",
            "created_at": datetime.now(timezone.utc)
        }
        res = await db.whitelist.insert_one(doc)
        doc["_id"] = res.inserted_id
        return serialize_rule(doc, "whitelist")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding to whitelist: {e}")
        raise HTTPException(status_code=500, detail="Failed to add to whitelist")

@router.delete("/whitelist/{rule_id}")
async def remove_from_whitelist(rule_id: str, current_user: dict = Depends(require_admin)):
    db = await get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
    try:
        res = await db.whitelist.delete_one({"_id": ObjectId(rule_id)})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Whitelist entry not found")
        return {"success": True, "message": "Whitelist entry removed successfully"}
    except Exception as e:
        logger.error(f"Error removing whitelist rule: {e}")
        raise HTTPException(status_code=400, detail="Invalid rule ID format or delete failed")
