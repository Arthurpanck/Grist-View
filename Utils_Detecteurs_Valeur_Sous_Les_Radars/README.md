# 💎 Détecteur de Valeurs Sous Les Radars

Scraper et analyser les discussions du forum Boursorama pour identifier les **pépites cachées** - des valeurs boursières émergentes et non encore populaires.

## 🎯 Objectif

Détecter automatiquement les valeurs boursières mentionnées dans les forums qui ne sont **pas dans votre registre** de valeurs connues = identifier les opportunités cachées avant qu'elles ne deviennent mainstream.

## 🚀 Workflow

### Phase 1: Collecte (Scraper)
```bash
python3 scraper_phase1.py
```
- Scrape 100+ pages du forum Boursorama
- Extrait: Date | Forum | Titre | Lien | Engagement (j'aimes)
- Export: `Forum_Discussions_Brutes.csv`
- **Temps**: ~30-45 min pour 100 pages
- **Coût**: ~100 crédits Firecrawl

### Phase 2: Analyse (Agent Claude)
Analyse du CSV avec un agent qui:
- Identifie les tickers/valeurs mentionnées
- Les compare avec un registre de "valeurs connues"
- Flag les **valeurs nouvelles** = les pépites 💎
- Analyse sentiment + engagement
- Génère un rapport des opportunités

## 📁 Fichiers

- **`scraper_phase1.py`**: Script de scraping 100+ pages
- **`RAPPORT_TEST_FINAL.md`**: Analyse des résultats (4 pages testées = 24 discussions, 79% redondance)
- **`ANALYSE_TEST_SCRAPER.md`**: Notes et améliorations proposées

## 📊 Résultats du Test

- ✅ 24 discussions extraites de 4 pages
- ✅ 19 doublons détectés (79% redondance)
- ✅ 6 forums uniques identifiés
- ✅ CSV structuré et prêt pour agent

## 🔧 Configuration

```python
# Détails du scraper
API_KEY = "fc-794c0ef010f249599decb7cb0df90eb4"  # Firecrawl
FORUM_URL = "https://www.boursorama.com/bourse/forum/messages-recommandes/details/"
OUTPUT_CSV = "Forum_Discussions_Brutes.csv"
```

## 📈 Rate Limit (Plan Gratuit Firecrawl)

- Limite: 3 requêtes/minute
- Solution: Pauses intelligentes (2s entre pages)
- Pour 100 pages: ~30-45 minutes

## 🔍 Détails Techniques

### Extraction des discussions
```
Pattern regex:
[Titre](lien)
[Forum]
... texte ...
auteur •date•heure
**N** j'aimes
```

### Colonnes CSV
- `date`: Date de publication (ex: "27 mai")
- `forum`: Ticker/nom du forum (ex: "CAC 40", "NANOBIOTIX")
- `titre`: Titre de la discussion
- `lien`: URL vers la discussion complète
- `likes`: Nombre de j'aimes (engagement)
- `page`: Numéro de page scrapée

## 🚦 Status

- [x] Phase 1 - Scraper fonctionnel (testé 4 pages)
- [x] Export CSV opérationnel
- [ ] Phase 2 - Agent Claude (en cours)
- [ ] Registre des valeurs connues (à créer)
- [ ] Rapport final des pépites détectées

## 💡 Prochaines Étapes

1. Lancer `scraper_phase1.py` pour les 100 pages
2. Créer registre des valeurs connues (JSON)
3. Faire analyser le CSV par un agent Claude
4. Générer rapport des valeurs émergentes
5. Automatiser en pipeline (cron job?)

## 📝 Notes

- **Firecrawl**: API de scraping haute qualité
- **Rate limit respecté**: Pauses intelligentes entre requêtes
- **CSV propre**: Prêt pour traitement et analyse
- **Scalable**: Peut être étendu à d'autres forums ou sources

---

**Créé**: 27 mai 2026  
**Branche**: claude/dreamy-ptolemy-2iRLC (mergée sur main)  
**Status**: Opérationnel pour Phase 1 ✅
