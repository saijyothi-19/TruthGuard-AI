import re
from datetime import datetime, timezone
from bson import ObjectId
from app.database import get_db
from app.services.ml_classifier import predict_url_phishing, predict_text_scam
from app.services.threat_intel import analyze_url_threats
from app.services.nlp_analyzer import analyze_message_text
from app.services.openai_helper import generate_safety_explanation
import logging

logger = logging.getLogger(__name__)

def extract_urls(text: str) -> list[str]:
    """
    Extracts all URLs from message text and cleans trailing punctuation.
    """
    url_pattern = r"https?://[^\s/$.?#].[^\s]*"
    urls = re.findall(url_pattern, text)
    cleaned = []
    for u in urls:
        u_clean = u.rstrip(".,;()[]{}!?\"'")
        cleaned.append(u_clean)
    return list(set(cleaned))

def calculate_threat_level(risk_score: float, default_classification: str) -> str:
    """
    Map risk score to TruthGuard threat levels.
    """
    if risk_score < 15:
        return "Green"      # Safe
    elif risk_score < 45:
        return "Yellow"     # Suspicious
    elif risk_score < 75:
        return "Orange"     # Scam
    elif risk_score < 90:
        return "Red"        # Phishing
    else:
        return "Dark Red"   # Malware / Critical Phishing

async def check_lists(value: str) -> str:
    """
    Check if a domain or value matches the whitelist or blacklist.
    Returns 'whitelist', 'blacklist', or 'none'.
    """
    db = await get_db()
    if db is None:
        return "none"
    
    clean_val = value.strip().lower()
    
    # Extract domain if it looks like a URL
    domain = ""
    if clean_val.startswith(("http://", "https://")) or "." in clean_val.split("/")[0]:
        try:
            from urllib.parse import urlparse
            val_to_parse = clean_val if clean_val.startswith(("http://", "https://")) else "http://" + clean_val
            parsed = urlparse(val_to_parse)
            domain = parsed.netloc.split(":")[0]
        except Exception:
            pass

    # Check Whitelist matches (exact value or domain match)
    async for item in db.whitelist.find():
        wl_val = item["value"].strip().lower()
        if wl_val == clean_val or (domain and wl_val == domain):
            return "whitelist"

    # Check Blacklist matches (exact value, domain, or substring match)
    async for item in db.blacklist.find():
        bl_val = item["value"].strip().lower()
        if bl_val == clean_val:
            return "blacklist"
        if domain and bl_val == domain:
            return "blacklist"
        # If the blacklisted pattern is a substring of the checked content
        if len(bl_val) > 2 and bl_val in clean_val:
            return "blacklist"

    return "none"

async def scan_url_flow(url: str, source: str = "dashboard", username: str = None) -> dict:
    """
    Full pipeline to scan a URL, compute risks, run threat intel, and save history.
    """
    # 1. Check lists
    list_check = await check_lists(url)
    if list_check == "whitelist":
        result = {
            "type": "url",
            "content": url,
            "risk_score": 0.0,
            "classification": "Trusted Website",
            "threat_level": "Green",
            "explanation": "This URL belongs to an explicitly whitelisted domain. It is verified and safe to visit.",
            "source": source,
            "timestamp": datetime.now(timezone.utc),
            "username": username,
            "details": {
                "url_features": {"is_https": 1, "tld_score": 0, "susp_words_count": 0},
                "threat_intel": {"threat_signals": ["Explicitly Whitelisted"]}
            }
        }
        await save_scan_result(result, username)
        return result
    
    elif list_check == "blacklist":
        result = {
            "type": "url",
            "content": url,
            "risk_score": 100.0,
            "classification": "Phishing Website",
            "threat_level": "Dark Red",
            "explanation": "CRITICAL WARNING: This domain was blacklisted by an administrator or reported as an active threat vector. Do NOT visit this link.",
            "source": source,
            "timestamp": datetime.now(timezone.utc),
            "username": username,
            "details": {
                "url_features": {"is_https": 0, "tld_score": 1, "susp_words_count": 2},
                "threat_intel": {"threat_signals": ["Explicitly Blacklisted"]}
            }
        }
        await save_scan_result(result, username)
        return result

    # 2. Run Threat Intel Analysis
    intel = await analyze_url_threats(url)
    
    # 3. Predict Phishing using ML
    # We pass the final resolved URL to model for accuracy
    final_url = intel["final_url"]
    ml_prob = predict_url_phishing(final_url)
    
    # 4. Aggregated Risk Score Calculation (0-100)
    risk_score = ml_prob * 45  # ML model gets 45% weight
    
    # Factor Threat Intel Votes
    threat_details = intel["threat_intel"]
    vt_malicious = threat_details["virustotal"].get("malicious", 0)
    if vt_malicious > 0:
        risk_score += min(vt_malicious * 10, 30)  # VT gets up to 30% weight
    
    if threat_details["google_safe_browsing"].get("is_dangerous", False):
        risk_score += 25  # Google Safe Browsing adds 25%
        
    if threat_details["urlscan"].get("is_malicious", False):
        risk_score += 15
        
    # Heuristic additions
    if not intel["ssl_cert"]["valid"] and final_url.startswith("https"):
        risk_score += 10
    if intel["whois_info"].get("domain_age_days", 365) < 30:
        risk_score += 15
    if intel["redirect_count"] > 3:
        risk_score += 10

    # Cap score
    risk_score = float(max(0.0, min(100.0, risk_score)))
    
    # Classify
    classification = "Trusted Website"
    if risk_score >= 90:
        classification = "Malicious URL"
    elif risk_score >= 70:
        classification = "Phishing Website"
    elif risk_score >= 45:
        classification = "Suspicious Link"
    elif risk_score >= 15:
        classification = "Unverified Link"
        
    threat_level = calculate_threat_level(risk_score, classification)
    
    # 5. Get AI/Fallback explanation
    explanation = await generate_safety_explanation(
        content_type="url",
        content=url,
        classification=classification,
        risk_score=risk_score,
        threat_signals=threat_details["threat_signals"]
    )
    
    # 6. Save in history
    result = {
        "type": "url",
        "content": url,
        "risk_score": risk_score,
        "classification": classification,
        "threat_level": threat_level,
        "explanation": explanation,
        "source": source,
        "timestamp": datetime.now(timezone.utc),
        "username": username,
        "details": {
            "url_features": intel["url_features"],
            "ssl_cert": intel["ssl_cert"],
            "whois_info": intel["whois_info"],
            "threat_intel": {
                "virustotal": threat_details["virustotal"],
                "google_safe_browsing": threat_details["google_safe_browsing"],
                "abuse_ipdb": threat_details["abuse_ipdb"],
                "urlscan": threat_details["urlscan"],
                "threat_signals": threat_details["threat_signals"]
            }
        }
    }
    
    await save_scan_result(result, username)
    return result

async def scan_message_flow(message: str, source: str = "dashboard", username: str = None) -> dict:
    """
    Scans full message. Extracts and checks URLs if present, else runs NLP text classification.
    """
    # 1. Check lists first to verify if the message matches any policy overrides
    list_check = await check_lists(message)
    if list_check == "whitelist":
        result = {
            "type": "message",
            "content": message,
            "risk_score": 0.0,
            "classification": "Safe Message",
            "threat_level": "Green",
            "explanation": "This message has been verified as safe by an administrator whitelist policy.",
            "source": source,
            "timestamp": datetime.now(timezone.utc),
            "username": username,
            "details": {
                "nlp_features": {"intent": "Policy Verified", "urgency_detected": False, "keywords": []}
            }
        }
        await save_scan_result(result, username)
        return result
    elif list_check == "blacklist":
        result = {
            "type": "message",
            "content": message,
            "risk_score": 100.0,
            "classification": "Scam Message",
            "threat_level": "Dark Red",
            "explanation": "CRITICAL WARNING: This message content or signature matches a known threat pattern explicitly blacklisted by an administrator.",
            "source": source,
            "timestamp": datetime.now(timezone.utc),
            "username": username,
            "details": {
                "nlp_features": {"intent": "Blacklist Policy Match", "urgency_detected": True, "keywords": ["blacklisted"]}
            }
        }
        await save_scan_result(result, username)
        return result

    urls = extract_urls(message)
    
    if urls:
        # If message contains URLs, we prioritize URL scanning
        url_results = []
        worst_score = 0.0
        worst_result = None
        
        for url in urls:
            res = await scan_url_flow(url, source=source, username=username)
            url_results.append(res)
            if res["risk_score"] > worst_score:
                worst_score = res["risk_score"]
                worst_result = res
                
        # If any link is dangerous, inherit its risk score & explanation
        if worst_result:
            # We save an entry in history representing the full message scan as well
            nlp = analyze_message_text(message)
            if worst_result["risk_score"] > 30:
                explanation = f"This message contains a dangerous/suspicious link: {worst_result['content']}.\n\n{worst_result['explanation']}"
            else:
                explanation = f"This message contains a safe link: {worst_result['content']}.\n\n{worst_result['explanation']}"
            overall_result = {
                "type": "message",
                "content": message,
                "risk_score": worst_result["risk_score"],
                "classification": worst_result["classification"],
                "threat_level": worst_result["threat_level"],
                "explanation": explanation,
                "source": source,
                "timestamp": datetime.now(timezone.utc),
                "username": username,
                "details": {
                    "nlp_features": {
                        "intent": nlp["intent"],
                        "urgency_detected": nlp["urgency_detected"],
                        "keywords": nlp["keywords"]
                    },
                    "url_scans": [{"url": r["content"], "risk_score": r["risk_score"], "classification": r["classification"]} for r in url_results]
                }
            }
            await save_scan_result(overall_result, username)
            return overall_result

    # If no URLs or all URLs are safe, run NLP Text Scam & Fake News classifier
    nlp = analyze_message_text(message)
    ml_res = predict_text_scam(message)
    
    pred_label = ml_res["label"]
    probs = ml_res["probabilities"]
    
    # Calculate Risk Score
    # Safe is base subtraction, Scam and Fake News drive the score
    if pred_label == "Safe":
        risk_score = probs["Scam"] * 60 + probs["Fake News"] * 40
    elif pred_label == "Scam":
        risk_score = 60 + probs["Scam"] * 30
    else:  # Fake News
        risk_score = 50 + probs["Fake News"] * 30
        
    # Urgency adds risk
    if nlp["urgency_detected"]:
        risk_score += 12
        
    risk_score = float(max(0.0, min(100.0, risk_score)))
    
    # Classification & Threat Level Mapping
    classification = "Safe Message"
    if pred_label == "Scam":
        classification = "Scam Message"
    elif pred_label == "Fake News":
        classification = "Fake News"
    elif risk_score > 30:
        classification = "Suspicious Message"
        
    threat_level = calculate_threat_level(risk_score, classification)
    
    # Build threat signals
    threat_signals = []
    if pred_label == "Scam":
        threat_signals.append("Machine learning pipeline classified message content as a scam.")
    elif pred_label == "Fake News":
        threat_signals.append("Message matches structural and keyword profiles of fake news / misinformation.")
    if nlp["urgency_detected"]:
        threat_signals.append("High urgency or pressure tactics detected in language.")
    if nlp["intent"] != "General Communication":
        threat_signals.append(f"Intent classified as: {nlp['intent']}")
        
    # Get explanation
    explanation = await generate_safety_explanation(
        content_type="message",
        content=message,
        classification=classification,
        risk_score=risk_score,
        threat_signals=threat_signals
    )
    
    result = {
        "type": "message",
        "content": message,
        "risk_score": risk_score,
        "classification": classification,
        "threat_level": threat_level,
        "explanation": explanation,
        "source": source,
        "timestamp": datetime.now(timezone.utc),
        "username": username,
        "details": {
            "nlp_features": {
                "intent": nlp["intent"],
                "urgency_detected": nlp["urgency_detected"],
                "keywords": nlp["keywords"],
                "entities": nlp["entities"]
            }
        }
    }
    
    await save_scan_result(result, username)
    return result

async def save_scan_result(result: dict, username: str = None, email: str = None):
    """
    Saves the formatted scan result inside MongoDB.
    """
    db = await get_db()
    if db is None:
        logger.warning("MongoDB not initialized, cannot save scan result.")
        return
        
    try:
        db_record = result.copy()
        resolved_email = email
        if username:
            db_record["username"] = username
            if not resolved_email:
                user_doc = await db.users.find_one({"username": username})
                if user_doc:
                    resolved_email = user_doc.get("email")
                    
        if resolved_email:
            db_record["email"] = resolved_email
            result["email"] = resolved_email
            
        # Insert
        insert_res = await db.scan_history.insert_one(db_record)
        result["id"] = str(insert_res.inserted_id)
        
        # If dangerous (Risk > 30), also copy to threat_reports
        if result["risk_score"] > 30:
            report_record = db_record.copy()
            report_record["scan_id"] = result["id"]
            if "_id" in report_record:
                del report_record["_id"]
            await db.threat_reports.insert_one(report_record)
            
    except Exception as e:
        logger.error(f"Failed to save scan to database: {e}")
        result["id"] = "mocked_db_id"
