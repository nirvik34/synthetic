import argparse
import json
import time
import requests
from datetime import datetime
from pathlib import Path
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://localhost:8000')
parser.add_argument('--top_k', default=5, type=int)
parser.add_argument('--output', default='evaluation_report.html')
args = parser.parse_args()
R = '\x1b[0m'
BOLD = '\x1b[1m'
GREEN = '\x1b[92m'
YELLOW = '\x1b[93m'
RED = '\x1b[91m'
CYAN = '\x1b[96m'
DIM = '\x1b[2m'
TEST_SUITE = [{'category': 'CUAD Legal', 'question': 'What are the termination conditions in the contract?', 'expected_keywords': ['terminat', 'notice', 'breach', 'cancel', 'end', 'expir'], 'should_find': True, 'source_hint': 'cuad_contract'}, {'category': 'CUAD Legal', 'question': 'What is the governing law or jurisdiction of this agreement?', 'expected_keywords': ['law', 'state', 'jurisdict', 'govern', 'court', 'delaware', 'new york', 'california'], 'should_find': True, 'source_hint': 'cuad_contract'}, {'category': 'CUAD Legal', 'question': 'What are the confidentiality obligations of the parties?', 'expected_keywords': ['confidential', 'disclose', 'secret', 'proprietary', 'non-disclos'], 'should_find': True, 'source_hint': 'cuad_contract'}, {'category': 'CUAD Legal', 'question': 'What is the limitation of liability clause?', 'expected_keywords': ['liabilit', 'damage', 'limit', 'liable', 'indirect', 'consequential'], 'should_find': True, 'source_hint': 'cuad_contract'}, {'category': 'CUAD Legal', 'question': 'What are the payment terms or fees in the agreement?', 'expected_keywords': ['pay', 'fee', 'amount', 'compensat', 'price', 'cost', 'dollar'], 'should_find': True, 'source_hint': 'cuad_contract'}, {'category': 'Wikipedia', 'question': 'What is artificial intelligence?', 'expected_keywords': ['intelligen', 'machine', 'human', 'learn', 'computer', 'system'], 'should_find': True, 'source_hint': 'wiki'}, {'category': 'Wikipedia', 'question': 'What is an algorithm?', 'expected_keywords': ['algorithm', 'step', 'procedure', 'comput', 'problem', 'instruct'], 'should_find': True, 'source_hint': 'wiki'}, {'category': 'Wikipedia', 'question': 'What is integer factorization?', 'expected_keywords': ['factor', 'integer', 'prime', 'number', 'divis'], 'should_find': True, 'source_hint': 'wiki'}, {'category': 'Wikipedia', 'question': 'What is a transformer model in machine learning?', 'expected_keywords': ['transform', 'attention', 'model', 'neural', 'language', 'nlp'], 'should_find': True, 'source_hint': 'wiki'}, {'category': 'Demo Docs', 'question': 'What is the refund policy?', 'expected_keywords': ['refund', 'day', 'return', 'purchas'], 'should_find': True, 'source_hint': 'company_policies'}, {'category': 'Demo Docs', 'question': 'How is user data encrypted and protected?', 'expected_keywords': ['encrypt', 'aes', 'tls', 'secur', 'data'], 'should_find': True, 'source_hint': 'data_privacy'}, {'category': 'Hallucination Guard', 'question': 'What is the population of Mars according to the 2024 census?', 'expected_keywords': [], 'should_find': False, 'source_hint': None}, {'category': 'Hallucination Guard', 'question': 'What is the CEO salary mentioned in the documents?', 'expected_keywords': [], 'should_find': False, 'source_hint': None}, {'category': 'Hallucination Guard', 'question': 'What are the nuclear launch codes in section 7?', 'expected_keywords': [], 'should_find': False, 'source_hint': None}]

def fuzzy_match(answer: str, keywords: list) -> bool:
    if not keywords:
        return False
    answer_lower = answer.lower()
    return any((kw.lower() in answer_lower for kw in keywords))

def is_not_found(answer: str) -> bool:
    return 'could not find' in answer.lower() or answer.strip() == ''
print(f'\n{BOLD}{CYAN}{'═' * 68}{R}')
print(f'{BOLD}{CYAN}  RAG Q&A Bot — Local Ground-Truth Evaluation{R}')
print(f'{BOLD}{CYAN}{'═' * 68}{R}\n')
try:
    r = requests.get(f'{args.url}/health', timeout=3)
    health = r.json()
    chunk_count = health.get('chunk_count', 0)
    print(f'  Server  : {GREEN}Online{R}')
    print(f'  Chunks  : {BOLD}{chunk_count}{R} indexed')
    print(f'  Tests   : {BOLD}{len(TEST_SUITE)}{R} questions across 4 categories\n')
except Exception:
    print(f'  {RED}Server offline. Run: uvicorn app.main:app --port 8000{R}\n')
    exit(1)
if chunk_count == 0:
    print(f'  {YELLOW}Warning: 0 chunks indexed. Run POST /ingest first.{R}\n')
results = []
current_category = None
total_latency = 0
print(f'  {BOLD}{'CATEGORY':<20} {'QUESTION':<42} {'CONF':<8} {'MATCH':<8} {'ms'}{R}')
print(f'  {'─' * 20} {'─' * 42} {'─' * 8} {'─' * 8} {'─' * 6}')
for tc in TEST_SUITE:
    if tc['category'] != current_category:
        current_category = tc['category']
        cat_color = CYAN if 'CUAD' in current_category else GREEN if 'Wiki' in current_category else YELLOW if 'Demo' in current_category else RED
        print(f'\n  {cat_color}{BOLD}▶ {current_category}{R}')
    start = time.time()
    try:
        resp = requests.post(f'{args.url}/ask', json={'question': tc['question'], 'top_k': args.top_k}, timeout=30)
        elapsed = int((time.time() - start) * 1000)
        total_latency += elapsed
        data = resp.json()
        answer = data.get('answer', '')
        confidence = data.get('confidence', 'low')
        sources = data.get('sources', [])
        not_found = is_not_found(answer)
        if tc['should_find']:
            matched = fuzzy_match(answer, tc['expected_keywords'])
            pass_fail = matched and (not not_found)
        else:
            pass_fail = not_found or confidence == 'low'
            matched = pass_fail
        conf_color = GREEN if confidence == 'high' else YELLOW if confidence == 'medium' else RED
        match_icon = f'{GREEN}✅ PASS{R}' if pass_fail else f'{RED}❌ FAIL{R}'
        q_short = tc['question'][:40] + ('…' if len(tc['question']) > 40 else '')
        source_name = sources[0]['document'][:20] if sources else '—'
        print(f'  {'':<20} {q_short:<42} {conf_color}{confidence:<8}{R} {match_icon}  {elapsed}ms')
        answer_preview = answer[:80].replace('\n', ' ')
        print(f'  {DIM}  → {answer_preview}{('…' if len(answer) > 80 else '')}{R}')
        results.append({'category': tc['category'], 'question': tc['question'], 'expected_keywords': tc['expected_keywords'], 'should_find': tc['should_find'], 'answer': answer, 'confidence': confidence, 'sources': [{'document': s['document'], 'score': s['score']} for s in sources], 'pass': pass_fail, 'latency_ms': elapsed})
    except Exception as e:
        elapsed = int((time.time() - start) * 1000)
        print(f'  {'':<20} {tc['question'][:40]:<42} {RED}ERROR{R}    {RED}❌ FAIL{R}  {elapsed}ms')
        results.append({**tc, 'answer': str(e), 'confidence': 'low', 'sources': [], 'pass': False, 'latency_ms': elapsed})
total = len(results)
passed = sum((1 for r in results if r['pass']))
accuracy = passed / total * 100 if total else 0
avg_lat = total_latency / total if total else 0
categories = {}
for r in results:
    cat = r['category']
    if cat not in categories:
        categories[cat] = {'pass': 0, 'total': 0}
    categories[cat]['total'] += 1
    if r['pass']:
        categories[cat]['pass'] += 1
print(f'\n\n  {BOLD}{'═' * 55}{R}')
print(f'  {BOLD}  📊 FINAL RESULTS{R}\n')
for cat, stats in categories.items():
    cat_acc = stats['pass'] / stats['total'] * 100
    color = GREEN if cat_acc >= 80 else YELLOW if cat_acc >= 50 else RED
    bar = '█' * stats['pass'] + '░' * (stats['total'] - stats['pass'])
    print(f'  {cat:<22} {color}{bar}{R}  {stats['pass']}/{stats['total']}  ({cat_acc:.0f}%)')
print(f'\n  {'─' * 55}')
print(f'  Overall Accuracy  : {BOLD}{(GREEN if accuracy >= 70 else YELLOW)}{accuracy:.1f}%{R}  ({passed}/{total} passed)')
print(f'  Avg Latency       : {BOLD}{avg_lat:.0f}ms{R} per query')
grade = '🏆 EXCELLENT' if accuracy >= 80 else '👍 GOOD' if accuracy >= 60 else '⚠️  FAIR' if accuracy >= 40 else '❌ NEEDS WORK'
grade_color = GREEN if accuracy >= 80 else YELLOW if accuracy >= 50 else RED
print(f'  Grade             : {grade_color}{BOLD}{grade}{R}\n')
with open('evaluation_results.json', 'w') as f:
    json.dump({'timestamp': datetime.now().isoformat(), 'total': total, 'passed': passed, 'accuracy_pct': round(accuracy, 1), 'avg_latency_ms': round(avg_lat, 1), 'by_category': categories, 'results': results}, f, indent=2)
rows = ''
for i, r in enumerate(results, 1):
    pass_cell = '<td style="color:#16a34a;font-weight:700">✅ PASS</td>' if r['pass'] else '<td style="color:#dc2626;font-weight:700">❌ FAIL</td>'
    conf_color = '#16a34a' if r['confidence'] == 'high' else '#d97706' if r['confidence'] == 'medium' else '#dc2626'
    cat_colors = {'CUAD Legal': '#1d4ed8', 'Wikipedia': '#059669', 'Demo Docs': '#d97706', 'Hallucination Guard': '#dc2626'}
    cat_color = cat_colors.get(r['category'], '#6b7280')
    srcs = ', '.join((s['document'] for s in r.get('sources', [])[:2])) or '—'
    rows += f'<tr>\n      <td>{i}</td>\n      <td><span style="background:{cat_color};color:white;padding:2px 8px;border-radius:4px;font-size:11px">{r['category']}</span></td>\n      <td>{r['question']}</td>\n      <td>{r['answer'][:120]}{('…' if len(r['answer']) > 120 else '')}</td>\n      {pass_cell}\n      <td style="color:{conf_color};font-weight:600">{r['confidence'].upper()}</td>\n      <td>{r['latency_ms']}ms</td>\n      <td style="font-size:11px;color:#6b7280">{srcs}</td>\n    </tr>'
cat_rows = ''.join((f'<tr><td><b>{c}</b></td><td>{s['pass']}/{s['total']}</td><td style="color:{('#16a34a' if s['pass'] / s['total'] >= 0.8 else '#d97706')}">{s['pass'] / s['total'] * 100:.0f}%</td></tr>' for c, s in categories.items()))
html = f"""<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8">\n<title>RAG Bot Evaluation Report</title>\n<style>\n  body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b;margin:0;padding:24px}}\n  .header{{background:linear-gradient(135deg,#1e3a8a,#2563eb);color:white;padding:32px;border-radius:12px;margin-bottom:24px}}\n  .header h1{{margin:0 0 6px;font-size:22px}} .header p{{margin:0;opacity:.8;font-size:13px}}\n  .grid{{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin-bottom:24px}}\n  .card{{background:white;border-radius:10px;padding:20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.08)}}\n  .card .val{{font-size:30px;font-weight:800}} .card .lbl{{font-size:11px;color:#64748b;text-transform:uppercase;margin-top:4px}}\n  .green{{color:#16a34a}} .yellow{{color:#d97706}} .red{{color:#dc2626}} .blue{{color:#2563eb}}\n  table{{width:100%;border-collapse:collapse;background:white;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);font-size:12px}}\n  th{{background:#1e3a8a;color:white;padding:10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em}}\n  td{{padding:9px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}}\n  tr:last-child td{{border-bottom:none}} tr:hover td{{background:#f8fafc}}\n  .cat-table{{width:300px;display:inline-block;vertical-align:top;margin-right:24px}}\n  h2{{font-size:15px;color:#1e3a8a;margin:24px 0 12px}}\n  .footer{{text-align:center;color:#94a3b8;font-size:11px;margin-top:16px}}\n</style></head><body>\n<div class="header">\n  <h1>📄 RAG Q&A Bot — Ground-Truth Evaluation Report</h1>\n  <p>Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} &nbsp;|&nbsp;\n     Datasets: CUAD Legal + Wikipedia AI/CS + Demo Docs &nbsp;|&nbsp;\n     Stack: all-MiniLM + CrossEncoder + flan-t5-base + ChromaDB</p>\n</div>\n\n<div class="grid">\n  <div class="card"><div class="val {('green' if accuracy >= 70 else 'yellow')}">{accuracy:.1f}%</div><div class="lbl">Accuracy</div></div>\n  <div class="card"><div class="val">{total}</div><div class="lbl">Total Tests</div></div>\n  <div class="card"><div class="val green">{passed}</div><div class="lbl">Passed</div></div>\n  <div class="card"><div class="val red">{total - passed}</div><div class="lbl">Failed</div></div>\n  <div class="card"><div class="val blue">{avg_lat:.0f}ms</div><div class="lbl">Avg Latency</div></div>\n</div>\n\n<h2>📂 Results by Category</h2>\n<table class="cat-table"><thead><tr><th>Category</th><th>Score</th><th>Accuracy</th></tr></thead>\n<tbody>{cat_rows}</tbody></table>\n\n<h2>🔍 Full Question-by-Question Results</h2>\n<table><thead><tr>\n  <th>#</th><th>Category</th><th>Question</th><th>Bot Answer</th>\n  <th>Pass</th><th>Confidence</th><th>Latency</th><th>Source</th>\n</tr></thead><tbody>{rows}</tbody></table>\n\n<div class="footer">RAG Q&amp;A Bot · Hackathon Submission · {datetime.now().year}</div>\n</body></html>"""
Path(args.output).write_text(html, encoding='utf-8')
print(f'  {GREEN}✓ HTML report → {args.output}{R}')
print(f'  {DIM}Open in browser and screenshot for submission{R}\n')
print(f'  {DIM}Raw JSON → evaluation_results.json{R}\n')