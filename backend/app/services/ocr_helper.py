import httpx
import logging
import os

logger = logging.getLogger(__name__)

# Free default guest API key for ocr.space (always active)
DEFAULT_OCR_API_KEY = "helloworld"

async def extract_text_from_image_bytes(image_bytes: bytes, filename: str = "image.jpg", content_type: str = "image/jpeg") -> str:
    """
    Uploads the image bytes to OCR.space API and extracts any text/links.
    Returns the parsed text, or an empty string on error or no text found.
    """
    logger.info("Uploading image bytes to OCR.space for text extraction...")
    
    # Allow user to specify a custom OCR key in .env if desired, fallback to helloworld
    api_key = os.environ.get("OCR_SPACE_API_KEY", DEFAULT_OCR_API_KEY)
    
    url = "https://api.ocr.space/parse/image"
    
    data = {
        "apikey": api_key,
        "language": "eng",
        "detectOrientation": "true",
        "scale": "true",
        "isTable": "false"
    }
    
    files = {
        "file": (filename, image_bytes, content_type)
    }
    
    try:
        async with httpx.AsyncClient() as client:
            # Set timeout to 15 seconds to allow time for image parsing
            res = await client.post(url, data=data, files=files, timeout=15.0)
            
            if res.status_code != 200:
                logger.error(f"OCR.space API responded with status {res.status_code}: {res.text}")
                return ""
                
            response_json = res.json()
            
            # Check for API-level errors
            if response_json.get("IsErroredOnProcessing", False):
                err_msg = response_json.get("ErrorMessage", "Unknown processing error")
                logger.error(f"OCR.space processing failed: {err_msg}")
                return ""
                
            parsed_results = response_json.get("ParsedResults", [])
            if parsed_results and len(parsed_results) > 0:
                extracted_text = parsed_results[0].get("ParsedText", "")
                cleaned_text = extracted_text.strip()
                logger.info(f"Successfully extracted text via OCR (length: {len(cleaned_text)}).")
                return cleaned_text
            else:
                logger.warning("OCR.space parsed result was empty.")
                return ""
                
    except httpx.TimeoutException:
        logger.error("OCR.space API request timed out.")
        return ""
    except Exception as e:
        logger.error(f"Failed to communicate with OCR.space API: {e}")
        return ""
