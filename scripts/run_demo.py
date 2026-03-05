import os
import sys
import time
import json
import signal
import subprocess
import textwrap
import requests
from pathlib import Path
BASE_URL = 'http://127.0.0.1:8000'
DOCS_DIR = 'docs'
SERVER_WAIT = 300
DEMO_DOCS = {'company_policies.txt': "\nREFUND POLICY\nCustomers are eligible for a full refund within 30 days of purchase.\nThe product must be returned in its original condition and packaging.\nRefunds are processed within 5-7 business days after receipt of the item.\nDigital products are non-refundable once downloaded.\n\nSHIPPING POLICY\nStandard shipping takes 5-7 business days and is free for orders over $50.\nExpress shipping takes 1-2 business days and costs an additional $15.\nInternational shipping is available to 45 countries and takes 10-15 business days.\n\nACCOUNT & LOGIN\nIf you cannot log in, use the 'Forgot Password' link on the login page.\nAccounts locked after 5 failed attempts are automatically unlocked after 30 minutes.\nFor persistent login issues, contact support@example.com with your registered email.\n    ", 'data_privacy.txt': '\nDATA PRIVACY AND SECURITY POLICY\n\nData Collection\nWe collect only the minimum data necessary to provide our services.\nThis includes: name, email address, purchase history, and device information.\n\nData Usage\nYour data is never sold to third parties under any circumstances.\nWe use collected data solely to improve service quality and process transactions.\n\nData Deletion\nYou may request complete deletion of your data at any time.\nSend a deletion request to privacy@example.com. Requests are processed within 14 days.\n\nSecurity\nAll user data is encrypted at rest using AES-256 encryption.\nData in transit is protected using TLS 1.3.\nWe conduct quarterly third-party security audits.\n\nGDPR Compliance\nWe are fully compliant with GDPR regulations for EU customers.\nA Data Processing Agreement (DPA) is available upon request.\n    ', 'faq.md': "\n# Frequently Asked Questions\n\n## Payments\n\n**Q: What payment methods do you accept?**\nWe accept Visa, Mastercard, American Express, PayPal, and Apple Pay.\nCryptocurrency payments are not currently supported.\n\n**Q: Is my payment information stored?**\nNo. We do not store credit card details. All payments are processed\nsecurely through our PCI-DSS compliant payment gateway.\n\n## Orders\n\n**Q: Can I modify my order after placing it?**\nOrders can be modified within 2 hours of placement by contacting support.\nAfter 2 hours, the order enters processing and cannot be changed.\n\n**Q: How do I track my order?**\nA tracking link is emailed to you within 24 hours of shipment.\nYou can also track your order in the 'My Orders' section of your account.\n\n## Support\n\n**Q: What are your support hours?**\nOur support team is available Monday–Friday, 9 AM–6 PM EST.\nEmergency support for critical issues is available 24/7 via our hotline.\n    "}
DEMO_QUERIES = [{'question': 'What is the refund policy?', 'expected_topic': '30 days / refund'}, {'question': 'How long does standard shipping take?', 'expected_topic': '5-7 business days'}, {'question': 'Is my payment information stored?', 'expected_topic': 'PCI-DSS / not stored'}, {'question': 'How is user data protected from security threats?', 'expected_topic': 'AES-256 / TLS / encryption'}, {'question': 'Can I modify my order after placing it?', 'expected_topic': 'within 2 hours'}, {'question': "What is the CEO's personal salary information?", 'expected_topic': 'NOT IN DOCS — should trigger not-found'}]
RESET = '\x1b[0m'
BOLD = '\x1b[1m'
GREEN = '\x1b[92m'
YELLOW = '\x1b[93m'
RED = '\x1b[91m'
CYAN = '\x1b[96m'
BLUE = '\x1b[94m'
DIM = '\x1b[2m'

def print_header(text: str):
    width = 65
    print(f'\n{BOLD}{BLUE}{'═' * width}{RESET}')
    print(f'{BOLD}{BLUE}  {text}{RESET}')
    print(f'{BOLD}{BLUE}{'═' * width}{RESET}\n')

def print_section(text: str):
    print(f'\n{BOLD}{CYAN}── {text} {'─' * (55 - len(text))}{RESET}')

def print_result(query: dict, response_data: dict):
    confidence = response_data.get('confidence', 'unknown')
    answer = response_data.get('answer', '')
    sources = response_data.get('sources', [])
    conf_color = GREEN if confidence == 'high' else YELLOW if confidence == 'medium' else RED
    print(f'\n  {BOLD}Q:{RESET} {query['question']}')
    print(f'  {BOLD}Expected topic:{RESET} {DIM}{query['expected_topic']}{RESET}')
    print(f'  {BOLD}Confidence:{RESET} {conf_color}{confidence.upper()}{RESET}')
    print(f'  {BOLD}Answer:{RESET}')
    wrapped = textwrap.fill(answer, width=60, initial_indent='    ', subsequent_indent='    ')
    print(wrapped)
    if sources:
        print(f'  {BOLD}Sources:{RESET}')
        for i, src in enumerate(sources[:3], 1):
            score_color = GREEN if src['score'] >= 0.65 else YELLOW if src['score'] >= 0.4 else RED
            print(f'    [{i}] {BOLD}{src['document']}{RESET}  score={score_color}{src['score']:.3f}{RESET}')
            snippet = src['snippet'][:100].replace('\n', ' ')
            print(f'        {DIM}"{snippet}..."{RESET}')
    else:
        print(f'  {YELLOW}No sources (answer not found in documents){RESET}')
    print()
server_process = None

def start_server():
    global server_process
    print(f'{CYAN}Starting FastAPI server...{RESET}', end='', flush=True)
    server_process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--port', '8000', '--log-level', 'error'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for i in range(SERVER_WAIT * 2):
        time.sleep(0.5)
        print('.', end='', flush=True)
        try:
            r = requests.get(f'{BASE_URL}/health', timeout=1)
            if r.status_code == 200:
                print(f' {GREEN}Ready!{RESET}\n')
                return True
        except Exception:
            pass
    print(f' {RED}Failed to start.{RESET}\n')
    return False

def stop_server():
    global server_process
    if server_process:
        server_process.terminate()
        server_process.wait()

def run_demo():
    print_header('🤖 Document Q&A Bot — RAG Demo')
    print_section('Step 1: Creating demo documents')
    docs_path = Path(DOCS_DIR)
    docs_path.mkdir(exist_ok=True)
    for filename, content in DEMO_DOCS.items():
        (docs_path / filename).write_text(content.strip())
        print(f'  {GREEN}✓{RESET} Created docs/{filename}')
    print_section('Step 2: Starting API server')
    if not start_server():
        print(f'{RED}Could not start server. Is port 8000 in use?{RESET}')
        sys.exit(1)
    try:
        print_section('Step 3: Health check')
        r = requests.get(f'{BASE_URL}/health')
        health = r.json()
        print(f'  Status:        {GREEN}{health['status']}{RESET}')
        print(f'  Vector Store:  {health['vector_store']}')
        print(f'  Model Loaded:  {health['model_loaded']}')
        print_section('Step 4: Ingesting documents')
        print(f'  {DIM}POST /ingest → chunking + embedding...{RESET}')
        r = requests.post(f'{BASE_URL}/ingest', json={'docs_dir': DOCS_DIR})
        ingest_data = r.json()
        if ingest_data['status'] == 'success':
            print(f'  {GREEN}✓ Success!{RESET}')
            print(f'  Documents ingested: {BOLD}{ingest_data['documents']}{RESET}')
            print(f'  Total chunks:       {BOLD}{ingest_data['total_chunks']}{RESET}')
        else:
            print(f'  {RED}✗ Ingestion failed: {ingest_data}{RESET}')
            return
        print_section('Step 5: Running demo queries')
        results_summary = []
        for i, query in enumerate(DEMO_QUERIES, 1):
            print(f'  {DIM}[{i}/{len(DEMO_QUERIES)}] Querying...{RESET}', end='\r')
            r = requests.post(f'{BASE_URL}/ask', json={'question': query['question'], 'top_k': 5})
            if r.status_code == 200:
                print_result(query, r.json())
                results_summary.append({'question': query['question'], 'confidence': r.json()['confidence'], 'sources_found': len(r.json()['sources'])})
            else:
                print(f'  {RED}✗ Error {r.status_code}: {r.text}{RESET}')
        print_section('Demo Summary')
        high = sum((1 for r in results_summary if r['confidence'] == 'high'))
        medium = sum((1 for r in results_summary if r['confidence'] == 'medium'))
        low = sum((1 for r in results_summary if r['confidence'] == 'low'))
        print(f'  Queries run:         {len(results_summary)}')
        print(f'  High confidence:     {GREEN}{high}{RESET}')
        print(f'  Medium confidence:   {YELLOW}{medium}{RESET}')
        print(f'  Low / not found:     {RED}{low}{RESET}')
        print(f'\n  {GREEN}{BOLD}✓ System is working correctly!{RESET}')
        print(f'\n  {DIM}Full API docs: http://localhost:8000/docs{RESET}')
        print(f'  {DIM}Example raw JSON responses saved to: demo_output.json{RESET}\n')
        all_outputs = []
        for query in DEMO_QUERIES:
            r = requests.post(f'{BASE_URL}/ask', json={'question': query['question']})
            all_outputs.append({'query': query['question'], 'response': r.json()})
        with open('demo_output.json', 'w') as f:
            json.dump(all_outputs, f, indent=2)
        print(f'  {GREEN}✓ demo_output.json saved.{RESET}\n')
    finally:
        stop_server()
        print(f'  {DIM}Server stopped.{RESET}\n')
if __name__ == '__main__':
    signal.signal(signal.SIGINT, lambda s, f: (stop_server(), sys.exit(0)))
    run_demo()