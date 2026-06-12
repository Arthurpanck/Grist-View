#!/usr/bin/env python3
"""
Scraper des forums Boursorama
Collecte les données des 10 forums les plus lus à 8h et 17h via Yahoo Finance
"""

import subprocess
import sys

# Installer les packages s'ils manquent
packages = ['yfinance', 'openpyxl']
for package in packages:
    try:
        __import__(package)
    except ImportError:
        print(f"Installation de {package}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", package, "-q"])

import yfinance as yf
from openpyxl import load_workbook, Workbook
from datetime import datetime
import time
import os
from concurrent.futures import ThreadPoolExecutor
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configuration - Symboles Yahoo Finance
FORUMS = {
    "CAC 40": ("CAC", 1, "^FCHI"),
    "INNATE PHARMA": ("IPH", 2, "IPH.PA"),
    "HAFFNER ENERGY": ("ALHAF", 3, "ALHAF.PA"),
    "NANOBIOTIX": ("NANO", 4, "NANO.PA"),
    "CROSSJECT": ("ALCJ", 5, "ALCJ.PA"),
    "2CRSI": ("AL2SI", 6, "AL2SI.PA"),
    "AIR LIQUIDE": ("AI", 7, "AI.PA"),
    "ADOCIA": ("ADOC", 8, "ADOC.PA"),
    "TELEPERFORMANCE": ("TEP", 9, "TEP.PA"),
    "VUSION": ("VU", 10, "VU.PA"),
}

FILE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Forum_Boursorama_Suivi.xlsx")

def get_price_variation(nom, symbol):
    """Récupère le prix et variation d'un symbole Yahoo Finance avec fallback"""
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="1d")
        time.sleep(0.5)

        if not hist.empty:
            price = hist['Close'].iloc[-1]
            open_price = hist['Open'].iloc[-1]
            variation = ((price - open_price) / open_price * 100) if open_price else 0
            return price, variation
        else:
            return None, None

    except Exception as e:
        return None, None

def creer_fichier_base():
    """Crée le fichier XLSX de base s'il n'existe pas"""
    wb = Workbook()

    # Sheet Forums
    ws_forums = wb.active
    ws_forums.title = "Forums"

    headers = ["N°", "Nom du Forum", "Code", "Symbole Yahoo Finance"]
    for col, header in enumerate(headers, 1):
        ws_forums.cell(row=1, column=col).value = header

    for nom, (code, num, symbol) in FORUMS.items():
        ws_forums.cell(row=num+1, column=1).value = num
        ws_forums.cell(row=num+1, column=2).value = nom
        ws_forums.cell(row=num+1, column=3).value = code
        ws_forums.cell(row=num+1, column=4).value = symbol

    # Sheet Historique
    ws_data = wb.create_sheet("Historique")
    history_headers = ["Date", "Heure", "Num Forum", "Nom Forum", "Code", "Valeur", "Variation (%)"]
    for col, header in enumerate(history_headers, 1):
        ws_data.cell(row=1, column=col).value = header

    # Sheet Analyses
    ws_summary = wb.create_sheet("Analyses")
    ws_summary['A1'].value = "Resume des Donnees"

    wb.save(FILE_PATH)
    print(f"Fichier cree: {FILE_PATH}")

def ajouter_donnees():
    """Ajoute les donnees actuelles au fichier XLSX"""

    # Creer le fichier s'il n'existe pas
    if not os.path.exists(FILE_PATH):
        creer_fichier_base()

    # Charger le fichier
    wb = load_workbook(FILE_PATH)
    ws_data = wb["Historique"]

    # Trouver la prochaine ligne vide
    next_row = 2
    while ws_data[f'A{next_row}'].value is not None:
        next_row += 1

    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M:%S")

    print(f"\nScraping des donnees a {time_str}...")

    # Scraper en parallele (rapide)
    def fetch_data(item):
        nom, (code, num, symbol) = item
        price, variation = get_price_variation(nom, symbol)
        return (nom, code, num, price, variation)

    with ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(fetch_data, FORUMS.items()))

    # Ajouter les resultats au fichier
    for nom, code, num, price, variation in results:
        row = next_row
        ws_data[f'A{row}'].value = date_str
        ws_data[f'B{row}'].value = time_str
        ws_data[f'C{row}'].value = num
        ws_data[f'D{row}'].value = nom
        ws_data[f'E{row}'].value = code
        ws_data[f'F{row}'].value = price if price else "N/A"
        ws_data[f'G{row}'].value = f"{variation:.2f}%" if variation is not None else "N/A"

        status = "OK" if price else "Erreur"
        print(f"  {nom:20} | {price if price else 'N/A':8} | {status}")

        next_row += 1

    # Sauvegarder
    wb.save(FILE_PATH)
    print(f"\nDonnees sauvegardees dans {FILE_PATH}")

if __name__ == "__main__":
    try:
        ajouter_donnees()
        print("\nOperation completee avec succes!")
        sys.exit(0)
    except Exception as e:
        print(f"Erreur: {str(e)}")
        sys.exit(1)
