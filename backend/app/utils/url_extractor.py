import re
from urllib.parse import urlparse

SUSPICIOUS_TLDS = {'.tk', '.xyz', '.club', '.info', '.top', '.support', '.secure', '.click', '.gq', '.cf', '.ml', '.ga'}
SUSPICIOUS_WORDS = {'login', 'secure', 'signin', 'verify', 'account', 'update', 'bank', 'free', 'lottery', 'win', 'crypto', 'bonus', 'wallet', 'claim', 'support', 'paypal', 'netflix', 'amazon', 'microsoft', 'google'}

def extract_url_features(url: str):
    """
    Extract key numerical and binary features from a URL for machine learning classification.
    """
    # Force prefix if missing for parsing
    if not url.startswith(('http://', 'https://')):
        url_for_parsing = 'http://' + url
    else:
        url_for_parsing = url
    
    try:
        parsed = urlparse(url_for_parsing)
        domain = parsed.netloc
    except Exception:
        domain = url
        parsed = None

    url_length = len(url)
    num_dots = url.count('.')
    num_slashes = url.count('/')
    num_hyphens = url.count('-')
    has_at = 1 if '@' in url else 0
    
    query_params = 0
    if parsed and parsed.query:
        query_params = len(parsed.query.split('&'))

    is_https = 1 if url.lower().startswith('https') else 0

    # IP address detection in domain
    ip_pattern = r'^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$'
    clean_domain = domain.split(':')[0] if ':' in domain else domain
    has_ip = 1 if re.match(ip_pattern, clean_domain) else 0

    # Count matching suspicious keywords in the full URL
    susp_words_count = 0
    url_lower = url.lower()
    for word in SUSPICIOUS_WORDS:
        if word in url_lower:
            susp_words_count += 1

    # TLD assessment
    tld_score = 0
    for tld in SUSPICIOUS_TLDS:
        if domain.endswith(tld):
            tld_score = 1
            break

    return {
        "url_length": url_length,
        "num_dots": num_dots,
        "num_slashes": num_slashes,
        "num_hyphens": num_hyphens,
        "has_at": has_at,
        "query_params": query_params,
        "is_https": is_https,
        "has_ip": has_ip,
        "susp_words_count": susp_words_count,
        "tld_score": tld_score
    }
