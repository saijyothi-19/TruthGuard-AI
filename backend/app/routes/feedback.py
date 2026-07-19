from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies.auth import get_current_user
from app.database import get_db
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/feedback", tags=["Feedback System"])

class FeedbackCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str = Field(..., min_length=2, max_length=2000)

def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Admin role required."
        )
    return current_user

@router.post("")
async def create_feedback(feedback: FeedbackCreate, current_user: dict = Depends(get_current_user)):
    db = await get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
        
    doc = {
        "username": current_user.get("username"),
        "email": current_user.get("email"),
        "rating": feedback.rating,
        "comment": feedback.comment.strip(),
        "created_at": datetime.now(timezone.utc)
    }
    
    try:
        res = await db.feedback.insert_one(doc)
        doc["id"] = str(res.inserted_id)
        if "_id" in doc:
            del doc["_id"]
            
        # Send Feedback Thank You Email
        try:
            from app.services.notification import send_feedback_thank_you_email
            send_feedback_thank_you_email(current_user.get("email"), current_user.get("username"))
        except Exception as f_err:
            logger.error(f"Failed to send feedback thank-you email: {f_err}")
            
        return {"status": "success", "message": "Feedback submitted successfully!", "data": doc}
    except Exception as e:
        logger.error(f"Error creating feedback: {e}")
        raise HTTPException(status_code=500, detail="Failed to save feedback.")

@router.get("")
async def get_all_feedback(current_user: dict = Depends(require_admin)):
    db = await get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
        
    try:
        cursor = db.feedback.find().sort("created_at", -1)
        docs = await cursor.to_list(length=500)
        # Serialize ObjectIds
        for d in docs:
            d["id"] = str(d["_id"])
            del d["_id"]
            # Convert datetime to string for clean JSON serialization
            if "created_at" in d and isinstance(d["created_at"], datetime):
                d["created_at"] = d["created_at"].isoformat()
        return docs
    except Exception as e:
        logger.error(f"Error fetching feedback: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch feedback logs.")
