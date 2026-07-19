import cv2
import numpy as np
import httpx
import logging
from app.config import settings

logger = logging.getLogger(__name__)

async def decode_qr_from_url(media_url: str) -> str:
    """
    Downloads the image from Twilio's CDN and decodes any QR codes inside it.
    Returns the decoded string, or an empty string if no QR code is found.
    """
    logger.info(f"Downloading media for QR scanning from: {media_url}")
    
    # 1. Download image bytes from Twilio
    auth = None
    if settings.twilio_account_sid and settings.twilio_auth_token:
        # Twilio CDN uses Basic Authentication with SID as username and AuthToken as password
        auth = (settings.twilio_account_sid, settings.twilio_auth_token)
        
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(media_url, auth=auth, follow_redirects=True)
            if res.status_code != 200:
                logger.error(f"Failed to fetch image from Twilio. HTTP {res.status_code}")
                return ""
            image_bytes = res.content
    except Exception as e:
        logger.error(f"Network error downloading Twilio media: {e}")
        return ""

    # 2. Decode QR Code using the bytes helper
    return decode_qr_from_bytes(image_bytes)

def decode_qr_from_bytes(image_bytes: bytes) -> str:
    """
    Decodes any QR codes inside the provided image bytes.
    Returns the decoded string, or an empty string if no QR code is found.
    """
    try:
        # Load binary bytes into a NumPy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            logger.error("Failed to parse image bytes into OpenCV image format.")
            return ""
            
        detector = cv2.QRCodeDetector()
        data, bbox, _ = detector.detectAndDecode(img)
        
        if data:
            logger.info(f"Successfully decoded QR Code from image. Content: {data}")
            return data.strip()
        else:
            logger.info("OpenCV QR code scan completed. No QR code found.")
            return ""
    except Exception as e:
        logger.error(f"Error scanning QR code in OpenCV: {e}")
        return ""
