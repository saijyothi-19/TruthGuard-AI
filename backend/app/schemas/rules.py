from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class RuleCreate(BaseModel):
    value: str = Field(..., description="The domain name, IP, or phone number to filter")
    notes: Optional[str] = Field(None, description="Optional reasoning or notes")

class RuleOut(BaseModel):
    id: str
    type: str  # "blacklist" or "whitelist"
    value: str
    notes: str
    created_at: datetime
