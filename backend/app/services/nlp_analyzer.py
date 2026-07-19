import re
from typing import List, Dict, Any

STOPWORDS = {
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "you're", "you've", "you'll", "you'd",
    "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she", "she's", "her", "hers",
    "herself", "it", "it's", "its", "itself", "they", "them", "their", "theirs", "themselves", "what", "which",
    "who", "whom", "this", "that", "that'll", "these", "those", "am", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "having", "do", "does", "did", "doing", "a", "an", "the", "and", "but", "if",
    "or", "because", "as", "until", "while", "of", "at", "by", "for", "with", "about", "against", "between",
    "into", "through", "during", "before", "after", "above", "below", "to", "from", "up", "down", "in", "out",
    "on", "off", "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why",
    "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not",
    "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "don't", "should",
    "should've", "now", "d", "ll", "m", "o", "re", "ve", "y", "ain", "aren", "aren't", "couldn", "couldn't",
    "didn", "didn't", "doesn", "doesn't", "hadn", "hadn't", "hasn", "hasn't", "haven", "haven't", "isn", "isn't",
    "ma", "mightn", "mightn't", "mustn", "mustn't", "needn", "needn't", "shan", "shan't", "shouldn", "shouldn't",
    "wasn", "wasn't", "weren", "weren't", "won", "won't", "wouldn", "wouldn't"
}

def clean_and_tokenize(text: str) -> List[str]:
    """
    Perform lowercase normalisation, tokenization, stopword removal and simple suffix cleaning.
    """
    # Lowercase & remove basic punctuation
    text_clean = text.lower()
    text_clean = re.sub(r"[^\w\s]", "", text_clean)
    
    tokens = text_clean.split()
    
    # Filter stopwords
    filtered_tokens = [tok for tok in tokens if tok not in STOPWORDS]
    
    # Simple lemmatization heuristic (stem suffix reduction for common plurals and actions)
    lemmas = []
    for tok in filtered_tokens:
        if len(tok) > 4:
            if tok.endswith("ies"):
                tok = tok[:-3] + "y"
            elif tok.endswith("es") and not tok.endswith("ses"):
                tok = tok[:-2]
            elif tok.endswith("ed") and not tok.endswith("eed"):
                tok = tok[:-2]
            elif tok.endswith("s") and not tok.endswith("ss"):
                tok = tok[:-1]
            elif tok.endswith("ing"):
                tok = tok[:-3]
        lemmas.append(tok)
        
    return lemmas

def extract_entities(text: str) -> Dict[str, List[str]]:
    """
    Extract Named Entities such as organizations, currencies, emails, URLs, and phone numbers.
    """
    entities = {
        "organizations": [],
        "currencies": [],
        "phones": [],
        "emails": [],
        "urls": []
    }
    
    # 1. URLs
    url_pattern = r"https?://[^\s/$.?#].[^\s]*"
    urls = re.findall(url_pattern, text)
    entities["urls"] = list(set(urls))
    
    # 2. Emails
    email_pattern = r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"
    emails = re.findall(email_pattern, text)
    entities["emails"] = list(set(emails))
    
    # 3. Phones
    phone_pattern = r"\+?[0-9][0-9\-\s()]{7,15}[0-9]"
    phones = re.findall(phone_pattern, text)
    valid_phones = []
    for p in phones:
        clean_p = re.sub(r"[^\d+]", "", p)
        if len(clean_p) >= 9:
            valid_phones.append(p.strip())
    entities["phones"] = list(set(valid_phones))
    
    # 4. Currencies
    currency_pattern = r"(?:\$|€|£|₹|USD|EUR|GBP|Rs\.?)\s*\d+(?:,\d{3})*(?:\.\d+)?"
    currencies = re.findall(currency_pattern, text)
    entities["currencies"] = list(set(currencies))
    
    # 5. Organization Recognition (known high-risk scam targets)
    orgs = ["paypal", "netflix", "amazon", "microsoft", "google", "meta", "facebook", "chase", "wells fargo", "bank of america", "binance", "metamask", "whatsapp", "apple", "dhl", "fedex", "steam"]
    text_lower = text.lower()
    for org in orgs:
        if org in text_lower:
            entities["organizations"].append(org.title())
            
    return entities

def detect_intent(text: str) -> str:
    """
    Categorize user intent or scam message structure based on keyword maps.
    """
    text_lower = text.lower()
    
    if any(kw in text_lower for kw in ["suspended", "locked", "unauthorized", "verify", "update card", "billing", "action required", "debit card"]):
        return "Account Verification Alert"
    elif any(kw in text_lower for kw in ["lottery", "win", "won", "prize", "cash claim", "jackpot"]):
        return "Lottery Claim Scam"
    elif any(kw in text_lower for kw in ["crypto", "btc", "double", "investment", "guaranteed return", "bitcoin"]):
        return "Crypto Investment Scam"
    elif any(kw in text_lower for kw in ["otp", "one-time password", "verification code", "send me the code", "pin code"]):
        return "OTP Hijacking Scam"
    elif any(kw in text_lower for kw in ["dhl", "package", "delivery", "post office", "shipping"]):
        return "Fake Delivery Verification"
    
    return "General Communication"

def analyze_message_text(text: str) -> Dict[str, Any]:
    """
    Performs NLP processing and returns token, keyword, entity, intent, and urgency analysis.
    """
    tokens = clean_and_tokenize(text)
    entities = extract_entities(text)
    intent = detect_intent(text)
    
    # Urgency matching
    urgency_words = {"urgently", "immediate", "immediately", "hurry", "fast", "expire", "action required", "prevent", "lock", "block", "minutes"}
    has_urgency = any(uw in tokens or uw in text.lower().split() for uw in urgency_words)
    
    # Deduplicate tokens to find unique keywords
    seen = set()
    unique_keywords = [t for t in tokens if not (t in seen or seen.add(t))]
    
    return {
        "clean_tokens": tokens,
        "keywords": unique_keywords[:8],
        "entities": entities,
        "intent": intent,
        "urgency_detected": has_urgency,
        "length": len(text)
    }
