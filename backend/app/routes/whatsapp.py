import html
import logging
from typing import Optional
import httpx
from fastapi import APIRouter, Form, Response
from app.config import settings
from app.services.scan_manager import scan_message_flow
from app.services.qr_decoder import decode_qr_from_bytes
from app.services.ocr_helper import extract_text_from_image_bytes
from app.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WhatsApp Webhook"])

@router.post("/whatsapp-webhook")
async def whatsapp_webhook(
    Body: Optional[str] = Form(None),
    From: str = Form(...),
    NumMedia: int = Form(0),
    MediaUrl0: Optional[str] = Form(None),
    MediaContentType0: Optional[str] = Form(None)
):
    """
    Twilio Webhook endpoint. Twilio sends a POST with application/x-www-form-urlencoded
    containing Body, From, and optional NumMedia/MediaUrl parameters.
    """
    logger.info(f"Incoming WhatsApp message from {From}. NumMedia: {NumMedia}, Body length: {len(Body) if Body else 0}")
    
    db = await get_db()
    username = None
    if db is not None:
        # Clean from_phone, e.g. "whatsapp:+919440049605" -> "919440049605"
        clean_phone = From.replace("whatsapp:", "").replace("+", "").strip()
        if len(clean_phone) >= 10:
            last_10 = clean_phone[-10:]
            try:
                # Find a user whose phone number ends with the same 10 digits
                user = await db.users.find_one({"phone": {"$regex": f"{last_10}$"}})
                if user:
                    username = user["username"]
                    logger.info(f"Linked WhatsApp message from {From} to registered user {username}")
            except Exception as e:
                logger.error(f"Error querying user by phone regex: {e}")

    scan_content = Body
    scan_source_prefix = ""
    input_media_type = None

    # Process media attachment if present
    if NumMedia > 0 and MediaUrl0:
        if MediaContentType0 and MediaContentType0.startswith("image/"):
            logger.info(f"Processing image attachment from Twilio: {MediaUrl0}")
            
            # Download image bytes from Twilio CDN
            auth = None
            if settings.twilio_account_sid and settings.twilio_auth_token:
                auth = (settings.twilio_account_sid, settings.twilio_auth_token)
                
            image_bytes = None
            try:
                async with httpx.AsyncClient() as client:
                    res = await client.get(MediaUrl0, auth=auth, follow_redirects=True)
                    if res.status_code == 200:
                        image_bytes = res.content
                    else:
                        logger.error(f"Failed to download image from Twilio. HTTP {res.status_code}")
            except Exception as e:
                logger.error(f"Network error downloading image from Twilio: {e}")
                
            if image_bytes:
                # 1. Try decoding local QR code
                qr_result = decode_qr_from_bytes(image_bytes)
                if qr_result:
                    logger.info(f"QR Code decoded: {qr_result}")
                    scan_content = qr_result
                    input_media_type = "qr"
                    scan_source_prefix = "🤖 *QR Code Scanned* 🤖\nDecoded: " + qr_result + "\n\n"
                else:
                    logger.info("No QR Code detected. Attempting OCR text extraction...")
                    # 2. Try OCR text extraction
                    filename = "image.png" if MediaContentType0 == "image/png" else "image.jpg"
                    ocr_result = await extract_text_from_image_bytes(
                        image_bytes, 
                        filename=filename, 
                        content_type=MediaContentType0
                    )
                    if ocr_result:
                        logger.info(f"OCR extracted text: {ocr_result}")
                        scan_content = ocr_result
                        input_media_type = "ocr"
                        scan_source_prefix = "📝 *Image Text Extracted (OCR)* 📝\n\n"
            
            # Check if we failed to extract any content
            if not scan_content or not scan_content.strip():
                reply = "🤖 *TruthGuard AI* 🤖\n\nWe received your image, but we couldn't find any readable QR codes or printed text messages in it. Please make sure the QR code or text is clear, well-lit, and legible!"
                twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message><![CDATA[{reply}]]></Message>
</Response>"""
                return Response(content=twiml, media_type="application/xml")
        else:
            logger.warning(f"Unsupported media content type received: {MediaContentType0}")
            reply = "🤖 *TruthGuard AI* 🤖\n\nSorry, we currently only support scanning text messages, web links, or image attachments (like screenshots of chats or QR codes)."
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message><![CDATA[{reply}]]></Message>
</Response>"""
            return Response(content=twiml, media_type="application/xml")

    # If no media and body is empty
    if not scan_content or not scan_content.strip():
        reply = "🤖 *TruthGuard AI* 🤖\n\nHello! Send me a message, a link, or a screenshot/QR code photo, and I will analyze it for scams, phishing, and fake news!"
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message><![CDATA[{reply}]]></Message>
</Response>"""
        return Response(content=twiml, media_type="application/xml")

    # Resolve input type if text-only
    if not input_media_type:
        from app.services.scan_manager import extract_urls
        urls = extract_urls(scan_content)
        if urls and scan_content.strip() == urls[0]:
            input_media_type = "link"
        else:
            input_media_type = "text"

    try:
        # Run scan flow with matched username
        res = await scan_message_flow(scan_content, source="whatsapp", username=username)
        
        # Build bot response text
        reply = scan_source_prefix + format_twilio_bot_reply(res, input_media_type)
        
        # Wrap message in TwiML XML using CDATA to prevent XML syntax breaks
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message><![CDATA[{reply}]]></Message>
</Response>"""
        return Response(content=twiml, media_type="application/xml")
        
    except Exception as e:
        logger.error(f"Error handling WhatsApp webhook: {e}")
        error_msg = "🤖 TruthGuard AI: Sorry, we encountered a technical issue analyzing your message. Please try forwarding it again shortly."
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message><![CDATA[{error_msg}]]></Message>
</Response>"""
        return Response(content=twiml, media_type="application/xml")

def format_twilio_bot_reply(res: dict, input_type: Optional[str] = None) -> str:
    """
    Format scan details into the specified TruthGuard bot message templates.
    """
    risk_score = int(res["risk_score"])
    classification = res["classification"]
    explanation = res["explanation"]
    content_type = res["type"]
    threat_level = res["threat_level"]
    
    # Map input type to friendly nouns to customize the explanation dynamically
    if input_type == "qr":
        noun_website_msg = "decoded QR Code link"
        noun_url_msg = "decoded QR Code link"
        noun_link_msg = "decoded QR Code link"
    elif input_type == "ocr":
        noun_website_msg = "extracted image text"
        noun_url_msg = "extracted image text"
        noun_link_msg = "extracted image text"
    elif input_type == "link" or content_type == "url":
        noun_website_msg = "website link"
        noun_url_msg = "website link"
        noun_link_msg = "website link"
    else:
        noun_website_msg = "text message"
        noun_url_msg = "text message"
        noun_link_msg = "text message"
        
    explanation = explanation.replace("This website/message", f"This {noun_website_msg}")
    explanation = explanation.replace("This URL/message", f"This {noun_url_msg}")
    explanation = explanation.replace("This link/message", f"This {noun_link_msg}")
    
    # 1. Select Emoji Header & Specific input description
    if input_type == "qr":
        scanned_type_str = "QR Code (Decoded Link)"
    elif input_type == "ocr":
        scanned_type_str = "Image Text (OCR)"
    elif input_type == "link" or content_type == "url":
        scanned_type_str = "Website Link"
    else:
        scanned_type_str = "Text Message"
        
    if threat_level in ["Red", "Dark Red"]:
        emoji = "🚨"
        header = f"{emoji} Dangerous {scanned_type_str}"
    elif threat_level in ["Orange", "Yellow"]:
        emoji = "⚠️"
        header = f"{emoji} Suspicious {scanned_type_str}"
    else:
        emoji = "✅"
        header = f"{emoji} Safe {scanned_type_str}"
        
    # Format the content snippet or link to be printed clearly
    analyzed_content = res["content"]
    if len(analyzed_content) > 120:
        analyzed_content = analyzed_content[:117] + "..."
        
    content_block = ""
    if input_type in ["qr", "link"] or content_type == "url":
        content_block = f"Analyzed Link: {analyzed_content}"
    else:
        content_block = f"Analyzed Text: \"{analyzed_content}\""
        
    # 2. Extract Reasons / Signals
    details = res.get("details", {})
    signals = []
    
    if content_type == "url" and "threat_intel" in details:
        signals = details["threat_intel"].get("threat_signals", [])
    elif "nlp_features" in details:
        intent = details["nlp_features"].get("intent", "General Communication")
        if intent != "General Communication":
            signals.append(f"Classified intent: {intent}")
        if details["nlp_features"].get("urgency_detected"):
            signals.append("High urgency/pressure keywords")
            
    reasons_block = ""
    if signals:
        reasons_block = "\nReasons:\n" + "\n".join(f"- {sig}" for sig in signals[:4])
    elif content_type == "url":
        reasons_block = "\nReasons:\n- Unencrypted connection\n- Newly registered domain"
        
    # 3. Compile Recommendations
    if threat_level in ["Red", "Dark Red", "Orange"]:
        recommendation = "Recommendation:\nDo NOT click this link.\nDelete the message.\nBlock the sender."
    elif threat_level == "Yellow":
        recommendation = "Recommendation:\nProceed with caution.\nDo not share personal OTPs or passwords."
    else:
        recommendation = "Recommendation:\nSafe to visit/reply."
        
    reply = f"""{header}
{content_block}

Risk Score: {risk_score}%

Classification:
{classification}{reasons_block}

Explanation:
{explanation}

{recommendation}"""
    return reply
