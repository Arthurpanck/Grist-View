#!/usr/bin/env python3
"""
Scraper des discussions du forum Boursorama - PHASE 1
Scrape 100+ pages et exporte en CSV pour analyse agent
"""

import subprocess
import sys
import os
import re
import csv
from datetime import datetime

# Install required packages
packages = ['firecrawl-py']
for package in packages:
    try:
        __import__(package.replace('-', '_'))
    except ImportError:
        print(f"Installation de {package}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", package, "-q"])

from firecrawl import FirecrawlApp

# Configuration
API_KEY = "fc-794c0ef010f249599decb7cb0df90eb4"
FORUM_URL = "https://www.boursorama.com/bourse/forum/messages-recommandes/details/"
OUTPUT_CSV = "/home/user/Bourse/Forum_Discussions_Brutes.csv"

def scrape_forum_pages(limit=100):
    """Scrape les pages du forum avec Firecrawl"""
    print(f"🔥 Scraping {FORUM_URL}...")
    print(f"   Cible: {limit} pages\n")

    app = FirecrawlApp(api_key=API_KEY)
    all_pages = []
    failed_pages = []

    try:
        # Scraper les pages paginées
        for page_num in range(1, min(limit + 1, 101)):  # Max 100 pages
            if page_num == 1:
                url_to_scrape = FORUM_URL
            else:
                url_to_scrape = f"{FORUM_URL}page-{page_num}?period=today"

            print(f"   📄 Page {page_num:3d}...", end=" ", flush=True)

            try:
                result = app.scrape_url(
                    url_to_scrape,
                    formats=["markdown"],
                    only_main_content=True,
                )

                if result and hasattr(result, 'markdown'):
                    all_pages.append(result)
                    print(f"✅")
                else:
                    print(f"⚠️")
                    failed_pages.append(page_num)

                # Pause pour respecter le rate limit
                if page_num < limit and page_num % 3 == 0:
                    import time
                    time.sleep(2)

            except Exception as page_error:
                print(f"❌")
                failed_pages.append(page_num)
                continue

        print(f"\n✅ Scraping complété!")
        print(f"   Pages réussies: {len(all_pages)}")
        if failed_pages:
            print(f"   Pages échouées: {len(failed_pages)}\n")
        else:
            print()
        return all_pages

    except Exception as e:
        print(f"\n❌ Erreur: {str(e)}")
        return all_pages if all_pages else []

def parse_discussion_data(pages_data):
    """Parse les données des discussions"""
    discussions = []

    for page_idx, page_data in enumerate(pages_data, 1):
        content = page_data.markdown if hasattr(page_data, 'markdown') else ""

        if not content:
            continue

        # Pattern pour trouver les discussions
        discussion_pattern = r'\[([^\]]+)\]\((https?://[^\)]+)\)\s*\n\s*\n\s*\[([^\]]+)\]'
        date_pattern = r'•(\d{1,2}\s+\w+)•'
        likes_pattern = r'\*\*(\d+)\*\*\s+(?:j\'aime|commentaires|likes)'

        matches = list(re.finditer(discussion_pattern, content))

        for match_idx, match in enumerate(matches):
            title = match.group(1).strip()
            link = match.group(2).strip()
            forum = match.group(3).strip()

            start_pos = match.end()
            if match_idx < len(matches) - 1:
                section = content[start_pos:matches[match_idx + 1].start()]
            else:
                section = content[start_pos:start_pos+800]

            date_match = re.search(date_pattern, section)
            date = date_match.group(1) if date_match else "N/A"

            likes_match = re.search(likes_pattern, section)
            likes = likes_match.group(1) if likes_match else "0"

            if title and forum and link:
                discussions.append({
                    "date": date,
                    "forum": forum,
                    "titre": title,
                    "lien": link,
                    "likes": int(likes),
                    "page": page_idx
                })

    return discussions

def export_to_csv(discussions):
    """Exporte en CSV"""
    try:
        with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['date', 'forum', 'titre', 'lien', 'likes', 'page'])
            writer.writeheader()
            writer.writerows(discussions)

        print(f"✅ CSV créé: {OUTPUT_CSV}")
        print(f"   Discussions: {len(discussions)}")
        return True

    except Exception as e:
        print(f"❌ Erreur: {str(e)}")
        return False

def main():
    print("=" * 70)
    print("🚀 PHASE 1: COLLECTE MASSIVE (100+ PAGES)")
    print("=" * 70 + "\n")

    pages_data = scrape_forum_pages(limit=100)

    if not pages_data:
        print("❌ Aucune donnée")
        return False

    print(f"{'='*70}\n")
    discussions = parse_discussion_data(pages_data)

    if not discussions:
        print("❌ Aucune discussion")
        return False

    print(f"✅ {len(discussions)} discussions extraites\n")
    print(f"{'='*70}\n")
    success = export_to_csv(discussions)

    if success:
        print(f"\n{'='*70}")
        print("✨ PHASE 1 OPÉRATIONNELLE!")
        print(f"{'='*70}\n")
    return success

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ Erreur: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
