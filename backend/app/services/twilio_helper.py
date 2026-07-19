from twilio.rest import Client
from app.config import settings
import logging

logger = logging.getLogger(__name__)

def send_whatsapp_message(to_number: str, body: str) -> str:
    """
    Sends a WhatsApp message using Twilio's API.
    If credentials are not set, it simulates sending by logging the content.
    """
    if not to_number.startswith("whatsapp:"):
        to_number = f"whatsapp:{to_number}"
        
    from_number = settings.twilio_whatsapp_number
    if not from_number.startswith("whatsapp:"):
        from_number = f"whatsapp:{from_number}"
        
    if settings.twilio_account_sid and settings.twilio_auth_token:
        try:
            client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
            message = client.messages.create(
                body=body,
                from_=from_number,
                to=to_number
            )
            logger.info(f"Twilio message sent successfully: {message.sid}")
            return message.sid
        except Exception as e:
            logger.error(f"Error sending Twilio WhatsApp message: {e}")
            return f"error_{str(e)[:20]}"
    else:
        logger.warning(f"[MOCK TWILIO] Sending message to {to_number} from {from_number}:\n{body}")
        return "mock_twilio_sid"
