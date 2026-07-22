# 🚀 Chrome Web Store Extension Publication Guide

Follow these steps to publish **TruthGuard AI - Cyber Security Scanner** publicly on the Google Chrome Web Store.

---

## 📦 Step 1: Extension Package Verification

The extension files are packaged in your repository at `D:\devopsss\TruthGuard AI\chrome-extension\`:
* `manifest.json` (Manifest V3)
* `popup.html` (Extension Popup UI)
* `popup.js` (Tab Querying & Railway API Scanner)

### Create Distribution ZIP:
1. Open PowerShell or Terminal.
2. Compress the files inside `chrome-extension/`:
   ```powershell
   Compress-Archive -Path "D:\devopsss\TruthGuard AI\chrome-extension\*" -DestinationPath "D:\devopsss\TruthGuard AI\chrome-extension.zip" -Force
   ```

---

## 🌐 Step 2: Register Chrome Developer Account

1. Go to **[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)**.
2. Sign in with your Google Account (`spdudam19@gmail.com`).
3. Pay the one-time **$5 USD Developer Registration Fee** (Google requirement for anti-spam verification).

---

## 📤 Step 3: Upload Extension Package

1. Click **+ Add new item** in the top-right corner.
2. Drag and drop `chrome-extension.zip`.
3. Fill in Store Listing Metadata:
   * **Name**: TruthGuard AI - Cyber Security Scanner
   * **Summary**: Real-Time AI Phishing, Scam & Malware Detector for Chrome Tabs.
   * **Detailed Description**: TruthGuard AI automatically scans open web pages against WHOIS domain age, SSL encryption, Google Safe Browsing, and VirusTotal telemetry feeds.
   * **Category**: Productivity / Security
   * **Language**: English

---

## 🔒 Step 4: Privacy & Permissions Justification

Under the **Privacy practices** tab:
* **Single Purpose**: Real-time URL threat classification for active tabs.
* **Permissions Justification**:
  * `activeTab`: Used strictly to read the active tab URL when the user clicks "Analyze Current Website".
  * `host_permissions` (`https://truthguard-ai-production-cefd.up.railway.app/*`): Required to send URLs to the Railway backend AI scanner.

---

## ✅ Step 5: Submit for Review

1. Click **Submit for Review**.
2. Google Automated Review typically approves Manifest V3 extensions within **2 to 24 hours**.
3. Once approved, your extension will be publicly search and installable worldwide on the Chrome Web Store!
