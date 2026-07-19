import os
import joblib
from app.utils.url_extractor import extract_url_features
import logging

logger = logging.getLogger(__name__)

# Resolve model paths relative to the current file
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PHISHING_MODEL_PATH = os.path.join(BASE_DIR, "ml", "phishing_model.pkl")
FAKE_NEWS_MODEL_PATH = os.path.join(BASE_DIR, "ml", "fake_news_model.pkl")

phishing_model = None
fake_news_model = None

def load_models():
    global phishing_model, fake_news_model
    try:
        if os.path.exists(PHISHING_MODEL_PATH):
            phishing_model = joblib.load(PHISHING_MODEL_PATH)
            logger.info("Phishing URL model loaded.")
        else:
            logger.warning(f"Phishing model file not found at {PHISHING_MODEL_PATH}")

        if os.path.exists(FAKE_NEWS_MODEL_PATH):
            fake_news_model = joblib.load(FAKE_NEWS_MODEL_PATH)
            logger.info("Fake news / Scam text model loaded.")
        else:
            logger.warning(f"Fake news/Scam model file not found at {FAKE_NEWS_MODEL_PATH}")
    except Exception as e:
        logger.error(f"Error loading machine learning models: {e}")

# Load models on import
load_models()

def predict_url_phishing(url: str) -> float:
    """
    Returns probability of URL being phishing (0.0 to 1.0).
    """
    global phishing_model
    if phishing_model is None:
        # Fallback to simple rule-based score if model is not loaded
        features = extract_url_features(url)
        score = 0.1
        if features["is_https"] == 0:
            score += 0.2
        if features["susp_words_count"] > 0:
            score += min(0.3 * features["susp_words_count"], 0.6)
        if features["tld_score"] > 0:
            score += 0.3
        return min(score, 1.0)
    
    try:
        features = extract_url_features(url)
        feature_keys = ["url_length", "num_dots", "num_slashes", "num_hyphens", "has_at", "query_params", "is_https", "has_ip", "susp_words_count", "tld_score"]
        features_vector = [features[k] for k in feature_keys]
        
        probs = phishing_model.predict_proba([features_vector])[0]
        return float(probs[1])
    except Exception as e:
        logger.error(f"Error predicting phishing URL: {e}")
        return 0.5

def predict_text_scam(text: str) -> dict:
    """
    Predicts if a message text is Safe (0), Scam (1), or Fake News (2).
    """
    global fake_news_model
    if fake_news_model is None:
        # Heuristics fallback
        text_lower = text.lower()
        scam_keywords = ["otp", "win", "lottery", "prize", "suspended", "verify your account", "crypto double", "urgently", "giftcard", "bank details", "netflix-update"]
        fake_news_keywords = ["cures covid", "5g towers", "government hiding", "boiling hot water", "microchips", "nasa asteroid", "climate lockdown"]
        
        scam_hits = sum(1 for kw in scam_keywords if kw in text_lower)
        fake_hits = sum(1 for kw in fake_news_keywords if kw in text_lower)
        
        if scam_hits > 0:
            return {"label": "Scam", "probabilities": {"Safe": 0.1, "Scam": 0.8, "Fake News": 0.1}}
        elif fake_hits > 0:
            return {"label": "Fake News", "probabilities": {"Safe": 0.1, "Scam": 0.1, "Fake News": 0.8}}
        else:
            return {"label": "Safe", "probabilities": {"Safe": 0.9, "Scam": 0.05, "Fake News": 0.05}}
            
    try:
        label_id = int(fake_news_model.predict([text])[0])
        probs = fake_news_model.predict_proba([text])[0]
        
        class_mapping = {0: "Safe", 1: "Scam", 2: "Fake News"}
        return {
            "label": class_mapping.get(label_id, "Safe"),
            "probabilities": {
                "Safe": float(probs[0]),
                "Scam": float(probs[1]),
                "Fake News": float(probs[2])
            }
        }
    except Exception as e:
        logger.error(f"Error predicting text scam: {e}")
        return {"label": "Safe", "probabilities": {"Safe": 1.0, "Scam": 0.0, "Fake News": 0.0}}
