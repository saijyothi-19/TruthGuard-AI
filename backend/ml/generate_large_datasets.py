import os
import csv
import random

def generate_large_datasets():
    ml_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(ml_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    
    # --- Generate URL Dataset ---
    print("Generating 10k URL dataset (5,000 URLs + 5,000 messages)...")
    print("Step 1: Generating 5,000 URLs...")
    url_csv_path = os.path.join(data_dir, "url_dataset.csv")
    
    benign_brands = ["google", "microsoft", "apple", "amazon", "github", "wikipedia", "youtube", "netflix", 
                     "stackoverflow", "linkedin", "twitter", "reddit", "facebook", "zoom", "spotify", "yahoo",
                     "dropbox", "salesforce", "adobe", "nytimes", "cnn", "bbc", "ebay", "paypal", "chase", 
                     "bankofamerica", "hsbc", "wellsfargo", "stanford", "mit", "harvard", "nasa", "nih"]
                     
    benign_tlds = [".com", ".org", ".net", ".edu", ".gov", ".io", ".co", ".app"]
    
    phishing_keywords = ["secure", "verify", "login", "update", "billing", "free", "giftcard", "lottery", "claim", 
                         "account", "otp", "code", "wallet", "recovery", "support", "resolve", "alert", "signin",
                         "crypto", "btc", "bonus", "winner", "service", "suspended", "security"]
                         
    phishing_tlds = [".tk", ".xyz", ".club", ".info", ".top", ".gq", ".cf", ".ml", ".ga", ".click", ".support", ".secure"]
    
    url_records = []
    
    # 1. Generate Benign URLs (2,500)
    for i in range(2500):
        brand = random.choice(benign_brands)
        tld = random.choice(benign_tlds)
        sub = random.choice(["", "www.", "subdomain.", "api.", "mail."])
        path = random.choice(["", "/home", "/about", "/contact", "/search?q=query", "/dashboard/profile", 
                              "/docs/api", "/download/file.pdf", "/posts/123", "/blog/news"])
        url = f"https://{sub}{brand}{tld}{path}"
        url_records.append((url, 0))
        
    # 2. Generate Phishing URLs (2,500)
    for i in range(2500):
        brand = random.choice(benign_brands)
        keyword1 = random.choice(phishing_keywords)
        keyword2 = random.choice(phishing_keywords)
        tld = random.choice(phishing_tlds)
        
        combo = random.choice([
            f"{brand}-{keyword1}",
            f"{keyword1}-{brand}",
            f"{brand}-{keyword1}-{keyword2}",
            f"{keyword1}-{keyword2}",
        ])
        
        sub = random.choice(["", "www.", "secure.", "verify.", "login."])
        path = random.choice(["", "/login.html", "/verify-account", "/secure/update-billing", 
                              "/auth/signin.php", "/claim-bonus", "/restore-access"])
        url = f"http://{sub}{combo}{tld}{path}"
        url_records.append((url, 1))
        
    # Shuffle and save
    random.shuffle(url_records)
    with open(url_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["url", "label"])
        writer.writerows(url_records)
        
    print(f"Saved {len(url_records)} URLs to {url_csv_path}")
    
    # --- Generate Text Message Dataset ---
    print("Step 2: Generating 5,000 text messages...")
    msg_csv_path = os.path.join(data_dir, "message_dataset.csv")
    
    # Safe templates
    safe_subjects = ["meeting", "lunch", "PR review", "Kubernetes cluster", "project deadline", "grocery list", 
                     "software engineer position", "weekly report", "API documentation", "Slack huddle", 
                     "test cases", "milestones", "code refactoring", "design doc", "standup sync"]
                     
    safe_templates = [
        "Hey! Are we still on for the {} today?",
        "Can you send me the details about the {}?",
        "Please check the latest changes on the {} branch.",
        "Could you review the {} when you have some time?",
        "Let's schedule a call tomorrow to go over the {}.",
        "Hi, just wanted to check if the {} is complete.",
        "Thanks for helping with the {} yesterday!",
        "I'll be late for the {}, please start without me.",
        "Can you verify the test cases for {}?",
        "Let's catch up later to discuss the {} status."
    ]
    
    # Scam templates
    scam_templates = [
        "🚨 URGENT: Your {} account has been suspended. Verify your OTP now at {} to restore access.",
        "Congratulations! Your phone number has won {} in our yearly raffle. Claim now at {}.",
        "Get {} return on your investment in 24 hours! 100% guaranteed. Register at {}.",
        "Your {} subscription has expired. Update your billing details at {} to avoid termination.",
        "ALERT: Unauthorized login attempt detected on your {} account. Verify here: {}.",
        "Dear customer, your parcel is on hold due to unpaid customs fees. Pay now at {}.",
        "Earn {} working from home! No experience needed. Contact us on WhatsApp.",
        "Verify your crypto wallet recovery phrase at {} to prevent liquidation.",
        "URGENT: Temporary hold placed on your {} card. Verify identity: {}.",
        "Special offer: Get free {} voucher now! Valid for next 2 hours only: {}."
    ]
    
    # Fake News templates
    fake_news_templates = [
        "BREAKING: Drinking {} cures and destroys {} in 5 seconds! Share this with everyone to save lives!",
        "Scientists warn that {} emit radiation that activates {} embedded in vaccines.",
        "NASA alert: A massive {} will impact Earth tomorrow. Governments are hiding this!",
        "Shocking video shows politicians admitting that {} will be shut down next month for {} lockdown.",
        "Doctors are furious! This simple {} dissolves 10 pounds of fat overnight.",
        "Eating {} and {} together causes immediate stomach explosion. Already 50 children died in hospitals. Forward!",
        "Leaked papers prove that the government is planning to replace paper money with {} that expire.",
        "Microwave ovens alter water molecules, turning standard tap water into a highly toxic {} liquid.",
        "WHO warning: A highly contagious virus has been detected in {} tap water. Boil for 30 minutes!",
        "Leaked documents prove that {} was completely faked in a studio in Hollywood."
    ]
    
    msg_records = []
    
    # 1. Safe Messages (1,666)
    for i in range(1666):
        sub = random.choice(safe_subjects)
        tpl = random.choice(safe_templates)
        msg_records.append((tpl.format(sub), 0))
        
    # 2. Scam Messages (1,666)
    for i in range(1666):
        brand = random.choice(["Chase", "PayPal", "Amazon", "Netflix", "Google", "MetaMask", "DHL", "FedEx"])
        link = random.choice(["http://secure-verify.xyz", "http://login-update.top", "http://claim-bonus.click", 
                              "http://wallet-auth.club", "http://recovery-phrase.info"])
        amount = random.choice(["$1,000,000", "$500/day", "200% return", "5000 free points"])
        tpl = random.choice(scam_templates)
        
        # Format matching template slots
        if "{}" in tpl:
            slots = tpl.count("{}")
            if slots == 2:
                msg = tpl.format(brand, link)
            else:
                msg = tpl.format(brand) if "voucher" not in tpl else tpl.format(brand, link)
        else:
            msg = tpl
        msg_records.append((msg, 1))
        
    # 3. Fake News Messages (1,668)
    for i in range(1668):
        item1 = random.choice(["hot lemon water", "garlic tea", "onion soup", "ginger extract"])
        item2 = random.choice(["COVID-19", "influenza", "cancer", "diabetes"])
        item3 = random.choice(["5G towers", "WiFi routers", "smart meters", "Bluetooth devices"])
        item4 = random.choice(["microchips", "nanobots", "tracking sensors", "magnetic materials"])
        item5 = random.choice(["asteroid", "comet", "solar flare", "ufo fleet"])
        item6 = random.choice(["global economy", "internet grid", "power system"])
        item7 = random.choice(["digital coins", "implanted chips", "social credits"])
        
        tpl = random.choice(fake_news_templates)
        if tpl.startswith("BREAKING:"):
            msg = tpl.format(item1, item2)
        elif "radiation" in tpl:
            msg = tpl.format(item3, item4)
        elif "impact" in tpl:
            msg = tpl.format(item5)
        elif "shut down" in tpl:
            msg = tpl.format(item6, "climate")
        elif "fat" in tpl:
            msg = tpl.format(item1)
        elif "explosion" in tpl:
            msg = tpl.format(item1, "Sprite")
        elif "replace" in tpl:
            msg = tpl.format(item7)
        elif "microwave" in tpl:
            msg = tpl.format("carcinogenic")
        elif "WHO" in tpl:
            msg = tpl.format("city")
        else:
            msg = tpl.format("moon landing")
            
        msg_records.append((msg, 2))
        
    # Shuffle and save
    random.shuffle(msg_records)
    with open(msg_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["text", "label"])
        writer.writerows(msg_records)
        
    print(f"Saved {len(msg_records)} messages to {msg_csv_path}")
    print("10k datasets generated successfully!")

if __name__ == "__main__":
    generate_large_datasets()
