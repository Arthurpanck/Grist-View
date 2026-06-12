# Routine Claude Code - Scraping Forums Boursorama

## 🎯 Objectif
Exécuter automatiquement le scraping des 10 forums les plus lus de Boursorama **à 8h et 17h chaque jour**.

---

## 📝 Prompt à Utiliser dans Claude Code

Copie ce prompt exactement pour créer ta routine Claude Code :

```
Executer le scraping des forums Boursorama en cloud et pusher les resultats sur GitHub.

ETAPE 1 - CLONER/PREPARER LE REPO:
1. git clone https://github.com/Arthurpanck/Bourse.git Bourse (ou cd Bourse si deja clone)
2. cd Bourse

ETAPE 2 - EXECUTER LE SCRIPT:
Commande: python scraper_forums_boursorama.py

CE QUE FAIT LE SCRIPT (via Yahoo Finance):
- Recupere la valeur actuelle et variation (%) de chaque forum via Yahoo Finance
- Utilise requetes paralleles (RAPIDE - ~1 seconde pour 10 tickers)
- Ajoute 10 lignes au fichier Excel: Forum_Boursorama_Suivi.xlsx
- Enregistre: Date | Heure | Num Forum | Nom Forum | Code | Valeur | Variation (%)

SI UNE VALEUR N'EST PAS TROUVEE (Valeur = N/A):
- C'est probablement un probleme de symbole Yahoo Finance
- Tenter d'autres formats de symbole:
  * Format Euronext Paris: SYMBOL.PA (ex: AI.PA pour Air Liquide)
  * Format allemand: SYMBOL.F
  * Format alternatif: ALTCODE.PA
- Verifier dans le sheet "Forums" quel symbole est utilise
- Rapporter le symbole problematique pour correction
- Exemple: Si 2CRSI n'a pas de data, verifier que le symbole est AL2SI.PA (pas 2CRSI.PA)

ETAPE 3 - COMMIT ET PUSH DIRECTEMENT SUR MAIN (BRANCHE FINALE):
Apres execution du script, pusher TOUJOURS sur la branche main:
1. git add Forum_Boursorama_Suivi.xlsx
2. git commit -m "data: forum scraping at [HH:MM on YYYY-MM-DD]" (remplacer [HH:MM on YYYY-MM-DD] par l'heure/date actuelle)
3. git push origin main

IMPORTANT - NE JAMAIS CREER DE BRANCHE TEMPORAIRE:
- TOUJOURS pusher directement sur main (origin main)
- NE PAS creer de branche feature ou temporaire
- NE PAS faire de pull request
- La branche main est la DESTINATION FINALE et UNIQUE

ETAPE 4 - RAPPORTER:
- Verifier que 10 lignes ont ete ajoutees
- Donner le lien du commit GitHub (sur main)
- Rapporter toute erreur rencontree

IMPORTANT:
- Le script s'execute en cloud, fichiers depuis GitHub
- Ne pas interrompre si le fichier Excel est verrouille
- Rapporter toute erreur de requete HTTP
- Verifier que les 10 forums ont ete scrapes (10 lignes = succes)
- VERIFIER QUE LE PUSH EST BIEN FAIT SUR MAIN (pas sur une autre branche)
```

---

## 🔄 Configuration des Routines

### Routine 1 - Matin
- **Nom:** `boursorama-forums-8h`
- **Heure:** 08:00
- **Fréquence:** Quotidienne
- **Prompt:** Copier/coller le prompt ci-dessus

### Routine 2 - Après-midi  
- **Nom:** `boursorama-forums-17h`
- **Heure:** 17:00
- **Fréquence:** Quotidienne
- **Prompt:** Copier/coller le prompt ci-dessus (identique)

---

## 📊 Donnees Collectees

### Les 10 Forums
| # | Forum | Code | Type |
|---|-------|------|------|
| 1 | CAC 40 | CAC | Indice |
| 2 | INNATE PHARMA | IPH | Biotech |
| 3 | HAFFNER ENERGY | ALHAF | Energie |
| 4 | NANOBIOTIX | NANO | Biotech |
| 5 | CROSSJECT | ALCJ | Pharma |
| 6 | 2CRSI | AL2SI | Tech |
| 7 | AIR LIQUIDE | AI | Chimie |
| 8 | ADOCIA | ADOC | Biotech |
| 9 | TELEPERFORMANCE | TEP | Services |
| 10 | VUSION | VU | Tech |

### Structure du Fichier Excel
```
Fichier: Forum_Boursorama_Suivi.xlsx

Sheet 1: Forums (Configuration)
├─ N° (1-10)
├─ Nom du Forum
├─ Code (Ticker)
└─ URL du Forum

Sheet 2: Historique (Donnees)
├─ Date (YYYY-MM-DD)
├─ Heure (HH:MM:SS)
├─ Num Forum (1-10)
├─ Nom Forum
├─ Code
├─ Valeur (Prix actuel)
└─ Variation (%) (+/- X.XX%)

Sheet 3: Analyses (Stats)
└─ Formules automatiques
```

---

## ✅ Resultat Attendu

**Chaque scraping ajoute 10 lignes** :
```
Date      | Heure    | Num | Nom Forum       | Code | Valeur  | Variation
2026-05-18| 08:00:15 | 1   | CAC 40          | CAC  | 987.49  | +0.44%
2026-05-18| 08:00:42 | 2   | INNATE PHARMA   | IPH  | 1.95    | +11.95%
2026-05-18| 08:01:08 | 3   | HAFFNER ENERGY  |ALHAF | 0.15    | +2.03%
... (7 autres forums)
```

**Statistiques:**
- Par jour: 20 lignes (10 à 8h + 10 à 17h)
- Par semaine: 140 lignes
- Par mois: ~600 lignes

---

## 🔧 Fichiers Utilises

```
C:\Users\IOO7155\Desktop\
├── scraper_forums_boursorama.py    [Script à executer]
├── Forum_Boursorama_Suivi.xlsx      [Fichier de donnees]
└── Prompt_Routine.md                [Ce fichier - guide]

GitHub Repo:
└── Bourse/
    ├── scraper_forums_boursorama.py
    ├── Forum_Boursorama_Suivi.xlsx
    └── Prompt_Routine.md
```

---

## 🚀 Démarrage

1. **Créer la routine Claude Code** avec `/schedule`
2. **Entrer le prompt** (voir section ci-dessus)
3. **Planifier à 8h et 17h**
4. **Attendre la première execution** (à 8h le lendemain)

---

## 📖 Comment lire ce fichier dans la Routine

Quand tu crées la routine, tu peux reference ce fichier:

```
Lire le fichier: C:\Users\IOO7155\Desktop\Prompt_Routine.md
Utiliser le Prompt fourni à la section "📝 Prompt à Utiliser dans Claude Code"
Executer la commande
Push les resultats sur GitHub
```

---

## ⚙️ Details Techniques

### Script Python
- **Nom:** scraper_forums_boursorama.py
- **Dépendances:** requests, beautifulsoup4, openpyxl
- **Execution:** `python "C:\Users\IOO7155\Desktop\scraper_forums_boursorama.py"`
- **Temps:** ~30 secondes (avec délais pour ne pas surcharger)
- **Sortie:** "Operation completee avec succes!" ou erreur détaillée

### Methode de Scraping
- Utilise `requests` pour télécharger les pages HTML
- Utilise `beautifulsoup4` pour parser le HTML
- Utilise `regex` pour extraire valeur et variation
- Ajoute les données à `Forum_Boursorama_Suivi.xlsx` sans écraser l'historique

### GitHub Integration
- Repo: https://github.com/[TON_USERNAME]/Bourse
- Commit message: "data: add forum scraping at [HH:MM on YYYY-MM-DD]"
- Fichiers modifiés: Forum_Boursorama_Suivi.xlsx
- Fréquence: 2 fois par jour (8h + 17h)

---

## 🐛 Troubleshooting Rapide

| Probleme | Cause | Solution |
|----------|-------|----------|
| "Permission denied" sur Excel | Fichier ouvert ou verrouillé | Attendre, il y a retry automatique |
| Erreur HTTP 403/429 | Boursorama bloque les requêtes | Augmenter les délais dans le script |
| Python non trouvé | Path incorrecte | Verifier que Python est dans PATH |
| 0 lignes ajoutées | Script n'a pas s'execute | Verifier les logs Claude Code |

---

## 📅 Exemple de Progression

```
Jour 1 (Lundi 08:00):   10 lignes (Premiere scraping)
Jour 1 (Lundi 17:00):   20 lignes total
Jour 2 (Mardi 08:00):   30 lignes total
Jour 2 (Mardi 17:00):   40 lignes total
...
Jour 30 (Jeudi):        ~600 lignes
```

Apres 1 mois → Assez de donnees pour analyser les tendances !

---

**Version:** 1.0  
**Cree:** 2026-05-18  
**Dernier update:** 2026-05-18  
**Statut:** Pret pour routine Claude Code
