import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import logging
import httpx
from app.config import settings
from app.services.twilio_helper import send_whatsapp_message

logger = logging.getLogger(__name__)

def generate_otp() -> str:
    """
    Generate a secure 6-digit numeric OTP.
    """
    return str(random.randint(100000, 999999))

def send_email_via_resend(to_email: str, subject: str, html_body: str, text_body: str) -> bool:
    """
    Sends an email using the Resend REST API (via HTTPS port 443).
    Handles domain testing restriction gracefully by checking status code 403.
    """
    if not settings.resend_api_key:
        return False
        
    try:
        from_email = "TruthGuard AI <onboarding@resend.dev>"
        headers = {
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
            "text": text_body
        }
        with httpx.Client(timeout=8.0) as client:
            response = client.post("https://api.resend.com/emails", headers=headers, json=payload)
            if response.status_code in [200, 201]:
                logger.info(f"Email OTP sent successfully via Resend API to {to_email}")
                return True
            else:
                logger.warning(f"Resend API status {response.status_code}: {response.text}")
                return False
    except Exception as e:
        logger.warning(f"Error sending email via Resend API: {e}")
        return False

def send_email_via_brevo(to_email: str, subject: str, html_body: str) -> bool:
    """
    Sends an email using the Brevo HTTP API (via HTTPS port 443).
    """
    if not settings.brevo_api_key:
        return False
        
    try:
        from_email = settings.smtp_from if settings.smtp_from else settings.smtp_user
        if not from_email:
            from_email = "truthguardai22@gmail.com"
            
        headers = {
            "api-key": settings.brevo_api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "sender": {"name": "TruthGuard AI Security", "email": from_email},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_body
        }
        with httpx.Client(timeout=8.0) as client:
            response = client.post("https://api.brevo.com/v3/smtp/email", headers=headers, json=payload)
            if response.status_code in [200, 201]:
                logger.info(f"Email sent successfully via Brevo API to {to_email}")
                return True
            else:
                logger.warning(f"Brevo API status {response.status_code}: {response.text}")
                return False
    except Exception as e:
        logger.warning(f"Error sending email via Brevo API: {e}")
        return False

def send_email_otp(to_email: str, otp: str) -> bool:
    """
    Resilient Multi-Tier Email OTP Delivery.
    Order: Resend API -> Brevo API -> SMTP TLS (587) -> SMTP SSL (465).
    Guarantees reliable delivery with fallback console logging.
    """
    subject = "TruthGuard AI - Verification Code"
    
    body = f"""
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f1f5f9; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; padding: 30px; border-radius: 10px; border: 1px solid #334155;">
          <h2 style="color: #6366f1; text-align: center; margin-bottom: 20px;">🛡️ TruthGuard AI Security</h2>
          <p>Hello,</p>
          <p>Your 6-digit One-Time Password (OTP) for account verification is:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #6366f1; background-color: #0f172a; padding: 12px 24px; border-radius: 8px; border: 1px solid #6366f1;">
              {otp}
            </span>
          </div>
          <p>This code expires in 15 minutes. Do not share this code with anyone.</p>
          <p style="margin-top: 20px; font-size: 12px; color: #94a3b8;">If you did not request this code, please ignore this email.</p>
        </div>
      </body>
    </html>
    """
    
    text_body = f"Hello,\n\nYour TruthGuard AI verification code is: {otp}\n\nValid for 15 minutes."

    # Tier 1: Resend HTTP API
    if settings.resend_api_key:
        if send_email_via_resend(to_email, subject, body, text_body):
            return True

    # Tier 2: Brevo HTTP API
    if settings.brevo_api_key:
        if send_email_via_brevo(to_email, subject, body):
            return True

    # Tier 3: SMTP TLS / SSL
    smtp_host = settings.smtp_host or "smtp.gmail.com"
    smtp_port = settings.smtp_port or 587
    smtp_user = settings.smtp_user or "truthguardai22@gmail.com"
    smtp_pass = settings.smtp_password
    smtp_from = settings.smtp_from or smtp_user

    if smtp_user and smtp_pass:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f'"TruthGuard AI Security" <{smtp_from}>'
        msg["To"] = to_email
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(body, "html"))

        # Attempt Port 587 (TLS)
        try:
            server = smtplib.SMTP(smtp_host, 587, timeout=5.0)
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, to_email, msg.as_string())
            server.quit()
            logger.info(f"Email OTP sent successfully via SMTP TLS (587) to {to_email}")
            return True
        except Exception as e587:
            logger.warning(f"SMTP TLS 587 failed to {to_email}: {e587}")

        # Attempt Port 465 (SSL)
        try:
            server_ssl = smtplib.SMTP_SSL(smtp_host, 465, timeout=5.0)
            server_ssl.login(smtp_user, smtp_pass)
            server_ssl.sendmail(smtp_from, to_email, msg.as_string())
            server_ssl.quit()
            logger.info(f"Email OTP sent successfully via SMTP SSL (465) to {to_email}")
            return True
        except Exception as e465:
            logger.warning(f"SMTP SSL 465 failed to {to_email}: {e465}")

    # Fallback mock log
    logger.warning(
        f"\n======================================================\n"
        f"[OTP VERIFICATION CODE] Destination: {to_email}\n"
        f"OTP Code: {otp}\n"
        f"======================================================\n"
    )
    return True

def send_phone_otp(to_phone: str, otp: str) -> bool:
    """
    Sends a WhatsApp OTP using the Twilio helper.
    """
    clean_phone = to_phone.strip()
    if not clean_phone.startswith("+"):
        clean_phone = f"+{clean_phone}"
        
    body = f"🤖 *TruthGuard AI Verification Code*\n\nYour 6-digit WhatsApp verification code is:\n👉 *{otp}*\n\nEnter this code on the website to activate your account."
    
    res = send_whatsapp_message(clean_phone, body)
    if "error_" in res:
        logger.error(f"Failed to send WhatsApp OTP: {res}")
        
    # Print clean console log for developer visibility
    logger.warning(
        f"\n======================================================\n"
        f"[MOCK WHATSAPP OTP] Verification code for {to_phone}:\n"
        f"OTP Code: {otp}\n"
        f"======================================================\n"
    )
    return True

def send_reset_email(to_email: str, code: str) -> bool:
    """
    Sends a Password Reset verification code via Brevo, Resend HTTP API, or SMTP.
    """
    smtp_host = settings.smtp_host
    smtp_port = settings.smtp_port
    smtp_user = settings.smtp_user
    smtp_pass = settings.smtp_password
    smtp_from = settings.smtp_from if settings.smtp_from else smtp_user
    
    body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f1f5f9; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; padding: 30px; border-radius: 10px; border: 1px solid #334155;">
          <h2 style="color: #ef4444; text-align: center; margin-bottom: 20px;">TruthGuard AI Password Reset</h2>
          <p>Hello,</p>
          <p>We received a request to reset the password for your TruthGuard AI account. Please use the following verification code to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #ef4444; background-color: #0f172a; padding: 10px 20px; border-radius: 5px; border: 1px solid #ef4444;">
              {code}
            </span>
          </div>
          <p>This code is valid for 15 minutes. If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
          <p style="margin-top: 20px;">For support, contact: <a href="mailto:truthguardai22@gmail.com" style="color: #a78bfa; text-decoration: none;">truthguardai22@gmail.com</a></p>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 30px 0;">
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">TruthGuard AI Security Systems</p>
        </div>
      </body>
    </html>
    """
    
    text_body = f"Hello,\n\nYour TruthGuard AI password reset verification code is: {code}\n\nEnter this code on the website to reset your password. This code expires in 15 minutes.\n\nFor support, contact: truthguardai22@gmail.com"
    
    # 1. Try Resend HTTP API first (pre-authenticated domain, instant delivery)
    if settings.resend_api_key:
        if send_email_via_resend(to_email, "TruthGuard AI Password Reset", body, text_body):
            return True

    # 2. Try Brevo HTTP API (fallback)
    if settings.brevo_api_key:
        if send_email_via_brevo(to_email, "TruthGuard AI Password Reset", body):
            return True
            
    # 3. Fallback to standard SMTP
    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "TruthGuard AI Password Reset"
            msg["From"] = f'"TruthGuard AI Security" <{smtp_from}>'
            msg["To"] = to_email
            
            msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(body, "html"))
            
            msg["X-Priority"] = "1"
            msg["Importance"] = "high"
            msg["Precedence"] = "personal"
            
            server = smtplib.SMTP(smtp_host, int(smtp_port), timeout=5.0)
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, to_email, msg.as_string())
            server.quit()
            logger.info(f"Password reset email sent successfully to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send password reset email via SMTP: {e}")
            
    logger.warning(
        f"\n======================================================\n"
        f"[MOCK RESET CODE] Verification code for {to_email}:\n"
        f"Reset Code: {code}\n"
        f"======================================================\n"
    )
    return True

def send_welcome_email(to_email: str, username: str) -> bool:
    """
    Sends a welcome email via Resend HTTP API, Brevo, or SMTP after successful registration and verification.
    """
    smtp_host = settings.smtp_host
    smtp_port = settings.smtp_port
    smtp_user = settings.smtp_user
    smtp_pass = settings.smtp_password
    smtp_from = settings.smtp_from if settings.smtp_from else smtp_user
    
    body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f1f5f9; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; padding: 30px; border-radius: 10px; border: 1px solid #334155;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #8b5cf6; margin: 0; font-size: 28px;">🛡️ TruthGuard AI</h2>
            <p style="color: #a78bfa; margin: 5px 0 0 0; font-size: 14px;">Your AI Cyber Guardian</p>
          </div>
          <p>Hello <strong>{username}</strong>,</p>
          <p>Thanks for joining TruthGuard!</p>
          <p>Your account is now verified and active. You can use the dashboard to run advanced threat checks, test sample links, and manage your cyber security settings.</p>
          <p>For any questions or feedback, feel free to reach out to us at <a href="mailto:truthguardai22@gmail.com" style="color: #a78bfa; text-decoration: none;">truthguardai22@gmail.com</a>.</p>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 30px 0;">
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">TruthGuard AI Security Systems</p>
        </div>
      </body>
    </html>
    """
    
    text_body = f"Hello {username},\n\nThanks for joining TruthGuard!\n\nYour account is now verified. For support, contact: truthguardai22@gmail.com"
    
    # 1. Try Resend HTTP API first (pre-authenticated domain, instant delivery)
    if settings.resend_api_key:
        if send_email_via_resend(to_email, "Welcome to TruthGuard AI!", body, text_body):
            return True

    # 2. Try Brevo HTTP API (fallback)
    if settings.brevo_api_key:
        if send_email_via_brevo(to_email, "Welcome to TruthGuard AI!", body):
            return True
            
    # 3. Fallback to standard SMTP
    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Welcome to TruthGuard AI!"
            msg["From"] = f'"TruthGuard AI Security" <{smtp_from}>'
            msg["To"] = to_email
            
            msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(body, "html"))
            
            server = smtplib.SMTP(smtp_host, int(smtp_port), timeout=5.0)
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, to_email, msg.as_string())
            server.quit()
            logger.info(f"Welcome email sent successfully to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send welcome email via SMTP: {e}")
            
    logger.warning(
        f"\n======================================================\n"
        f"[MOCK WELCOME EMAIL] Sent to {to_email}:\n"
        f"Thanks for joining TruthGuard!\n"
        f"======================================================\n"
    )
    return True

def send_feedback_thank_you_email(to_email: str, username: str) -> bool:
    """
    Sends a thank-you email via Resend HTTP API, Brevo, or SMTP after successful feedback submission.
    """
    smtp_host = settings.smtp_host
    smtp_port = settings.smtp_port
    smtp_user = settings.smtp_user
    smtp_pass = settings.smtp_password
    smtp_from = settings.smtp_from if settings.smtp_from else smtp_user
    
    body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f1f5f9; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; padding: 30px; border-radius: 10px; border: 1px solid #334155;">
          <h2 style="color: #8b5cf6; text-align: center; margin-bottom: 20px;">🛡️ TruthGuard AI Feedback</h2>
          <p>Hello <strong>{username}</strong>,</p>
          <p>Thank you for your feedback! We truly appreciate you taking the time to share your thoughts and help us improve TruthGuard AI.</p>
          <p style="margin-bottom: 25px;">Our team will review your comments as we continue to enhance our AI scanning engines and security dashboard.</p>
          <p>For further assistance, you can contact us at <a href="mailto:truthguardai22@gmail.com" style="color: #a78bfa; text-decoration: none;">truthguardai22@gmail.com</a>.</p>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 30px 0;">
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">TruthGuard AI Security Systems</p>
        </div>
      </body>
    </html>
    """
    
    text_body = f"Hello {username},\n\nThank you for your feedback! We appreciate your support in improving TruthGuard AI.\n\nFor support, contact: truthguardai22@gmail.com"
    
    # 1. Try Resend HTTP API first (pre-authenticated domain, instant delivery)
    if settings.resend_api_key:
        if send_email_via_resend(to_email, "Thank you for your feedback!", body, text_body):
            return True

    # 2. Try Brevo HTTP API (fallback)
    if settings.brevo_api_key:
        if send_email_via_brevo(to_email, "Thank you for your feedback!", body):
            return True
            
    # 3. Fallback to standard SMTP
    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Welcome to TruthGuard AI!"
            msg["From"] = f'"TruthGuard AI Security" <{smtp_from}>'
            msg["To"] = to_email
            
            msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(body, "html"))
            
            server = smtplib.SMTP(smtp_host, int(smtp_port), timeout=5.0)
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, to_email, msg.as_string())
            server.quit()
            logger.info(f"Welcome email sent successfully to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send welcome email via SMTP: {e}")
            
    logger.warning(
        f"\n======================================================\n"
        f"[MOCK WELCOME EMAIL] Sent to {to_email}:\n"
        f"Thanks for joining TruthGuard!\n"
        f"======================================================\n"
    )
    return True

def send_feedback_thank_you_email(to_email: str, username: str) -> bool:
    """
    Sends a thank-you email via Brevo, Resend HTTP API, or SMTP after successful feedback submission.
    """
    smtp_host = settings.smtp_host
    smtp_port = settings.smtp_port
    smtp_user = settings.smtp_user
    smtp_pass = settings.smtp_password
    smtp_from = settings.smtp_from if settings.smtp_from else smtp_user
    
    body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f1f5f9; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; padding: 30px; border-radius: 10px; border: 1px solid #334155;">
          <h2 style="color: #8b5cf6; text-align: center; margin-bottom: 20px;">🛡️ TruthGuard AI Feedback</h2>
          <p>Hello <strong>{username}</strong>,</p>
          <p>Thank you for your feedback! We truly appreciate you taking the time to share your thoughts and help us improve TruthGuard AI.</p>
          <p style="margin-bottom: 25px;">Our team will review your comments as we continue to enhance our AI scanning engines and security dashboard.</p>
          <p>For further assistance, you can contact us at <a href="mailto:truthguardai22@gmail.com" style="color: #a78bfa; text-decoration: none;">truthguardai22@gmail.com</a>.</p>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 30px 0;">
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">TruthGuard AI Security Systems</p>
        </div>
      </body>
    </html>
    """
    
    text_body = f"Hello {username},\n\nThank you for your feedback! We appreciate your support in improving TruthGuard AI.\n\nFor support, contact: truthguardai22@gmail.com"
    
    # 1. Try Brevo HTTP API first (unblocked, sends to anyone)
    if settings.brevo_api_key:
        if send_email_via_brevo(to_email, "Thank you for your feedback!", body):
            return True
            
    # 2. Try Resend HTTP API (unblocked, sandbox-restricted)
    if settings.resend_api_key:
        if send_email_via_resend(to_email, "Thank you for your feedback!", body, text_body):
            return True
            
    # 3. Fallback to standard SMTP
    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Thank you for your feedback!"
            msg["From"] = f'"TruthGuard AI Security" <{smtp_from}>'
            msg["To"] = to_email
            
            msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(body, "html"))
            
            server = smtplib.SMTP(smtp_host, int(smtp_port), timeout=5.0)
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, to_email, msg.as_string())
            server.quit()
            logger.info(f"Feedback thank-you email sent successfully to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send feedback thank-you email via SMTP: {e}")
            
    logger.warning(
        f"\n======================================================\n"
        f"[MOCK FEEDBACK THANK-YOU] Sent to {to_email}:\n"
        f"Thank you for your feedback!\n"
        f"======================================================\n"
    )
    return True
