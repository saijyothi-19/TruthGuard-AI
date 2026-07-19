from datetime import datetime, timedelta, timezone
from typing import Union, Any
from jose import jwt
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """
    Hash a plaintext password using bcrypt.
    """
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against the hashed password.
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False

def create_access_token(subject: Union[str, Any], role: str = "user", expires_delta: timedelta = None) -> str:
    """
    Generate a JWT token for the authenticated user subject with their role.
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode = {"exp": int(expire.timestamp()), "sub": str(subject), "role": role}
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt

def decode_access_token(token: str) -> Union[str, None]:
    """
    Decode and validate a JWT access token, returning the subject (username) if valid.
    """
    try:
        decoded_token = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        # jose.jwt library handles exp validation, but we can verify it as well
        exp = decoded_token.get("exp")
        if exp and exp < datetime.now(timezone.utc).timestamp():
            return None
        return decoded_token.get("sub")
    except Exception:
        return None
