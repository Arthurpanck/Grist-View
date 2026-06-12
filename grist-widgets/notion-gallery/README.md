# Galerie style Notion — Widget personnalisé pour Grist

Ce widget reproduit dans **Grist** l'intégralité de l'expérience d'une vue
**« Galerie » de Notion** : des enregistrements présentés sous forme de cartes,
avec image de couverture, propriétés typées, recherche, tri, filtre,
regroupement en sections, ouverture d'une fiche éditable, création de carte et
glisser-déposer.

Il n'utilise **aucune dépendance** : uniquement l'API officielle
`grist-plugin-api.js`. C'est du HTML/CSS/JS statique, donc hébergeable
n'importe où (GitHub Pages, Netlify, serveur interne…).

---

## 1. Installation

1. **Hébergez** le dossier `grist-widgets/notion-gallery/` sur une URL HTTPS.
   - Le plus simple : activer **GitHub Pages** sur ce dépôt, l'URL sera du type
     `https://<utilisateur>.github.io/<repo>/grist-widgets/notion-gallery/index.html`.
   - En local pour tester : `python3 -m http.server` dans le dossier, puis
     utilisez `http://localhost:8000/index.html` (Grist doit pouvoir y accéder).
2. Dans Grist, ajoutez une vue **« Custom » / « Widget personnalisé »** sur la
   table voulue.
3. Dans le panneau de droite (**Creator panel**) :
   - **URL** → collez l'URL de `index.html`.
   - **Access level** → choisissez **« Full document access »** (requis pour
     écrire les modifications, créer/supprimer des cartes, téléverser des
     pièces jointes et lire les couleurs des colonnes de choix).
4. **Mappez les colonnes** (section qui apparaît sous l'URL) :
   - **Titre** → la colonne servant de titre de carte.
   - **Image de couverture** → une colonne `Attachments` ou une colonne
     `Texte` contenant une URL d'image.
   - **Propriétés affichées** → sélectionnez (et **réordonnez par glisser**)
     les colonnes à montrer sur les cartes. L'ordre choisi ici = l'ordre
     d'affichage, exactement comme dans Notion.

> Astuce : le bouton **⚙︎ « Open configuration »** du panneau Grist ouvre le
> menu d'affichage du widget (taille des cartes, thème, etc.).

---

## 2. Fonctionnalités (parité avec la galerie Notion)

| Notion (Galerie) | Implémenté ici | Détail |
|---|---|---|
| Cartes en grille responsive | ✅ | Grille auto-fit, s'adapte à la largeur |
| Taille de carte S / M / L | ✅ | Menu ⚙︎ → *Taille des cartes* |
| Aperçu de carte (image) | ✅ | Couverture depuis pièce jointe ou URL |
| Ajuster / Remplir l'image | ✅ | ⚙︎ → *Ajustement image* (`cover`/`contain`) |
| Titre de page | ✅ | Colonne mappée *Titre*, éditable dans la fiche |
| Propriétés affichées, ordonnées | ✅ | Mapping *Propriétés affichées* (drag = ordre) |
| Afficher / masquer le nom de propriété | ✅ | ⚙︎ → *Afficher le nom des propriétés* |
| Masquer une propriété si vide | ✅ | ⚙︎ → *Masquer les propriétés vides* |
| Rendu select coloré | ✅ | Type `Choice` → pastille (couleurs Grist) |
| Rendu multi-select coloré | ✅ | Type `ChoiceList` → pastilles |
| Cases à cocher | ✅ | Type `Bool` → coche |
| Dates formatées | ✅ | Types `Date` / `DateTime` |
| Nombres / devises / % | ✅ | Respecte le format Grist (`numMode`, décimales) |
| Relations | ✅ (lecture) | `Ref` / `RefList` résolus via *visibleCol* |
| Fichiers & médias | ✅ | Vignettes + téléversement par glisser-déposer |
| Recherche | ✅ | Barre de recherche live |
| Tri (multi-niveaux) | ✅ | Bouton *Trier* |
| Filtres | ✅ | Bouton *Filtrer* (contient, est, vide, >, <, …) |
| Regroupement en sections | ✅ | Bouton *Grouper* + sections repliables |
| Ajouter une carte par section | ✅ | Bouton *Nouveau* du groupe (pré-remplit le groupe) |
| Ouvrir une carte (peek) | ✅ | Modal centrale éditable, champ par champ |
| Édition inline | ✅ | Tous types éditables (texte, nombre, date, choix, bool, pièces jointes) |
| Supprimer une carte | ✅ | Icône corbeille dans la fiche |
| Glisser-déposer pour réordonner | ✅ | Via `manualSort` (si la table en dispose) |
| Glisser une carte vers un autre groupe | ✅ | Change la valeur de la colonne de regroupement (`Choice`) |
| Thème clair / sombre | ✅ | ⚙︎ → *Thème* (Auto suit le système) |
| Persistance de la config | ✅ | Stockée via `grist.setOption` (par widget) |
| Synchronisation curseur / sections liées | ✅ | `grist.setCursorPos` à l'ouverture d'une carte |

---

## 3. Divergences Notion ↔ Grist (et comment elles sont gérées)

- **Pages vs lignes.** Dans Notion, chaque carte est une *page* avec un contenu
  riche. Grist n'a pas de pages : l'ouverture d'une carte affiche donc une
  **fiche modale** listant et éditant tous les champs mappés (équivalent du
  *peek* Notion), plutôt qu'un document.
- **Couleurs des étiquettes.** Les couleurs des `Choice`/`ChoiceList` sont lues
  depuis les `widgetOptions.choiceOptions` de Grist. À défaut, une palette
  pastel façon Notion est attribuée de façon déterministe.
- **Pièces jointes.** Grist stocke les fichiers comme *attachments* accessibles
  via un token (`getAccessToken`). Le widget gère lecture (vignettes/couverture)
  et écriture (téléversement par glisser-déposer vers `/attachments`).
- **Relations.** Les colonnes `Ref`/`RefList` sont résolues vers leur libellé
  via la *visible column* de Grist. L'édition d'une référence reste en lecture
  seule (la sélection d'enregistrements liés se fait mieux côté Grist).
- **Réordonnancement manuel.** Notion mémorise un ordre libre. Ici le
  glisser-déposer met à jour la colonne système `manualSort` (indexation
  fractionnaire) lorsqu'elle est disponible ; sinon l'option peut être
  désactivée dans ⚙︎.
- **Filtre/tri/groupe.** Notion les attache à la vue. Ici ils sont gérés par le
  widget et **persistés par widget** via `grist.setOption`, indépendamment des
  vues Grist (vous pouvez aussi continuer d'utiliser les filtres natifs de
  Grist en amont).

---

## 4. Structure du code

```
grist-widgets/notion-gallery/
├── index.html   # point d'entrée, charge grist-plugin-api.js + assets
├── style.css    # thème clair/sombre + mise en page facon Notion
├── widget.js    # toute la logique (rendu, édition, tri/filtre/groupe, DnD)
└── README.md
```

Le code est commenté et structuré en sections : métadonnées, formatage typé,
pipeline filtre/tri/groupe, rendu des cartes, fiche éditable, barre d'outils et
popovers, persistance.

---

## 5. Niveau d'accès requis

**Full document access.** Nécessaire pour : écrire les modifications
(`UpdateRecord`), créer/supprimer (`AddRecord`/`RemoveRecord`), téléverser des
pièces jointes, et lire les métadonnées de colonnes (`_grist_Tables_column`)
afin d'obtenir types et couleurs. En accès *read table*, l'affichage fonctionne
mais l'édition et les couleurs précises ne sont pas disponibles.
