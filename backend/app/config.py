from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    mongodb_uri: str = "mongodb://localhost:27017/truthguard_db"
    jwt_secret_key: str = "supersecretkey_change_me_in_production_truthguard"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours
    
    openai_api_key: str = ""
    virustotal_api_key: str = ""
    google_safe_browsing_api_key: str = ""
    urlscan_api_key: str = ""
    abuseipdb_api_key: str = ""
    resend_api_key: str = ""
    brevo_api_key: str = ""
    
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_number: str = "whatsapp:+14155238886"  # Twilio sandbox default
    
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    
    port: int = 8000
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
