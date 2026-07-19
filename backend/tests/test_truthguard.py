import os
import sys
import unittest

# Append parent directories to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.utils.url_extractor import extract_url_features
from app.services.nlp_analyzer import analyze_message_text
from app.services.ml_classifier import predict_url_phishing, predict_text_scam
from app.routes.whatsapp import format_twilio_bot_reply

class TestTruthGuard(unittest.TestCase):
    
    def test_url_feature_extraction(self):
        """
        Verify that URL parser extracts structural and keywords traits accurately.
        """
        url = "http://secure-login-chase-update.tk/signin"
        features = extract_url_features(url)
        
        self.assertEqual(features["is_https"], 0)
        self.assertEqual(features["tld_score"], 1)  # .tk is suspicious
        self.assertTrue(features["susp_words_count"] >= 3)  # secure, login, update
        self.assertEqual(features["has_at"], 0)
        self.assertEqual(features["num_dots"], 1)

    def test_nlp_analysis(self):
        """
        Verify that message texts are tokenized, urgency checked, and intents classified.
        """
        msg = "🚨 ALERT: Your debit card is suspended! Send your PIN code immediately."
        nlp = analyze_message_text(msg)
        
        self.assertTrue(nlp["urgency_detected"])
        self.assertEqual(nlp["intent"], "Account Verification Alert")
        self.assertIn("suspend", nlp["clean_tokens"])  # suffix reduced
        self.assertTrue(len(nlp["keywords"]) >= 5)      # keywords count

    def test_ml_url_predictions(self):
        """
        Verify ML predictions (or fallback logic) return reasonable probabilities (0-1).
        """
        phish_url = "http://metamask-recovery-seed-wallet.xyz/index.html"
        clean_url = "https://google.com"
        
        phish_score = predict_url_phishing(phish_url)
        clean_score = predict_url_phishing(clean_url)
        
        self.assertTrue(0.0 <= phish_score <= 1.0)
        self.assertTrue(0.0 <= clean_score <= 1.0)
        self.assertTrue(phish_score > clean_score, f"Phishing url ({phish_score}) should score higher than clean url ({clean_score})")

    def test_ml_text_predictions(self):
        """
        Verify that text classification categorizes labels correctly (Safe, Scam, Fake News).
        """
        scam_text = "Congratulations you won a lottery of 1000000 dollars! Send credit card details."
        safe_text = "Hi, are we meeting at the office tomorrow for the code review?"
        fake_text = "Drinking hot lemon tea cures covid virus instantly. Government is hiding this!"
        
        scam_pred = predict_text_scam(scam_text)
        safe_pred = predict_text_scam(safe_text)
        fake_pred = predict_text_scam(fake_text)
        
        self.assertEqual(scam_pred["label"], "Scam")
        self.assertEqual(safe_pred["label"], "Safe")
        self.assertEqual(fake_pred["label"], "Fake News")

    def test_whatsapp_reply_formatter(self):
        """
        Verify that the bot reply formatter creates structured warnings for Twilio.
        """
        mock_result = {
            "type": "url",
            "content": "http://sus-paypal.tk",
            "risk_score": 95.0,
            "classification": "Phishing Website",
            "threat_level": "Red",
            "explanation": "Simulated phishing attack description.",
            "details": {
                "threat_intel": {
                    "threat_signals": ["Flagged by VirusTotal", "Suspicious TLD"]
                }
            }
        }
        reply = format_twilio_bot_reply(mock_result)
        
        self.assertIn("🚨 Dangerous Url", reply)
        self.assertIn("Risk Score: 95%", reply)
        self.assertIn("Recommendation:", reply)
        self.assertIn("Do NOT click this link.", reply)

if __name__ == "__main__":
    unittest.main()
