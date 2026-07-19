import os
import csv
import urllib.request
import codecs
import sys
import subprocess

def install_and_import_datasets():
    try:
        import datasets
        return datasets
    except ImportError:
        print("Hugging Face datasets library not found. Installing now...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "datasets", "pyarrow", "huggingface_hub"])
            import datasets
            return datasets
        except Exception as e:
            print(f"Failed to install Hugging Face datasets library: {e}")
            return None

def download_and_save():
    # Set a large safe limit for CSV fields to handle long Zenodo/ISOT news bodies
    csv.field_size_limit(16 * 1024 * 1024)
    
    ml_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(ml_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    
    url_records = []
    message_records = []
    
    # 1. Download Github URLs (Phishing Site URLs)
    url_csv_path = os.path.join(data_dir, "url_dataset.csv")
    print("Streaming real-world Malicious/Phishing URLs from GitHub (cyberholics mirror)...")
    url_source = "https://raw.githubusercontent.com/cyberholics/Malicious-URL-detector/master/phishing_site_urls.csv"
    
    urls_downloaded = 0
    try:
        req = urllib.request.Request(
            url_source, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            csv_reader = csv.reader(codecs.iterdecode(response, 'utf-8'))
            header = next(csv_reader) # 'URL', 'Label'
            for row in csv_reader:
                if len(row) < 2:
                    continue
                url_str = row[0]
                lbl_str = row[1].lower()
                
                # bad = 1 (phishing), good = 0 (benign)
                label = 1 if lbl_str == 'bad' else 0
                url_records.append((url_str, label))
                urls_downloaded += 1
                if urls_downloaded >= 25000:
                    break
        print(f"Successfully loaded {len(url_records)} URLs from GitHub cyberholics.")
    except Exception as e:
        print(f"Error downloading Phishing URLs from GitHub: {e}")
        
    # 2. Download Github SMS Spam/Scam TSV
    print("Downloading real-world SMS Spam/Scam dataset from GitHub...")
    sms_source = "https://raw.githubusercontent.com/justmarkham/DAT8/master/data/sms.tsv"
    try:
        req = urllib.request.Request(
            sms_source, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            tsv_reader = csv.reader(codecs.iterdecode(response, 'utf-8'), delimiter='\t')
            for row in tsv_reader:
                if len(row) < 2:
                    continue
                lbl_str = row[0].lower()
                msg_str = row[1]
                
                # ham = 0 (safe), spam = 1 (scam/fraud)
                label = 0 if lbl_str == 'ham' else 1
                message_records.append((msg_str, label))
        print(f"Successfully loaded {len(message_records)} SMS Spam/Scam messages from GitHub.")
    except Exception as e:
        print(f"Error downloading SMS Spam dataset from GitHub: {e}")
        
    # 3. Download Github Fake News articles
    print("Streaming real-world Fake vs Real News articles from GitHub (KDNuggets benchmark)...")
    fake_news_source = "https://raw.githubusercontent.com/lutzhamel/fake-news/master/data/fake_or_real_news.csv"
    
    fake_downloaded = 0
    try:
        req = urllib.request.Request(
            fake_news_source, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            csv_reader = csv.reader(codecs.iterdecode(response, 'utf-8'))
            header = next(csv_reader) # '', 'title', 'text', 'label'
            for row in csv_reader:
                if len(row) < 4:
                    continue
                title = row[1]
                text = row[2]
                lbl_str = row[3].upper()
                
                full_text = f"{title}. {text}"
                full_text = full_text[:1000]
                
                # FAKE = 2 (Fake News), REAL = 0 (Safe)
                label = 2 if lbl_str == 'FAKE' else 0
                message_records.append((full_text, label))
                fake_downloaded += 1
                if fake_downloaded >= 10000:
                    break
        print(f"Successfully loaded {fake_downloaded} Fake/Real news articles from GitHub.")
    except Exception as e:
        print(f"Error downloading Fake News from GitHub: {e}")

    # 4. Integrate Hugging Face Datasets using high-performance streaming
    datasets_lib = install_and_import_datasets()
    if datasets_lib:
        try:
            # 4a. Load imanoop7/phishing_url_classification from Hugging Face
            print("Loading 'imanoop7/phishing_url_classification' from Hugging Face (streaming)...")
            hf_urls = datasets_lib.load_dataset("imanoop7/phishing_url_classification", streaming=True)
            split_name = list(hf_urls.keys())[0]
            hf_urls_downloaded = 0
            
            # Retrieve schema key from iterator
            iterator = iter(hf_urls[split_name])
            sample_item = next(iterator)
            url_col = "url" if "url" in sample_item else ("text" if "text" in sample_item else None)
            lbl_col = "label" if "label" in sample_item else None
            
            if url_col and lbl_col:
                # Re-add sample
                url_records.append((sample_item[url_col], int(sample_item[lbl_col])))
                hf_urls_downloaded += 1
                
                for item in hf_urls[split_name]:
                    url_str = item[url_col]
                    lbl = int(item[lbl_col]) # 1 = phishing, 0 = benign
                    url_records.append((url_str, lbl))
                    hf_urls_downloaded += 1
                    if hf_urls_downloaded >= 10000:
                        break
                print(f"Successfully loaded {hf_urls_downloaded} URLs from Hugging Face.")
            else:
                print("Warning: Could not resolve columns for Hugging Face URL dataset.")
        except Exception as e:
            print(f"Error loading URLs dataset from Hugging Face: {e}")
            
        try:
            # 4b. Load GonzaloA/fake_news from Hugging Face
            print("Loading 'GonzaloA/fake_news' from Hugging Face (streaming)...")
            hf_news = datasets_lib.load_dataset("GonzaloA/fake_news", streaming=True)
            split_name = list(hf_news.keys())[0]
            hf_news_downloaded = 0
            for item in hf_news[split_name]:
                title_str = item.get("title", "")
                text_str = item.get("text", "")
                full_text = f"{title_str}. {text_str}"[:1000]
                
                # GonzaloA labels: 1 = fake (Fake News), 0 = true (Safe)
                lbl_raw = int(item["label"])
                lbl = 2 if lbl_raw == 1 else 0
                
                message_records.append((full_text, lbl))
                hf_news_downloaded += 1
                if hf_news_downloaded >= 25000:
                    break
            print(f"Successfully loaded {hf_news_downloaded} fake/true news articles from Hugging Face.")
        except Exception as e:
            print(f"Error loading fake news dataset from Hugging Face: {e}")

        try:
            # 4c. Load Arko007/fake-news-dataset from Hugging Face (9M news subset)
            print("Loading 'Arko007/fake-news-dataset' from Hugging Face (streaming)...")
            hf_arko = datasets_lib.load_dataset("Arko007/fake-news-dataset", streaming=True)
            split_name = list(hf_arko.keys())[0]
            hf_arko_downloaded = 0
            for item in hf_arko[split_name]:
                txt = item.get("text", "")
                if not txt:
                    continue
                # label: 1 = fake (Fake News), 0 = real (Safe)
                lbl_raw = item.get("label", 1)
                lbl = 2 if str(lbl_raw) in ["1", "fake", "FAKE"] else 0
                
                message_records.append((txt[:1000], lbl))
                hf_arko_downloaded += 1
                if hf_arko_downloaded >= 15000:
                    break
            print(f"Successfully loaded {hf_arko_downloaded} articles from HF Arko007 Fake News.")
        except Exception as e:
            print(f"Error loading Arko007 dataset from Hugging Face: {e}")

    # 5. Integrate UCI Machine Learning Repository (PhiUSIIL Phishing URL Dataset)
    print("Streaming real-world UCI PhiUSIIL Phishing URL Dataset (GitHub mirror)...")
    uci_source = "https://raw.githubusercontent.com/elaaatif/DATA-MINING-PhiUSIIL-Phishing-URL/main/PhiUSIIL_Phishing_URL_Dataset.csv"
    uci_downloaded = 0
    try:
        req = urllib.request.Request(
            uci_source, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            csv_reader = csv.reader(codecs.iterdecode(response, 'utf-8'))
            header = next(csv_reader) # 'URL', 'label' etc.
            url_idx = 0
            lbl_idx = 1
            if "URL" in header:
                url_idx = header.index("URL")
            if "label" in header:
                lbl_idx = header.index("label")
                
            for row in csv_reader:
                if len(row) <= max(url_idx, lbl_idx):
                    continue
                url_str = row[url_idx]
                lbl = int(row[lbl_idx])
                url_records.append((url_str, lbl))
                uci_downloaded += 1
                if uci_downloaded >= 10000:
                    break
        print(f"Successfully loaded {uci_downloaded} URLs from UCI Repository.")
    except Exception as e:
        print(f"Error downloading Phishing URLs from UCI: {e}")

    # 6. Integrate Zenodo (WELFake news dataset)
    print("Streaming real-world WELFake dataset from Zenodo...")
    zenodo_source = "https://zenodo.org/records/4561253/files/WELFake_Dataset.csv?download=1"
    zenodo_downloaded = 0
    try:
        req = urllib.request.Request(
            zenodo_source, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            csv_reader = csv.reader(codecs.iterdecode(response, 'utf-8'))
            header = next(csv_reader) # 'Unnamed: 0', 'title', 'text', 'label'
            for row in csv_reader:
                if len(row) < 4:
                    continue
                title = row[1]
                text = row[2]
                lbl_str = row[3]
                
                full_text = f"{title}. {text}"
                full_text = full_text[:1000]
                
                # WELFake: 0 = fake (Fake News), 1 = real (Safe)
                lbl_raw = int(lbl_str)
                lbl = 2 if lbl_raw == 0 else 0
                
                message_records.append((full_text, lbl))
                zenodo_downloaded += 1
                if zenodo_downloaded >= 10000:
                    break
        print(f"Successfully loaded {zenodo_downloaded} articles from Zenodo.")
    except Exception as e:
        print(f"Error downloading WELFake dataset from Zenodo: {e}")

    # 7. Integrate Papers with Code Benchmark (LIAR Dataset)
    print("Streaming LIAR dataset from Papers with Code mirror...")
    liar_source = "https://raw.githubusercontent.com/tfs4/liar_dataset/master/train.tsv"
    liar_downloaded = 0
    try:
        req = urllib.request.Request(
            liar_source, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            tsv_reader = csv.reader(codecs.iterdecode(response, 'utf-8'), delimiter='\t')
            for row in tsv_reader:
                if len(row) < 3:
                    continue
                label_str = row[1].lower()
                statement = row[2]
                
                # Mapping truthfulness:
                # false, pants-fire -> 2 (Fake News)
                # true, mostly-true -> 0 (Safe)
                if label_str in ['false', 'pants-fire']:
                    lbl = 2
                elif label_str in ['true', 'mostly-true']:
                    lbl = 0
                else:
                    continue # Skip ambiguous labels
                    
                message_records.append((statement[:1000], lbl))
                liar_downloaded += 1
                if liar_downloaded >= 10000:
                    break
        print(f"Successfully loaded {liar_downloaded} statements from LIAR dataset (Papers with Code).")
    except Exception as e:
        print(f"Error downloading LIAR dataset from Papers with Code: {e}")

    # 8. Integrate Email Spam Dataset (GitHub Mirror)
    print("Streaming real-world Email Spam dataset from GitHub (Aman Kharwal mirror)...")
    email_source = "https://raw.githubusercontent.com/amankharwal/Email-spam-detection/master/emails.csv"
    email_downloaded = 0
    try:
        req = urllib.request.Request(
            email_source, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            csv_reader = csv.reader(codecs.iterdecode(response, 'utf-8'))
            header = next(csv_reader) # 'text', 'spam'
            for row in csv_reader:
                if len(row) < 2:
                    continue
                msg_str = row[0]
                # 1 = spam (Scam), 0 = ham (Safe)
                lbl = int(row[1])
                message_records.append((msg_str[:1000], lbl))
                email_downloaded += 1
                if email_downloaded >= 10000:
                    break
        print(f"Successfully loaded {email_downloaded} emails from Email Spam dataset.")
    except Exception as e:
        print(f"Error downloading Email Spam dataset: {e}")

    # 9. Integrate Job Recruitment Scams Dataset (GitHub Mirror)
    print("Streaming real-world Job Scams dataset from GitHub (EMSCAD Aegean mirror)...")
    job_source = "https://raw.githubusercontent.com/abbylmm/fake_job_posting/main/data/fake_job_postings.csv"
    job_downloaded = 0
    try:
        req = urllib.request.Request(
            job_source, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            csv_reader = csv.reader(codecs.iterdecode(response, 'utf-8'))
            header = next(csv_reader) # Map columns dynamically
            desc_idx = 5
            lbl_idx = 17
            if "description" in header:
                desc_idx = header.index("description")
            if "fraudulent" in header:
                lbl_idx = header.index("fraudulent")
                
            for row in csv_reader:
                if len(row) <= max(desc_idx, lbl_idx):
                    continue
                desc_str = row[desc_idx]
                # 1 = fraudulent (Scam), 0 = legitimate (Safe)
                lbl = int(row[lbl_idx])
                message_records.append((desc_str[:1000], lbl))
                job_downloaded += 1
                if job_downloaded >= 10000:
                    break
        print(f"Successfully loaded {job_downloaded} job descriptions from Job Scams dataset.")
    except Exception as e:
        print(f"Error downloading Job Scams dataset: {e}")

    # 10. Integrate ISOT Fake News Dataset (Hugging Face)
    if datasets_lib:
        try:
            print("Loading 'Phoenyx83/ISOT-Fake-News-Dataset-FineTuned-2022' from Hugging Face (streaming)...")
            hf_isot = datasets_lib.load_dataset("Phoenyx83/ISOT-Fake-News-Dataset-FineTuned-2022", streaming=True)
            split_name = list(hf_isot.keys())[0]
            isot_downloaded = 0
            for item in hf_isot[split_name]:
                title = item.get("title", "")
                text = item.get("text", "")
                lbl_raw = int(item.get("label", 1))
                lbl = 2 if lbl_raw == 1 else 0
                
                full_text = f"{title}. {text}"[:1000]
                message_records.append((full_text, lbl))
                isot_downloaded += 1
                if isot_downloaded >= 5000:
                    break
            print(f"Successfully loaded {isot_downloaded} articles from Phoenyx83 ISOT Fake News Dataset.")
        except Exception as e:
            print(f"Error loading ISOT dataset from Hugging Face: {e}")

    # 11. Integrate COVID-19 Fake News Dataset (Constraint-2021 shared task from diptamath)
    print("Streaming real-world COVID-19 Fake News Dataset (Constraint_Train.csv from diptamath)...")
    covid_source = "https://raw.githubusercontent.com/diptamath/covid_fake_news/master/data/Constraint_Train.csv"
    covid_downloaded = 0
    try:
        req = urllib.request.Request(covid_source, headers={'User-Agent': 'Mozilla'})
        with urllib.request.urlopen(req) as response:
            csv_reader = csv.reader(codecs.iterdecode(response, 'utf-8'))
            next(csv_reader) # Skip header: id, tweet, label
            for row in csv_reader:
                if len(row) < 3:
                    continue
                tweet = row[1]
                lbl_str = row[2].lower()
                
                # real = 0 (Safe), fake = 2 (Fake News)
                lbl = 0 if lbl_str == 'real' else 2
                message_records.append((tweet[:1000], lbl))
                covid_downloaded += 1
                if covid_downloaded >= 5000:
                    break
        print(f"Successfully loaded {covid_downloaded} statements from COVID-19 Fake News Dataset.")
    except Exception as e:
        print(f"Error downloading COVID-19 Fake News: {e}")

    # 12. Integrate FNC-1 (Fake News Challenge stance bodies dataset)
    print("Streaming FNC-1 Dataset (train_bodies.csv from FakeNewsChallenge)...")
    fnc_source = "https://raw.githubusercontent.com/FakeNewsChallenge/fnc-1/master/train_bodies.csv"
    fnc_downloaded = 0
    try:
        req = urllib.request.Request(fnc_source, headers={'User-Agent': 'Mozilla'})
        with urllib.request.urlopen(req) as response:
            csv_reader = csv.reader(codecs.iterdecode(response, 'utf-8'))
            next(csv_reader) # Skip header: Body ID, articleBody
            for row in csv_reader:
                if len(row) < 2:
                    continue
                body = row[1]
                
                # FNC-1 body text: since it's raw news body, map it to Fake News (2)
                message_records.append((body[:1000], 2))
                fnc_downloaded += 1
                if fnc_downloaded >= 5000:
                    break
        print(f"Successfully loaded {fnc_downloaded} articles from FNC-1 Dataset.")
    except Exception as e:
        print(f"Error downloading FNC-1: {e}")

    # 13. Integrate FakeNewsNet (politifact_fake.csv & politifact_real.csv from KaiDMML)
    print("Streaming FakeNewsNet PolitiFact & GossipCop Dataset...")
    fnn_p_fake = "https://raw.githubusercontent.com/KaiDMML/FakeNewsNet/master/dataset/politifact_fake.csv"
    fnn_p_real = "https://raw.githubusercontent.com/KaiDMML/FakeNewsNet/master/dataset/politifact_real.csv"
    
    fnn_downloaded = 0
    # Process Politifact Fake
    try:
        req = urllib.request.Request(fnn_p_fake, headers={'User-Agent': 'Mozilla'})
        with urllib.request.urlopen(req) as response:
            csv_reader = csv.reader(codecs.iterdecode(response, 'utf-8'))
            next(csv_reader) # Skip header
            for row in csv_reader:
                if len(row) < 3:
                    continue
                title = row[2] # title column is 3rd (0-indexed index 2)
                message_records.append((title[:1000], 2)) # 2 = Fake News
                fnn_downloaded += 1
                if fnn_downloaded >= 2500:
                    break
    except Exception as e:
        print(f"Error downloading FakeNewsNet Politifact Fake: {e}")
        
    # Process Politifact Real
    try:
        req = urllib.request.Request(fnn_p_real, headers={'User-Agent': 'Mozilla'})
        with urllib.request.urlopen(req) as response:
            csv_reader = csv.reader(codecs.iterdecode(response, 'utf-8'))
            next(csv_reader) # Skip header
            for row in csv_reader:
                if len(row) < 3:
                    continue
                title = row[2]
                message_records.append((title[:1000], 0)) # 0 = Safe
                fnn_downloaded += 1
                if fnn_downloaded >= 5000:
                    break
        print(f"Successfully loaded {fnn_downloaded} articles from FakeNewsNet Dataset.")
    except Exception as e:
        print(f"Error downloading FakeNewsNet Politifact Real: {e}")
            
    # Write combined URL dataset
    try:
        with open(url_csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["url", "label"])
            writer.writerows(url_records)
        print(f"Successfully saved {len(url_records)} total URLs to {url_csv_path}")
    except Exception as e:
        print(f"Error saving combined URLs: {e}")
        
    # Write combined text dataset
    msg_csv_path = os.path.join(data_dir, "message_dataset.csv")
    try:
        with open(msg_csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["text", "label"])
            writer.writerows(message_records)
        print(f"Successfully saved {len(message_records)} total combined messages to {msg_csv_path}")
    except Exception as e:
        print(f"Error saving combined messages: {e}")

if __name__ == "__main__":
    download_and_save()
