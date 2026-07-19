import os
import sys
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split

# Add parent directory to sys.path to allow importing from app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.utils.url_extractor import extract_url_features

def generate_url_dataset():
    """
    Generate synthetic URLs and extract features to train the phishing classifier.
    Supports loading a custom CSV dataset from backend/ml/data/url_dataset.csv.
    """
    benign_domains = [
        "google.com", "github.com", "wikipedia.org", "youtube.com", "nytimes.com",
        "microsoft.com", "apple.com", "amazon.com", "netflix.com", "stackoverflow.com",
        "linkedin.com", "twitter.com", "reddit.com", "medium.com", "zoom.us",
        "spotify.com", "bbc.co.uk", "cnn.com", "ebay.com", "paypal.com",
        "chase.com", "wellsfargo.com", "bankofamerica.com", "hsbc.com", "mit.edu",
        "stanford.edu", "harvard.edu", "nih.gov", "nasa.gov", "weather.com"
    ]
    
    phishing_domains = [
        "secure-paypal-login.tk", "verify-chase-account.xyz", "netflix-update-billing.club",
        "free-amazon-giftcard.info", "double-your-btc.top", "login-microsoft-office.support",
        "secure-bank-login-online.secure", "win-lottery-now-claim.click", "bof-verify-otp.gq",
        "get-rich-crypto.cf", "covid-vaccine-registration.ml", "facebook-security-check.ga",
        "apple-id-verify.xyz", "steam-promo-free.tk", "google-drive-shared-file.info",
        "irs-tax-refund-claim.click", "wellsfargo-alert-login.support", "blockchain-wallet-auth.top",
        "metamask-recovery-phrase.xyz", "zoom-meeting-install.club"
    ]

    urls = []
    labels = []  # 0 = Benign, 1 = Phishing

    # Generate Benign URL variations
    for dom in benign_domains:
        urls.append(f"https://{dom}")
        urls.append(f"https://www.{dom}/home")
        urls.append(f"https://{dom}/search?q=query&category=news")
        urls.append(f"https://subdomain.{dom}/dashboard/profile")
        urls.append(f"http://{dom}/about-us")
        labels.extend([0, 0, 0, 0, 0])

    # Generate Phishing URL variations
    for dom in phishing_domains:
        urls.append(f"http://{dom}")
        urls.append(f"http://{dom}/login.html")
        urls.append(f"https://{dom}/secure/update-billing")
        urls.append(f"http://{dom}/verify-account?id=83742")
        urls.append(f"http://subdomain.{dom}/login/secure-auth-verification-session")
        labels.extend([1, 1, 1, 1, 1])

    # Additional noisy patterns
    urls.append("http://192.168.1.1/admin")
    labels.append(0)
    urls.append("http://104.244.42.1/login")
    labels.append(1)
    urls.append("http://45.55.12.33/verify/paypal")
    labels.append(1)
    urls.append("http://verification-paypal-update-status-security.tk/login/signin.php?email=user")
    labels.append(1)
    urls.append("http://wellsfargo-bank-customer-alert-security-resolution.support/auth")
    labels.append(1)

    # Convert to feature matrices
    feature_list = [extract_url_features(u) for u in urls]
    df = pd.DataFrame(feature_list)
    df['label'] = labels

    # Check for custom CSV dataset
    csv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), 'data', 'url_dataset.csv'))
    if os.path.exists(csv_path):
        try:
            print(f"Loading custom URL dataset from {csv_path}...")
            custom_df = pd.read_csv(csv_path)
            if 'url' in custom_df.columns and 'label' in custom_df.columns:
                custom_df = custom_df.dropna(subset=['url', 'label'])
                custom_features = []
                custom_labels = []
                for _, row in custom_df.iterrows():
                    url_str = str(row['url'])
                    lbl = int(row['label'])
                    custom_features.append(extract_url_features(url_str))
                    custom_labels.append(lbl)
                
                custom_feat_df = pd.DataFrame(custom_features)
                custom_feat_df['label'] = custom_labels
                df = pd.concat([df, custom_feat_df], ignore_index=True)
                print(f"Successfully loaded and processed {len(custom_feat_df)} custom URLs from CSV.")
            else:
                print("Warning: Custom CSV does not contain both 'url' and 'label' columns. Skipping.")
        except Exception as e:
            print(f"Error loading custom URL dataset: {e}")

    return df

def generate_text_dataset():
    """
    Generate synthetic text messages to train the NLP classifier.
    Classes:
    - 0 = Safe
    - 1 = Scam
    - 2 = Fake News
    """
    texts = []
    labels = []

    # --- Safe (0) ---
    safe_texts = [
        "Hey! Are we still meeting for lunch today at 1 PM?",
        "Hi Mom, I reached the office safely. Will call you in the evening.",
        "Could you please review the DevOps CI/CD pipeline code and merge the PR?",
        "Please check the meeting notes from today's discussion on the Kubernetes cluster.",
        "The project deadline has been extended to next Friday. Let's plan accordingly.",
        "Don't forget to buy milk and eggs on your way back home.",
        "Hello, I am interested in applying for the software engineer position at your company.",
        "Good morning, here is the weekly report summarizing the database metrics.",
        "Hi, is the API documentation for the notification service ready yet?",
        "Thanks for the help yesterday! Really appreciate the quick troubleshooting.",
        "Let's schedule a call tomorrow morning to go over the architectural design.",
        "The weather today is expected to be sunny with a slight breeze.",
        "Can you send me the link to the shared Google Docs spreadsheet?",
        "Hey, are you free to join a quick huddle on Slack right now?",
        "I'm running about 10 minutes late. Please start the meeting without me.",
        "Just wanted to follow up on the email I sent you yesterday about the server setup.",
        "Could you verify if the test cases are passing on the staging branch?",
        "Let's catch up later today to discuss the project milestones."
    ]
    texts.extend(safe_texts)
    labels.extend([0] * len(safe_texts))

    # --- Scam (1) ---
    scam_texts = [
        "🚨 URGENT: Your bank account has been suspended due to suspicious activity. Verify your OTP immediately at http://secure-banking-login.tk to restore access.",
        "Congratulations! Your mobile number has won $1,000,000 in the TruthGuard Yearly Lottery. To claim your cash prize, email info@lottery-winner.click now.",
        "Get 200% return on your investment in just 24 hours! 100% guaranteed cryptocurrency doubled. Sign up at http://double-your-btc.top",
        "Your Netflix subscription has expired. Please update your credit card details immediately at http://netflix-update-billing.club or your service will be terminated.",
        "Dear customer, your Amazon account is locked due to an unauthorized login attempt. Confirm your identity now: http://free-amazon-giftcard.info",
        "ALERT: Someone tried to login to your Google account. If this wasn't you, verify your password here: http://apple-id-verify.xyz",
        "Earn $500/day working from home for just 2 hours! No experience required. Unlimited vacancies. Contact us on WhatsApp now!",
        "Your package from DHL cannot be delivered due to an incorrect address. Pay $1.50 handling fee to update shipping: http://dhl-package-update.tk",
        "Verify your MetaMask 12-word recovery phrase to prevent permanent wallet suspension: http://metamask-recovery-phrase.xyz",
        "Urgent Support: This is customer service calling about your account. Please share the 6-digit OTP code sent to your phone to confirm your identity.",
        "URGENT: Your parcel is on hold at our sorting facility. To dispatch, click here to pay the delivery fee: http://customs-clearance-fee.xyz",
        "Your cryptocurrency wallet has been flagged for security clearance. Authenticate your keys now to avoid liquidation: http://ledger-nano-auth.top"
    ]
    texts.extend(scam_texts)
    labels.extend([1] * len(scam_texts))

    # --- Fake News (2) ---
    fake_news_texts = [
        "Drinking hot boiled lemon water completely cures and destroys COVID-19 virus in 5 seconds! Share this with everyone you know to save lives!",
        "BREAKING: Scientific studies prove that 5G network towers emit radiation that activates microchips embedded in the recent vaccine shots.",
        "NASA announces that a massive asteroid the size of Texas will impact Earth tomorrow at 5 PM. Governments are hiding this from the public!",
        "Shocking video shows politicians admitting that the entire global economy will be shut down next month for a planned climate lockdown.",
        "Doctors are furious! This simple $5 kitchen ingredient dissolves 10 pounds of belly fat overnight while you sleep. Big Pharma doesn't want you to know!",
        "Urgent warning: Eating bananas and Sprite together causes immediate stomach explosion and death. Already 50 children died in hospitals. Forward to all groups!",
        "Leaked documents reveal that the government is planning to replace all paper currency with digital chips that expire if you don't spend them.",
        "Scientists confirm that plants have feelings and scream in pain when you cut them, proving that vegetarianism is actually cruel to nature.",
        "A secret chamber discovered under the Sphinx in Egypt contains ancient spaceship technology that was built by alien visitors 10,000 years ago.",
        "New health alert: Microwave ovens structurally alter water molecules, turning standard tap water into a highly toxic carcinogenic liquid.",
        "WHO alert: A new highly contagious virus has been detected in tap water across major cities. Boil all water for at least 30 minutes before drinking!",
        "Leaked Pentagon papers prove that the moon landing was completely filmed in a studio in Hollywood using special lighting effects."
    ]
    texts.extend(fake_news_texts)
    labels.extend([2] * len(fake_news_texts))

    # Let's expand both classes with slightly modified variations to improve robustness
    for t in safe_texts[:10]:
        texts.append(t.replace("meeting", "sync").replace("office", "home"))
        labels.append(0)
    for t in scam_texts[:10]:
        texts.append(t.replace("bank account", "debit card").replace("Verify your OTP", "Confirm your pin"))
        labels.append(1)
    for t in fake_news_texts[:10]:
        texts.append(t.replace("COVID-19", "flu").replace("lemon water", "garlic tea"))
        labels.append(2)

    df = pd.DataFrame({"text": texts, "label": labels})

    # Check for custom CSV dataset
    csv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), 'data', 'message_dataset.csv'))
    if os.path.exists(csv_path):
        try:
            print(f"Loading custom text dataset from {csv_path}...")
            custom_df = pd.read_csv(csv_path)
            if 'text' in custom_df.columns and 'label' in custom_df.columns:
                custom_df = custom_df.dropna(subset=['text', 'label'])
                custom_df['label'] = custom_df['label'].astype(int)
                # Keep only valid categories (0, 1, 2)
                custom_df = custom_df[custom_df['label'].isin([0, 1, 2])]
                df = pd.concat([df, custom_df], ignore_index=True)
                print(f"Successfully loaded {len(custom_df)} custom messages from CSV.")
            else:
                print("Warning: Custom CSV does not contain both 'text' and 'label' columns. Skipping.")
        except Exception as e:
            print(f"Error loading custom text dataset: {e}")

    return df

def train_and_save_models():
    print("Generating datasets...")
    df_url = generate_url_dataset()
    df_text = generate_text_dataset()

    print(f"URL dataset size: {len(df_url)}")
    print(f"Text dataset size: {len(df_text)}")

    # 1. Train Phishing URL Classifier
    X_url = df_url.drop(['label'], axis=1)
    y_url = df_url['label']

    X_url_train, X_url_test, y_url_train, y_url_test = train_test_split(X_url, y_url, test_size=0.2, random_state=42)

    print("Training Phishing URL model...")
    phishing_model = RandomForestClassifier(n_estimators=100, random_state=42)
    phishing_model.fit(X_url_train, y_url_train)
    
    url_score = phishing_model.score(X_url_test, y_url_test)
    print(f"Phishing URL model accuracy: {url_score * 100:.2f}%")

    # 2. Train Fake News / Scam Text Classifier
    X_text = df_text['text']
    y_text = df_text['label']

    X_text_train, X_text_test, y_text_train, y_text_test = train_test_split(X_text, y_text, test_size=0.2, random_state=42)

    print("Training Text Classification NLP pipeline...")
    nlp_pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(stop_words='english', lowercase=True, max_features=1000)),
        ('clf', LogisticRegression(random_state=42, C=1.0))
    ])
    nlp_pipeline.fit(X_text_train, y_text_train)
    
    text_score = nlp_pipeline.score(X_text_test, y_text_test)
    print(f"NLP model accuracy: {text_score * 100:.2f}%")

    # Ensure ml directory exists
    ml_dir = os.path.dirname(__file__)
    os.makedirs(ml_dir, exist_ok=True)

    phishing_path = os.path.join(ml_dir, 'phishing_model.pkl')
    fake_news_path = os.path.join(ml_dir, 'fake_news_model.pkl')

    print(f"Saving Phishing model to {phishing_path}")
    joblib.dump(phishing_model, phishing_path)

    print(f"Saving NLP model to {fake_news_path}")
    joblib.dump(nlp_pipeline, fake_news_path)
    
    print("Model training and saving completed successfully!")

if __name__ == "__main__":
    train_and_save_models()
