from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies.auth import get_current_user
from app.database import get_db
from app.schemas.scans import URLScanRequest, MessageScanRequest, ScanResultResponse, HistoryResponse, AnalyticsResponse
from app.services.scan_manager import scan_url_flow, scan_message_flow
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scans", tags=["Scans & Analytics"])

def serialize_scan(doc) -> dict:
    # Handle both Mongo dict insertion result vs standard dict
    doc_id = str(doc.get("_id")) if "_id" in doc else doc.get("id", "mock_id")
    
    timestamp = doc.get("timestamp", datetime.now(timezone.utc))
    if isinstance(timestamp, datetime) and timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
        
    return {
        "id": doc_id,
        "type": doc.get("type", "url"),
        "content": doc.get("content", ""),
        "risk_score": float(doc.get("risk_score", 0.0)),
        "classification": doc.get("classification", "Unverified Link"),
        "threat_level": doc.get("threat_level", "Yellow"),
        "explanation": doc.get("explanation", ""),
        "source": doc.get("source", "dashboard"),
        "timestamp": timestamp,
        "details": doc.get("details"),
        "username": doc.get("username"),
        "email": doc.get("email")
    }

@router.post("/scan-url", response_model=ScanResultResponse)
async def scan_url(payload: URLScanRequest, current_user: dict = Depends(get_current_user)):
    try:
        res = await scan_url_flow(payload.url, source="dashboard", username=current_user["username"])
        return serialize_scan(res)
    except Exception as e:
        logger.error(f"Error in scan-url endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/public-scan-url", response_model=ScanResultResponse)
async def public_scan_url(payload: URLScanRequest):
    try:
        res = await scan_url_flow(payload.url, source="chrome_extension", username="extension_user")
        return serialize_scan(res)
    except Exception as e:
        logger.error(f"Error in public-scan-url endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scan-message", response_model=ScanResultResponse)
async def scan_message(payload: MessageScanRequest, current_user: dict = Depends(get_current_user)):
    try:
        res = await scan_message_flow(payload.message, source="dashboard", username=current_user["username"])
        return serialize_scan(res)
    except Exception as e:
        logger.error(f"Error in scan-message endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history", response_model=HistoryResponse)
async def get_history(limit: int = 50, skip: int = 0, current_user: dict = Depends(get_current_user)):
    db = await get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
        
    try:
        query = {}
        if current_user.get("role") != "admin":
            query = {"username": current_user["username"]}
            
        cursor = db.scan_history.find(query).sort("timestamp", -1).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        total = await db.scan_history.count_documents(query)
        
        # Build user email map for on-the-fly backfill of older records
        users_cursor = db.users.find({}, {"username": 1, "email": 1})
        users_list = await users_cursor.to_list(length=1000)
        user_email_map = {u["username"]: u["email"] for u in users_list if "username" in u and "email" in u}
        
        for d in docs:
            if "username" in d and d["username"] and not d.get("email"):
                d["email"] = user_email_map.get(d["username"])
                
        scans = [serialize_scan(d) for d in docs]
        return {"scans": scans, "total": total}
    except Exception as e:
        logger.error(f"Error listing scan history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch history")

@router.get("/reports/{scan_id}", response_model=ScanResultResponse)
async def get_report(scan_id: str, current_user: dict = Depends(get_current_user)):
    db = await get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
        
    try:
        doc = await db.scan_history.find_one({"_id": ObjectId(scan_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Scan threat report not found")
            
        if current_user.get("role") != "admin" and doc.get("username") != current_user["username"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this report")
            
        if "username" in doc and doc["username"] and not doc.get("email"):
            user_doc = await db.users.find_one({"username": doc["username"]}, {"email": 1})
            if user_doc:
                doc["email"] = user_doc.get("email")
                
        return serialize_scan(doc)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error looking up threat report: {e}")
        raise HTTPException(status_code=400, detail="Invalid threat report ID format")

@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(current_user: dict = Depends(get_current_user)):
    db = await get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
        
    try:
        class_counts = {
            "Trusted Website": 0, "Safe Message": 0, "Suspicious Link": 0,
            "Suspicious Message": 0, "Scam Message": 0, "Phishing Website": 0,
            "Malicious URL": 0, "Fake News": 0
        }
        threat_level_counts = {"Green": 0, "Yellow": 0, "Orange": 0, "Red": 0, "Dark Red": 0}
        source_counts = {"whatsapp": 0, "dashboard": 0}
        
        query = {}
        if current_user.get("role") != "admin":
            query = {"username": current_user["username"]}

        cursor = db.scan_history.find(query)
        docs = await cursor.to_list(length=1000)
        total_scans = len(docs)
        
        for d in docs:
            cls = d.get("classification", "Unverified Link")
            tl = d.get("threat_level", "Yellow")
            src = d.get("source", "dashboard")
            
            class_counts[cls] = class_counts.get(cls, 0) + 1
            threat_level_counts[tl] = threat_level_counts.get(tl, 0) + 1
            source_counts[src] = source_counts.get(src, 0) + 1

        scans_over_time = []
        today = datetime.now(timezone.utc).date()
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            day_str = day.strftime("%b %d")
            scans_over_time.append({"name": day_str, "scans": 0, "threats": 0})
            
        for d in docs:
            dt = d.get("timestamp")
            if dt:
                # Make timezone-naive for comparison
                dt_naive = dt.astimezone(timezone.utc).date() if dt.tzinfo else dt.date()
                for pt in scans_over_time:
                    # Match by parsing month and day
                    day_parsed = datetime.strptime(pt["name"] + f" {today.year}", "%b %d %Y").date()
                    if day_parsed == dt_naive:
                        pt["scans"] += 1
                        if d.get("risk_score", 0.0) > 30:
                            pt["threats"] += 1
                            
        # Dynamic Fallback Mock Data if fresh database setup
        if total_scans == 0 and current_user.get("role") == "admin":
            total_scans = 28
            class_counts = {
                "Trusted Website": 12, "Safe Message": 4, "Suspicious Link": 5,
                "Suspicious Message": 0, "Scam Message": 4, "Phishing Website": 2,
                "Malicious URL": 0, "Fake News": 1
            }
            threat_level_counts = {"Green": 16, "Yellow": 5, "Orange": 4, "Red": 2, "Dark Red": 1}
            source_counts = {"whatsapp": 20, "dashboard": 8}
            for idx, pt in enumerate(scans_over_time):
                pt["scans"] = [2, 4, 3, 5, 4, 6, 4][idx]
                pt["threats"] = [0, 1, 1, 2, 1, 2, 1][idx]

        return {
            "total_scans": total_scans,
            "classification_counts": class_counts,
            "threat_level_counts": threat_level_counts,
            "source_counts": source_counts,
            "scans_over_time": scans_over_time
        }
    except Exception as e:
        logger.error(f"Error computing scan analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to load analytics")

@router.get("/dataset-preview")
async def get_dataset_preview(type: str = "url", limit: int = 100, skip: int = 0):
    """
    Returns a paginated preview of the training datasets (url or message).
    """
    import csv
    ml_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "ml"))
    
    if type == "url":
        csv_path = os.path.join(ml_dir, "data", "url_dataset.csv")
    elif type == "message":
        csv_path = os.path.join(ml_dir, "data", "message_dataset.csv")
    else:
        raise HTTPException(status_code=400, detail="Invalid dataset type. Must be 'url' or 'message'")
        
    if not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail=f"Dataset file {type}_dataset.csv not found. Please train models first.")
        
    try:
        records = []
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader) # Read header
            
            # Skip rows
            for _ in range(skip):
                try:
                    next(reader)
                except StopIteration:
                    break
                    
            # Read limit rows
            for _ in range(limit):
                try:
                    row = next(reader)
                    if type == "url":
                        records.append({"url": row[0], "label": int(row[1])})
                    else:
                        records.append({"text": row[0], "label": int(row[1])})
                except StopIteration:
                    break
                    
        return {
            "type": type,
            "columns": header,
            "count": len(records),
            "data": records
        }
    except Exception as e:
        logger.error(f"Error reading dataset preview: {e}")
        raise HTTPException(status_code=500, detail=str(e))

