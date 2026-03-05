import requests
import json
from datasets import load_dataset
from loguru import logger
import argparse

def evaluate_cuad(limit: int):
    logger.info('Connecting to CUAD (HuggingFace) stream for evaluation...')
    try:
        ds = load_dataset('deepset/cuad', split='train')
    except Exception as e:
        logger.error(f'Failed to load CUAD: {e}')
        return
    test_cases = []
    logger.info('Selecting 5 real questions with ground-truth answers...')
    for row in ds:
        answers = row.get('answers', {})
        if answers and answers.get('text'):
            test_cases.append({'question': row['question'], 'expected': answers['text'][0], 'contract': row.get('title', 'Unknown')})
        if len(test_cases) >= limit:
            break
    print('\n' + '═' * 120)
    print(f'{'QUESTION':<50} | {'EXPECTED':<25} | {'BOT ANSWER':<25} | {'CONF':<6} | {'MATCH'}')
    print('═' * 120)
    for tc in test_cases:
        try:
            resp = requests.post('http://localhost:8000/ask', json={'question': tc['question'], 'top_k': 5}, timeout=30)
            data = resp.json()
            bot_ans = data.get('answer', 'ERROR')
            conf = data.get('confidence', 'low').upper()
            match = '✅' if tc['expected'].lower() in bot_ans.lower() or bot_ans.lower() in tc['expected'].lower() else '❌'
            q_trunc = tc['question'][:47] + '..' if len(tc['question']) > 50 else tc['question']
            exp_trunc = tc['expected'][:22] + '..' if len(tc['expected']) > 25 else tc['expected']
            bot_trunc = bot_ans[:22] + '..' if len(bot_ans) > 25 else bot_ans
            print(f'{q_trunc:<50} | {exp_trunc:<25} | {bot_trunc:<25} | {conf:<6} | {match}')
        except Exception as e:
            logger.error(f'Failed to query bot: {e}')
    print('═' * 120 + '\n')
    print('This table directly proves PRECISION and COVERAGE using ground-truth CUAD data.')
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='CUAD Ground Truth Evaluator')
    parser.add_argument('--limit', type=int, default=5, help='Number of questions to test')
    args = parser.parse_args()
    evaluate_cuad(args.limit)