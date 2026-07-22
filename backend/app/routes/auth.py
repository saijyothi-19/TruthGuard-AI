from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks
from app.database import get_db
from app.schemas.auth import UserRegister, UserLogin, Token, UserOut, VerifyOTPRequest
from app.security.auth_handler import hash_password, verify_password, create_access_token
from app.services.notification import generate_otp, send_email_otp, send_phone_otp, send_reset_email
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
import logging

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_code: str
    new_password: str = Field(..., min_length=6)

class LoginResponse(BaseModel):
    status: str
    username: str
    message: Optional[str] = None

class VerifyLoginOTPRequest(BaseModel):
    username: str
    email_otp: str
    phone_otp: str

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.get("/test-email")
async def test_email_diagnostics(email: str = "truthguardai22@gmail.com"):
    results = {}
    
    # 1. Test Brevo HTTP API
    if settings.brevo_api_key:
        try:
            from_email = settings.smtp_from if settings.smtp_from else settings.smtp_user
            if not from_email:
                from_email = "truthguardai22@gmail.com"
            headers = {"api-key": settings.brevo_api_key, "Content-Type": "application/json"}
            payload = {
                "sender": {"name": "TruthGuard AI Security", "email": from_email},
                "to": [{"email": email}],
                "subject": "TruthGuard Railway Brevo Test",
                "htmlContent": "<p>Test email from Railway via Brevo API</p>"
            }
            with httpx.Client(timeout=10.0) as client:
                res = client.post("https://api.brevo.com/v3/smtp/email", headers=headers, json=payload)
                results["brevo_api"] = {"status_code": res.status_code, "response": res.text}
        except Exception as e:
            results["brevo_api"] = {"error": str(e)}
    else:
        results["brevo_api"] = {"status": "skipped", "reason": "BREVO_API_KEY is not set in environment"}

    # 2. Test Resend HTTP API
    if settings.resend_api_key:
        try:
            headers = {"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"}
            payload = {
                "from": "TruthGuard AI <onboarding@resend.dev>",
                "to": [email],
                "subject": "TruthGuard Railway Resend Test",
                "html": "<p>Test email from Railway via Resend API</p>"
            }
            with httpx.Client(timeout=10.0) as client:
                res = client.post("https://api.resend.com/emails", headers=headers, json=payload)
                results["resend_api"] = {"status_code": res.status_code, "response": res.text}
        except Exception as e:
            results["resend_api"] = {"error": str(e)}
    else:
        results["resend_api"] = {"status": "skipped", "reason": "RESEND_API_KEY is not set in environment"}

    # 3. Test Gmail SSL (Port 465)
    if settings.smtp_user and settings.smtp_password:
        try:
            msg = MIMEText("Test email from Railway via Gmail SSL 465")
            msg["Subject"] = "TruthGuard Railway SSL 465 Test"
            msg["From"] = settings.smtp_user
            msg["To"] = email
            
            server = smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=5.0)
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_user, email, msg.as_string())
            server.quit()
            results["gmail_ssl_465"] = {"status": "success"}
        except Exception as e:
            results["gmail_ssl_465"] = {"error": str(e)}
            
        # 4. Test Gmail TLS (Port 587)
        try:
            msg = MIMEText("Test email from Railway via Gmail TLS 587")
            msg["Subject"] = "TruthGuard Railway TLS 587 Test"
            msg["From"] = settings.smtp_user
            msg["To"] = email
            
            server = smtplib.SMTP("smtp.gmail.com", 587, timeout=5.0)
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_user, email, msg.as_string())
            server.quit()
            results["gmail_tls_587"] = {"status": "success"}
        except Exception as e:
            results["gmail_tls_587"] = {"error": str(e)}
    else:
        results["gmail_smtp"] = {"status": "skipped", "reason": "SMTP_USER or SMTP_PASSWORD is not set"}

    return {"status": "diagnostics_complete", "environment_variables": {"smtp_user": settings.smtp_user, "has_smtp_password": bool(settings.smtp_password), "has_brevo_key": bool(settings.brevo_api_key), "has_resend_key": bool(settings.resend_api_key)}, "results": results}

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, background_tasks: BackgroundTasks):
    db = await get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
        
    # Check if user already exists (only verified users are in db.users now)
    existing_username = await db.users.find_one({"username": user_data.username})
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
        
    existing_email = await db.users.find_one({"email": user_data.email})
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Clean up any existing unverified registrations in temp_users
    await db.temp_users.delete_many({
        "$or": [
            {"username": user_data.username},
            {"email": user_data.email}
        ]
    })
        
    cleaned_phone = None
    if user_data.phone:
        cleaned_phone = "".join(c for c in user_data.phone if c.isdigit() or c == "+")
        if not cleaned_phone.strip():
            cleaned_phone = None

    # Determine role (sai1234 or first registered user is admin)
    user_count = await db.users.count_documents({})
    role = "user"
    if user_data.username.lower() == "sai1234" or user_count == 0:
        role = "admin"

    # Generate verification details
    email_otp = generate_otp()
    phone_otp = generate_otp() if cleaned_phone else "000000"
    otp_expiry = datetime.now(timezone.utc) + timedelta(minutes=15)

    # Create new temp user doc
    hashed_pwd = hash_password(user_data.password)
    user_doc = {
        "username": user_data.username,
        "email": user_data.email,
        "phone": cleaned_phone,
        "password_hash": hashed_pwd,
        "role": role,
        "email_otp": email_otp,
        "phone_otp": phone_otp,
        "otp_expiry": otp_expiry,
        "email_verified": False,
        "phone_verified": True if not cleaned_phone else False,
        "is_verified": False,
        "created_at": datetime.now(timezone.utc)
    }
    
    try:
        result = await db.temp_users.insert_one(user_doc)
        
        # Dispatch verification codes in background
        background_tasks.add_task(send_email_otp, user_data.email, email_otp)
        if cleaned_phone:
            background_tasks.add_task(send_phone_otp, cleaned_phone, phone_otp)
            
        return {
            "id": str(result.inserted_id),
            "username": user_data.username,
            "email": user_data.email,
            "phone": cleaned_phone
        }
    except Exception as e:
        logger.error(f"Error registering user: {e}")
        raise HTTPException(status_code=500, detail="Failed to save user details")

@router.post("/verify-otp")
async def verify_otp(payload: VerifyOTPRequest):
    db = await get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
        
    # Check if already verified
    existing_user = await db.users.find_one({"username": payload.username})
    if existing_user:
        return {"status": "success", "message": "Account is already verified"}

    # Find unverified user in temp_users
    user = await db.temp_users.find_one({"username": payload.username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found or code expired. Please register again.")
        
    expiry = user.get("otp_expiry")
    if expiry:
        # Pymongo returns timezone-naive or datetime in UTC, safely compare using naive comparison
        expiry_naive = expiry.replace(tzinfo=None)
        now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
        if expiry_naive < now_naive:
            # Clean up expired temp record
            await db.temp_users.delete_one({"_id": user["_id"]})
            raise HTTPException(status_code=400, detail="OTP codes have expired. Please register again.")
            
    # Verify Email OTP
    if user.get("email_otp") != payload.email_otp:
        raise HTTPException(status_code=400, detail="Invalid Email OTP code")
        
    # Verify Phone OTP if phone is registered and not verified yet
    if not user.get("phone_verified") and user.get("phone"):
        if user.get("phone_otp") != payload.phone_otp:
            raise HTTPException(status_code=400, detail="Invalid WhatsApp OTP code")
            
    # Move to users collection and delete from temp_users
    try:
        # Set verified flags
        user["email_verified"] = True
        user["phone_verified"] = True
        user["is_verified"] = True
        
        # Save to users collection
        await db.users.insert_one(user)
        # Delete from temp_users
        await db.temp_users.delete_one({"_id": user["_id"]})
        
        # Send Welcome Email
        try:
            from app.services.notification import send_welcome_email
            send_welcome_email(user["email"], user["username"])
        except Exception as welcome_err:
            logger.error(f"Failed to send welcome email: {welcome_err}")
        
        return {"status": "success", "message": "Account successfully verified! You can now log in."}
    except Exception as e:
        logger.error(f"Error verifying OTP: {e}")
        raise HTTPException(status_code=500, detail="Failed to save verification status")

@router.post("/login", response_model=LoginResponse)
async def login(credentials: UserLogin, background_tasks: BackgroundTasks):
    db = await get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
        
    # Find user by username
    user = await db.users.find_one({"username": credentials.username})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
        
    # Verify password
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
        
    # Check verification status
    if not user.get("is_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not verified. Please verify your email and WhatsApp phone number."
        )
        
    # Generate new login OTPs
    email_otp = generate_otp()
    phone_otp = generate_otp()
    expiry = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    try:
        await db.users.update_one(
            {"username": user["username"]},
            {"$set": {
                "login_email_otp": email_otp,
                "login_phone_otp": phone_otp,
                "login_otp_expiry": expiry
            }}
        )
        
        # Send codes in background
        background_tasks.add_task(send_email_otp, user["email"], email_otp)
        background_tasks.add_task(send_phone_otp, user["phone"], phone_otp)
        
        return {
            "status": "requires_otp",
            "username": user["username"],
            "message": "Verification codes sent to your registered email and WhatsApp."
        }
    except Exception as e:
        logger.error(f"Error initiating login MFA: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate multi-factor authentication.")

@router.post("/verify-login-otp", response_model=Token)
async def verify_login_otp(payload: VerifyLoginOTPRequest):
    db = await get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
        
    user = await db.users.find_one({"username": payload.username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    stored_email_otp = user.get("login_email_otp")
    stored_phone_otp = user.get("login_phone_otp")
    expiry = user.get("login_otp_expiry")
    
    if not stored_email_otp or not stored_phone_otp or not expiry:
        raise HTTPException(status_code=400, detail="No active login verification request found.")
        
    # Check expiry
    expiry_naive = expiry.replace(tzinfo=None)
    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    if expiry_naive < now_naive:
        raise HTTPException(status_code=400, detail="Verification codes have expired. Please log in again.")
        
    # Verify codes
    if stored_email_otp != payload.email_otp or stored_phone_otp != payload.phone_otp:
        raise HTTPException(status_code=400, detail="Incorrect email or WhatsApp verification code.")
        
    try:
        # Clear fields
        await db.users.update_one(
            {"username": user["username"]},
            {"$unset": {
                "login_email_otp": "",
                "login_phone_otp": "",
                "login_otp_expiry": ""
            }}
        )
        
        # Issue token with user's role
        token = create_access_token(subject=user["username"], role=user.get("role", "user"))
        return {
            "access_token": token,
            "token_type": "bearer"
        }
    except Exception as e:
        logger.error(f"Error finalizing login verification: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify credentials.")

@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    db = await get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
        
    user = await db.users.find_one({"email": payload.email})
    if not user:
        raise HTTPException(status_code=404, detail="No registered account found with this email address.")
        
    reset_code = generate_otp()
    expiry = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    try:
        await db.users.update_one(
            {"email": payload.email},
            {"$set": {
                "reset_code": reset_code,
                "reset_code_expiry": expiry
            }}
        )
        
        background_tasks.add_task(send_reset_email, payload.email, reset_code)
        
        return {"status": "success", "message": "Verification code sent successfully to your email."}
    except Exception as e:
        logger.error(f"Error in forgot-password: {e}")
        raise HTTPException(status_code=500, detail="Failed to process password reset request.")

@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    db = await get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
        
    user = await db.users.find_one({"email": payload.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    reset_code = user.get("reset_code")
    expiry = user.get("reset_code_expiry")
    
    if not reset_code or not expiry:
        raise HTTPException(status_code=400, detail="No active password reset request found.")
        
    expiry_naive = expiry.replace(tzinfo=None)
    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    if expiry_naive < now_naive:
        raise HTTPException(status_code=400, detail="Reset code has expired. Please request a new one.")
        
    if reset_code != payload.reset_code:
        raise HTTPException(status_code=400, detail="Invalid password reset verification code.")
        
    try:
        hashed_pwd = hash_password(payload.new_password)
        await db.users.update_one(
            {"email": payload.email},
            {
                "$set": {"password_hash": hashed_pwd},
                "$unset": {"reset_code": "", "reset_code_expiry": ""}
            }
        )
        return {"status": "success", "message": "Password successfully updated! You can now log in."}
    except Exception as e:
        logger.error(f"Error resetting password: {e}")
        raise HTTPException(status_code=500, detail="Failed to save new password.")
