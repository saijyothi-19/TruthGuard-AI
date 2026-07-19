from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    phone: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class VerifyOTPRequest(BaseModel):
    username: str
    email_otp: str
    phone_otp: str

class UserOut(BaseModel):
    id: str
    username: str
    email: EmailStr
    phone: Optional[str] = None
    
    class Config:
        populate_by_name = True
