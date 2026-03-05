import os
import argparse
from datasets import load_dataset
from pathlib import Path
from loguru import logger

def clean_filename(title: str) -> str:
    return ''.join((c if c.isalnum() else '_' for c in title))

def import_wikipedia(subset: str, topic: str, limit: int, output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    logger.info(f'Connecting to Wikipedia ({subset}) stream...')
    try:
        ds = load_dataset('wikipedia', subset, split='train', streaming=True, trust_remote_code=True)
    except Exception as e:
        logger.error(f'Failed to load Wikipedia {subset}: {e}')
        return
    logger.info(f"Filtering for topic: '{topic}'...")
    count = 0
    for article in ds:
        title = article['title']
        text = article['text']
        if topic.lower() in title.lower() or topic.lower() in text.lower()[:1000]:
            filename = f'wiki_{subset}_{clean_filename(title)}.txt'
            filepath = Path(output_dir) / filename
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(f'SOURCE: Wikipedia ({subset})\nTITLE: {title}\n\n{text}')
            count += 1
            if count >= limit:
                break
            if count % 10 == 0:
                logger.info(f'Imported {count}/{limit} articles...')
    logger.success(f'Import complete: {count} articles saved.')

def import_cuad(limit: int, output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    logger.info('Connecting to CUAD (HuggingFace) stream...')
    try:
        ds = load_dataset('theatticusproject/cuad', split='train', streaming=True)
    except Exception as e:
        logger.error(f'Failed to load CUAD: {e}')
        return
    saved = 0
    for row in ds:
        text = row.get('text', '')
        if len(text.strip()) > 1000:
            title_raw = f'cuad_contract_{saved}'
            filename = f'{title_raw}.txt'
            filepath = Path(output_dir) / filename
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(f'SOURCE: CUAD Legal Dataset\nTITLE: {title_raw}\n\n{text}')
            saved += 1
            logger.info(f'Saved contract [{saved}] length={len(text)}')
            if saved >= limit:
                break
    logger.success(f'Import complete: {saved} contracts saved to {output_dir}')
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Mandatory Dataset Importer')
    parser.add_argument('--source', type=str, required=True, choices=['wiki_2020', 'wiki_2023', 'cuad'], help='Dataset source to import')
    parser.add_argument('--topic', type=str, default='Artificial Intelligence', help='Topic for Wikipedia')
    parser.add_argument('--limit', type=int, default=10, help='Number of items to import')
    parser.add_argument('--output', type=str, default='docs', help='Output directory')
    args = parser.parse_args()
    if args.source == 'wiki_2020':
        import_wikipedia('20220301.en', args.topic, args.limit, args.output)
    elif args.source == 'wiki_2023':
        import_wikipedia('20220301.en', args.topic, args.limit, args.output)
    elif args.source == 'cuad':
        import_cuad(args.limit, args.output)