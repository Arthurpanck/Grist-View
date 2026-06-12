#!/usr/bin/env python3
"""
Scraper des forums Boursorama
Récupère les données des 10 forums via Yahoo Finance et met à jour Forum_Boursorama_Suivi.xlsx
"""

import requests
import time
from datetime import datetime
from openpyxl import load_workbook
from concurrent.futures import ThreadPoolExecutor, as_completed
import re

# Configuration des 10 forums
FORUMS = [
    {"num": 1, "nom": "CAC 40", "code": "^FCHI"},
    {"num": 2, "nom": "INNATE PHARMA", "code": "IPH.PA"},
    {"num": 3, "nom": "HAFFNER ENERGY", "code": "ALHAF.PA"},
    {"num": 4, "nom": "NANOBIOTIX", "code": "NANO.PA"},
    {"num": 5, "nom": "CROSSJECT", "code": "ALCJ.PA"},
    {"num": 6, "nom": "2CRSI", "code": "AL2SI.PA"},
    {"num": 7, "nom": "AIR LIQUIDE", "code": "AI.PA"},
    {"num": 8, "nom": "ADOCIA", "code": "ADOC.PA"},
    {"num": 9, "nom": "TELEPERFORMANCE", "code": "TEP.PA"},
    {"num": 10, "nom": "VUSION", "code": "VU.PA"},
]

EXCEL_FILE = "Forum_Boursorama_Suivi.xlsx"


def get_stock_data(ticker):
    """
    Récupère les données d'un ticker via une requête directe à Yahoo Finance
    Retourne: (valeur, variation_pct) ou (N/A, N/A) si erreur
    """
    try:
        # Essayer de récupérer les données via yfinance via web scraping
        url = f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}?modules=price"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }

        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            data = response.json()
            try:
                price_data = data["quoteSummary"]["result"][0]["price"]
                valeur = price_data.get("regularMarketPrice", {}).get("raw", "N/A")
                variation = price_data.get("regularMarketChangePercent", {}).get("raw", "N/A")

                if valeur != "N/A" and variation != "N/A":
                    return round(valeur, 2), round(variation, 2)
            except (KeyError, TypeError, IndexError):
                pass

        # Fallback: utiliser une autre URL
        url2 = f"https://finance.yahoo.com/quote/{ticker}"
        response2 = requests.get(url2, headers=headers, timeout=10)

        if response2.status_code == 200:
            html = response2.text
            # Chercher le prix dans le HTML
            price_match = re.search(r'data-symbol="[^"]*"[^>]*data-test="qsp-price"[^>]*>([^<]+)<', html)
            change_match = re.search(r'data-test="qsp-pe-aft-hours"[^>]*>([^<]+)<', html)

            if price_match:
                try:
                    valeur = float(price_match.group(1).replace(',', '.'))
                    variation = float(change_match.group(1).replace(',', '.').replace('%', '')) if change_match else "N/A"
                    return round(valeur, 2), round(variation, 2) if variation != "N/A" else "N/A"
                except (ValueError, AttributeError):
                    pass

        return "N/A", "N/A"

    except Exception as e:
        print(f"Erreur pour {ticker}: {e}")
        return "N/A", "N/A"


def fetch_all_stocks():
    """
    Récupère les données de tous les forums en parallèle
    """
    results = []

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(get_stock_data, forum["code"]): forum
            for forum in FORUMS
        }

        for future in as_completed(futures):
            forum = futures[future]
            try:
                valeur, variation = future.result()
                results.append({
                    **forum,
                    "valeur": valeur,
                    "variation": variation
                })
                print(f"✓ {forum['nom']} ({forum['code']}): {valeur} ({variation}%)")
            except Exception as e:
                print(f"✗ Erreur pour {forum['nom']}: {e}")
                results.append({
                    **forum,
                    "valeur": "N/A",
                    "variation": "N/A"
                })

            time.sleep(0.5)  # Délai entre les requêtes

    return sorted(results, key=lambda x: x["num"])


def update_excel(stock_data):
    """
    Met à jour le fichier Excel avec les nouvelles données
    """
    try:
        wb = load_workbook(EXCEL_FILE)
    except FileNotFoundError:
        print(f"⚠ Fichier {EXCEL_FILE} non trouvé. Création d'un nouveau...")
        from openpyxl import Workbook
        wb = Workbook()
        wb.remove(wb.active)  # Supprimer la feuille par défaut
        wb.create_sheet("Forums")
        wb.create_sheet("Historique")

    # Mettre à jour le sheet "Historique"
    try:
        ws_historique = wb["Historique"]
    except KeyError:
        ws_historique = wb.create_sheet("Historique")

    # Ajouter l'en-tête si nécessaire
    if ws_historique.max_row == 0:
        ws_historique.append(["Date", "Heure", "Num Forum", "Nom Forum", "Code", "Valeur", "Variation (%)"])

    # Ajouter les données
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    heure_str = now.strftime("%H:%M:%S")

    for data in stock_data:
        ws_historique.append([
            date_str,
            heure_str,
            data["num"],
            data["nom"],
            data["code"],
            data["valeur"],
            f"{data['variation']}%" if data['variation'] != "N/A" else "N/A"
        ])

    # Mettre à jour le sheet "Forums"
    try:
        ws_forums = wb["Forums"]
    except KeyError:
        ws_forums = wb.create_sheet("Forums", 0)

    # Ajouter l'en-tête si nécessaire
    if ws_forums.max_row == 0:
        ws_forums.append(["ID", "Nom de la valeur", "Code", "URL du Forum", "Mentions"])

    # Extraire les codes existants et leurs ID
    existing_codes = {}
    for row_idx in range(2, ws_forums.max_row + 1):
        row_code = ws_forums.cell(row_idx, 3).value
        if row_code:
            existing_codes[row_code] = row_idx

    # Mettre à jour les mentions ou ajouter de nouvelles lignes
    next_id = (ws_forums.max_row) if ws_forums.max_row > 1 else 1

    for data in stock_data:
        code = data["code"]
        if code in existing_codes:
            # Incrémenter les mentions
            row_idx = existing_codes[code]
            current_mentions = ws_forums.cell(row_idx, 5).value or 0
            ws_forums.cell(row_idx, 5).value = current_mentions + 1
        else:
            # Ajouter une nouvelle ligne
            next_id += 1
            ws_forums.append([
                next_id,
                data["nom"],
                code,
                "",  # URL du Forum
                1    # Mentions
            ])

    # Sauvegarder le fichier
    wb.save(EXCEL_FILE)
    print(f"✓ Fichier {EXCEL_FILE} mis à jour avec succès")


def main():
    print("=" * 60)
    print("SCRAPER FORUMS BOURSORAMA")
    print(f"Exécution: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    print("\n📊 Récupération des données (10 forums)...")
    stock_data = fetch_all_stocks()

    print("\n📝 Mise à jour du fichier Excel...")
    update_excel(stock_data)

    print("\n" + "=" * 60)
    print("✓ Operation completee avec succes!")
    print(f"  {len(stock_data)} lignes ajoutées à l'historique")
    print("=" * 60)


if __name__ == "__main__":
    main()
