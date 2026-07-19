import logging
from typing import List
from app.config import settings

logger = logging.getLogger(__name__)

# Try to import openai, catch if not present
try:
    from openai import AsyncOpenAI
except ImportError:
    AsyncOpenAI = None

async def generate_safety_explanation(
    content_type: str,  # "url" or "message"
    content: str,
    classification: str,
    risk_score: float,
    threat_signals: List[str]
) -> str:
    """
    Query OpenAI GPT (or fallback to local template engine) to provide a non-technical explanation
    of why a URL or message was classified a certain way, its risks, and recommended actions.
    """
    sig_str = "\n".join(f"- {sig}" for sig in threat_signals) if threat_signals else "- No major security anomalies detected."
    
    prompt = f"""
You are TruthGuard AI, a cybersecurity assistant. Analyze the following scan result:
Type: {content_type.upper()}
Scanned Content: {content}
Assigned Classification: {classification}
Risk Score: {risk_score}%
Threat Indicators Detected:
{sig_str}

Generate a simple, concise explanation for a non-technical user.
Answer:
1. Why it is classified as {classification} (e.g., what indicators triggered it).
2. What information or assets (e.g., banking credentials, login passwords, money) could be stolen if the user interacts.
3. Direct, actionable recommendation.

Keep the reply engaging and short (maximum 4-5 sentences), structured for mobile screen reading.
"""

    if settings.openai_api_key and AsyncOpenAI:
        try:
            client = AsyncOpenAI(api_key=settings.openai_api_key)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are TruthGuard AI, a helpful, polite cybersecurity warning bot."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=250,
                temperature=0.7
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Error querying OpenAI GPT: {e}. Falling back to template explanation.")
            
    # Mock / Heuristics-based fallback
    return build_fallback_explanation(content_type, classification, risk_score, threat_signals)

def build_fallback_explanation(content_type: str, classification: str, risk_score: float, threat_signals: List[str]) -> str:
    is_url = (content_type == "url")
    
    if classification == "Safe" or risk_score < 15:
        if is_url:
            return "This website link appears to be safe. We found a valid SSL certificate and no malicious indicators from threat intelligence scans. You can safely visit it, but always remain cautious when sharing sensitive personal information online."
        else:
            return "This text message appears to be safe. We found no scam, phishing, or clickbait indicators in the text. You can safely read and reply, but always remain cautious when sharing sensitive personal information online."
        
    if classification == "Suspicious":
        if is_url:
            return "This website link has some suspicious indicators. While not explicitly flagged as malware, it exhibits traits like a newly registered domain, a high redirect count, or is served over unencrypted HTTP. We recommend proceeding with caution."
        else:
            return "This text message has some suspicious indicators. It exhibits traits like urgent language or suspicious requests. We recommend proceeding with caution and avoiding sharing any sensitive details."
        
    if classification == "Phishing":
        return "This website is flagged as a phishing attempt! It mimics a trusted brand's login or billing interface to steal your passwords, banking credentials, or personal identity. Do NOT click the link, and immediately delete the message."
        
    if classification == "Scam":
        return "This message is classified as a scam! It uses high-pressure tactics, fake lottery wins, OTP codes requests, or unrealistic cryptocurrency offers to trick you into sending money. Do NOT reply, do NOT share any OTPs, and block this sender immediately."
        
    if classification == "Fake News":
        return "This message contains unverified information or fake news! It displays signs of clickbait, sensationalist language, and medical or scientific claims not supported by health agencies. We advise double-checking with official sources before sharing this message further."
        
    if classification == "Malware":
        return "Warning: This link is reported to distribute malware or ransomware! Clicking it could install malicious software onto your phone or computer, allowing hackers to monitor your activity or steal your files. Avoid clicking at all costs and block the sender."
        
    sig_summary = threat_signals[0] if threat_signals else "unverified wording or requests"
    if is_url:
        return f"This website link is classified as {classification} with a risk score of {risk_score}%. Suspicious elements include: {sig_summary}. Do not click."
    else:
        return f"This text message is classified as {classification} with a risk score of {risk_score}%. Suspicious elements include: {sig_summary}. Do not reply."
