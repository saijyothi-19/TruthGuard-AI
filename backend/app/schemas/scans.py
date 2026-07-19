from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class URLScanRequest(BaseModel):
    url: str

class MessageScanRequest(BaseModel):
    message: str

class ScanDetails(BaseModel):
    url_features: Optional[Dict[str, Any]] = None
    nlp_features: Optional[Dict[str, Any]] = None
    threat_intel: Optional[Dict[str, Any]] = None
    ssl_cert: Optional[Dict[str, Any]] = None
    whois_info: Optional[Dict[str, Any]] = None

class ScanResultResponse(BaseModel):
    id: str
    type: str  # "url" or "message"
    content: str
    risk_score: float
    classification: str
    threat_level: str  # Green, Yellow, Orange, Red, Dark Red
    explanation: str
    source: str  # "whatsapp" or "dashboard"
    timestamp: datetime
    details: Optional[ScanDetails] = None
    username: Optional[str] = None
    email: Optional[str] = None

class HistoryResponse(BaseModel):
    scans: List[ScanResultResponse]
    total: int

class MetricPoint(BaseModel):
    name: str
    count: int

class AnalyticsResponse(BaseModel):
    total_scans: int
    classification_counts: Dict[str, int]
    threat_level_counts: Dict[str, int]
    source_counts: Dict[str, int]
    scans_over_time: List[Dict[str, Any]]
