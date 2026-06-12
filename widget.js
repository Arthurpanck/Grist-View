/* =========================================================================
 *  Notion-like Gallery — Custom Widget pour Grist
 * -------------------------------------------------------------------------
 *  Reproduit l'intégralité de l'expérience d'une vue "Galerie" de Notion :
 *  cartes responsives, image de couverture, propriétés typées (pastilles
 *  colorées select/multi-select, dates, cases à cocher, références, pièces
 *  jointes...), recherche, tri, filtre, regroupement en sections repliables,
 *  ouverture d'une carte en mode "peek" éditable, création de carte,
 *  glisser-déposer (réordonnancement + changement de groupe), thème
 *  clair/sombre et panneau de configuration persistant.
 *
 *  S'appuie uniquement sur l'API officielle grist-plugin-api.js.
 * ======================================================================= */

(function () {
  "use strict";

  // ----------------------------------------------------------------- State
  const state = {
    records: [],          // enregistrements bruts (fetchSelectedTable)
    mappings: null,       // alias -> colId(s) renvoyés par grist
    tableId: null,        // id de la table sélectionnée
    meta: {},             // colId -> { type, label, widgetOptions }
    refCache: {},         // tableId -> { rowId -> displayValue }
    accessToken: null,    // { token, baseUrl } pour les pièces jointes
    config: defaultConfig(),
    collapsed: {},        // groupes repliés
    search: "",
  };

  function defaultConfig() {
    return {
      cardSize: "medium",       // small | medium | large
      imageFit: "cover",        // cover | contain
      groupBy: "",              // colId de regroupement ("" = aucun)
      showPropNames: true,      // afficher le nom des propriétés sur la carte
      hideEmpty: true,          // masquer une propriété vide
      openMode: "modal",        // modal (peek)
      theme: "auto",            // auto | light | dark
      sort: [],                 // [{ colId, dir }]
      filters: [],              // [{ colId, op, value }]
      manualOrder: true,        // autoriser le glisser-déposer
    };
  }

  // --------------------------------------------------------- Helpers généraux
  const $ = (sel, root) => (root || document).querySelector(sel);
  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };
  const svg = (paths, size) =>
    `<svg width="${size || 16}" height="${size || 16}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

  const ICONS = {
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
    sort: svg('<path d="M11 5h10M11 9h7M11 13h4M3 17l3 3 3-3M6 18V4"/>'),
    filter: svg('<path d="M3 4h18l-7 8v6l-4 2v-8z"/>'),
    group: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    caret: svg('<path d="m6 9 6 6 6-6"/>', 14),
    close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    image: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>', 28),
    expand: svg('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
    drag: svg('<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>', 14),
    trash: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', 15),
  };

  // Palette pastel facon Notion utilisee en repli quand aucune couleur Grist
  const NOTION_COLORS = [
    ["#e3e2e0", "#37352f"], ["#eee0da", "#5c3b23"], ["#faebdd", "#5c3b23"],
    ["#fbf3db", "#564328"], ["#ddedea", "#1c3829"], ["#ddebf1", "#183347"],
    ["#eae4f2", "#412454"], ["#f4dfeb", "#5b1f42"], ["#fbe4e4", "#5d1715"],
  ];
  function colorForChoice(colId, choice) {
    const opts = (state.meta[colId] && state.meta[colId].widgetOptions) || {};
    const co = (opts.choiceOptions || {})[choice];
    if (co && (co.fillColor || co.textColor)) {
      return { bg: co.fillColor || "var(--nv-bg-hover)", fg: co.textColor || "var(--nv-text)" };
    }
    let h = 0;
    const s = String(choice);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const [bg, fg] = NOTION_COLORS[h % NOTION_COLORS.length];
    return { bg, fg };
  }

  // Décodage des valeurs encodées de Grist ('L' = liste, 'R' = référence...)
  function decodeList(v) {
    if (Array.isArray(v) && v[0] === "L") return v.slice(1);
    if (Array.isArray(v)) return v;
    if (v == null || v === "") return [];
    return [v];
  }
  function isBlank(v) {
    if (v == null || v === "") return true;
    if (Array.isArray(v)) return v.length === 0 || (v[0] === "L" && v.length === 1);
    return false;
  }

  // ------------------------------------------------------------- Métadonnées
  // Charge les types / libellés / options (couleurs des choix) des colonnes
  // ainsi que la résolution des colonnes de référence (visibleCol).
  async function loadMeta() {
    state.meta = {};
    try {
      const cols = await grist.docApi.fetchTable("_grist_Tables_column");
      const tables = await grist.docApi.fetchTable("_grist_Tables");
      const tIdx = tables.tableId.indexOf(state.tableId);
      const tableRef = tIdx >= 0 ? tables.id[tIdx] : null;
      // index colRef -> colId (pour résoudre visibleCol des références)
      const colRefToId = {};
      for (let i = 0; i < cols.id.length; i++) colRefToId[cols.id[i]] = cols.colId[i];
      for (let i = 0; i < cols.id.length; i++) {
        if (tableRef != null && cols.parentId[i] !== tableRef) continue;
        let wo = {};
        try { wo = JSON.parse(cols.widgetOptions[i] || "{}"); } catch (e) { /* noop */ }
        state.meta[cols.colId[i]] = {
          type: cols.type[i],
          label: cols.label[i] || cols.colId[i],
          widgetOptions: wo,
          visibleColId: cols.visibleCol && cols.visibleCol[i] ? colRefToId[cols.visibleCol[i]] : null,
        };
      }
    } catch (e) {
      console.warn("[gallery] métadonnées indisponibles, mode dégradé :", e.message);
    }
  }

  function colType(colId) {
    const m = state.meta[colId];
    if (m && m.type) return m.type;
    return "Any";
  }
  function baseType(colId) { return colType(colId).split(":")[0]; }
  function colLabel(colId) {
    return (state.meta[colId] && state.meta[colId].label) || colId;
  }

  // Construit une table de correspondance rowId -> libellé pour une référence
  async function ensureRefLabels(colId) {
    const t = colType(colId);
    const m = t.match(/^Ref(?:List)?:(.+)$/);
    if (!m) return;
    const refTable = m[1];
    if (state.refCache[refTable]) return;
    try {
      const data = await grist.docApi.fetchTable(refTable);
      const visCol = (state.meta[colId] && state.meta[colId].visibleColId) || guessLabelCol(data);
      const map = {};
      const ids = data.id || [];
      const labelArr = data[visCol] || ids;
      for (let i = 0; i < ids.length; i++) map[ids[i]] = formatScalar(labelArr[i]);
      state.refCache[refTable] = map;
    } catch (e) {
      state.refCache[refTable] = {};
    }
  }
  function guessLabelCol(data) {
    const prefer = ["Name", "Title", "Label", "Nom", "Titre"];
    for (const p of prefer) if (data[p]) return p;
    const keys = Object.keys(data).filter((k) => k !== "id" && !k.startsWith("manualSort") && !k.startsWith("gristHelper"));
    return keys[0] || "id";
  }
  function refLabel(colId, rowId) {
    const m = colType(colId).match(/^Ref(?:List)?:(.+)$/);
    if (!m) return String(rowId);
    const cache = state.refCache[m[1]] || {};
    return cache[rowId] != null ? cache[rowId] : "#" + rowId;
  }

  // --------------------------------------------------------- Formatage valeurs
  function formatScalar(v) {
    if (v == null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  function formatDate(colId, v) {
    if (typeof v !== "number") return formatScalar(v);
    const d = new Date(v * 1000);
    if (isNaN(d)) return formatScalar(v);
    const isDateTime = baseType(colId) === "DateTime";
    const opts = isDateTime
      ? { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
      : { year: "numeric", month: "short", day: "numeric" };
    return new Intl.DateTimeFormat(undefined, { timeZone: isDateTime ? undefined : "UTC", ...opts }).format(d);
  }

  function formatNumber(colId, v) {
    if (typeof v !== "number") return formatScalar(v);
    const wo = (state.meta[colId] && state.meta[colId].widgetOptions) || {};
    if (wo.numMode === "percent") return new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: wo.decimals ?? 2 }).format(v);
    if (wo.numMode === "currency") return new Intl.NumberFormat(undefined, { style: "currency", currency: wo.currency || "EUR" }).format(v);
    return new Intl.NumberFormat(undefined, wo.decimals != null ? { minimumFractionDigits: wo.decimals, maximumFractionDigits: wo.decimals } : {}).format(v);
  }

  // Rend une valeur dans un noeud DOM, en respectant le type Grist
  function renderValue(colId, value) {
    const wrap = el("span", "nv-prop-value");
    const t = baseType(colId);

    if (isBlank(value)) { wrap.classList.add("empty"); return wrap; }

    switch (t) {
      case "Bool": {
        const cb = el("span", "nv-check");
        cb.innerHTML = value
          ? svg('<rect x="3" y="3" width="18" height="18" rx="4" fill="var(--nv-accent)" stroke="var(--nv-accent)"/><path d="m8 12 3 3 5-6" stroke="#fff"/>', 18)
          : svg('<rect x="3" y="3" width="18" height="18" rx="4"/>', 18);
        wrap.appendChild(cb);
        break;
      }
      case "Choice": {
        const c = colorForChoice(colId, value);
        const pill = el("span", "nv-pill", formatScalar(value));
        pill.style.background = c.bg; pill.style.color = c.fg;
        wrap.appendChild(pill);
        break;
      }
      case "ChoiceList": {
        decodeList(value).forEach((ch) => {
          const c = colorForChoice(colId, ch);
          const pill = el("span", "nv-pill", formatScalar(ch));
          pill.style.background = c.bg; pill.style.color = c.fg;
          wrap.appendChild(pill);
        });
        break;
      }
      case "Date":
      case "DateTime":
        wrap.textContent = formatDate(colId, value);
        break;
      case "Numeric":
      case "Int":
        wrap.textContent = formatNumber(colId, value);
        break;
      case "Ref": {
        const tag = el("span", "nv-tag-ref", refLabel(colId, value));
        wrap.appendChild(tag);
        break;
      }
      case "RefList": {
        decodeList(value).forEach((id) => wrap.appendChild(el("span", "nv-tag-ref", refLabel(colId, id))));
        break;
      }
      case "Attachments": {
        const thumbs = el("span", "nv-thumbs");
        decodeList(value).slice(0, 6).forEach((id) => {
          const img = el("img", "nv-thumb");
          img.src = attachmentUrl(id);
          img.loading = "lazy";
          thumbs.appendChild(img);
        });
        wrap.appendChild(thumbs);
        break;
      }
      default: {
        const str = formatScalar(value);
        if (/^https?:\/\//i.test(str)) {
          const a = el("a", "nv-link", str);
          a.href = str; a.target = "_blank"; a.rel = "noopener";
          a.addEventListener("click", (e) => e.stopPropagation());
          wrap.appendChild(a);
        } else {
          wrap.textContent = str;
        }
      }
    }
    return wrap;
  }

  // Valeur "plate" utilisée pour la recherche / le tri / les filtres
  function plainValue(colId, value) {
    const t = baseType(colId);
    if (isBlank(value)) return "";
    if (t === "Choice") return formatScalar(value);
    if (t === "ChoiceList") return decodeList(value).join(" ");
    if (t === "Date" || t === "DateTime") return typeof value === "number" ? value : 0;
    if (t === "Numeric" || t === "Int") return typeof value === "number" ? value : 0;
    if (t === "Bool") return value ? 1 : 0;
    if (t === "Ref") return refLabel(colId, value);
    if (t === "RefList") return decodeList(value).map((id) => refLabel(colId, id)).join(" ");
    if (t === "Attachments") return decodeList(value).length;
    return formatScalar(value);
  }

  // ------------------------------------------------------------ Pièces jointes
  function attachmentUrl(id) {
    if (!state.accessToken) return "";
    return `${state.accessToken.baseUrl}/attachments/${id}/download?auth=${state.accessToken.token}`;
  }
  async function refreshToken() {
    try { state.accessToken = await grist.docApi.getAccessToken({ readOnly: false }); }
    catch (e) { try { state.accessToken = await grist.docApi.getAccessToken({ readOnly: true }); } catch (_) {} }
  }
  async function uploadAttachment(file) {
    if (!state.accessToken) await refreshToken();
    const url = `${state.accessToken.baseUrl}/attachments?auth=${state.accessToken.token}`;
    const fd = new FormData();
    fd.set("upload", file, file.name);
    const res = await fetch(url, { method: "POST", body: fd, headers: { "X-Requested-With": "XMLHttpRequest" } });
    if (!res.ok) throw new Error("Échec de l'upload");
    const ids = await res.json();
    return ids[0];
  }

  // --------------------------------------------------------- Colonnes mappées
  function titleCol() { return state.mappings && state.mappings.Title; }
  function coverCol() { return state.mappings && state.mappings.Cover; }
  function propCols() {
    const p = state.mappings && state.mappings.CardProperties;
    return Array.isArray(p) ? p.filter(Boolean) : (p ? [p] : []);
  }
  function recordValue(rec, colId) { return colId ? rec[colId] : undefined; }

  function coverImageUrl(rec) {
    const c = coverCol();
    if (!c) return "";
    const v = rec[c];
    if (baseType(c) === "Attachments") {
      const ids = decodeList(v);
      return ids.length ? attachmentUrl(ids[0]) : "";
    }
    const s = formatScalar(v);
    return /^https?:\/\//i.test(s) || s.startsWith("data:") ? s : "";
  }

  // --------------------------------------------------- Pipeline filtre/tri/group
  function passFilters(rec) {
    for (const f of state.config.filters) {
      if (!f.colId) continue;
      const raw = rec[f.colId];
      const t = baseType(f.colId);
      const valStr = String(plainValue(f.colId, raw)).toLowerCase();
      const fv = String(f.value || "").toLowerCase();
      switch (f.op) {
        case "empty": if (!isBlank(raw)) return false; break;
        case "notempty": if (isBlank(raw)) return false; break;
        case "contains": if (!valStr.includes(fv)) return false; break;
        case "notcontains": if (valStr.includes(fv)) return false; break;
        case "is": if (valStr !== fv) return false; break;
        case "gt": if (!(Number(plainValue(f.colId, raw)) > Number(f.value))) return false; break;
        case "lt": if (!(Number(plainValue(f.colId, raw)) < Number(f.value))) return false; break;
        case "checked": if (!raw) return false; break;
        case "unchecked": if (raw) return false; break;
        default: break;
      }
    }
    return true;
  }

  function passSearch(rec) {
    if (!state.search) return true;
    const q = state.search.toLowerCase();
    const cols = [titleCol(), ...propCols()].filter(Boolean);
    return cols.some((c) => String(plainValue(c, rec[c])).toLowerCase().includes(q));
  }

  function applySort(rows) {
    const sorts = state.config.sort.filter((s) => s.colId);
    if (!sorts.length) {
      if (state.config.manualOrder && rows.length && rows[0].manualSort != null) {
        return rows.slice().sort((a, b) => (a.manualSort || 0) - (b.manualSort || 0));
      }
      return rows;
    }
    return rows.slice().sort((a, b) => {
      for (const s of sorts) {
        const va = plainValue(s.colId, a[s.colId]);
        const vb = plainValue(s.colId, b[s.colId]);
        let cmp = 0;
        if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
        else cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
        if (cmp) return s.dir === "desc" ? -cmp : cmp;
      }
      return 0;
    });
  }

  function groupRows(rows) {
    const g = state.config.groupBy;
    if (!g) return [{ key: null, label: null, colId: null, rows }];
    const buckets = new Map();
    for (const rec of rows) {
      const raw = rec[g];
      let keys = baseType(g) === "ChoiceList" || baseType(g) === "RefList" ? decodeList(raw) : [raw];
      if (!keys.length) keys = [null];
      for (let k of keys) {
        const norm = isBlank(k) ? " empty" : String(k);
        if (!buckets.has(norm)) buckets.set(norm, { key: norm, rawKey: k, colId: g, rows: [] });
        buckets.get(norm).rows.push(rec);
      }
    }
    const arr = [...buckets.values()];
    arr.sort((a, b) => {
      if (a.key === " empty") return 1;
      if (b.key === " empty") return -1;
      return String(a.key).localeCompare(String(b.key), undefined, { numeric: true });
    });
    return arr.map((b) => ({
      key: b.key,
      colId: b.colId,
      rawKey: b.rawKey,
      label: b.key === " empty" ? "Sans " + colLabel(g) : null,
      rows: b.rows,
    }));
  }

  // ----------------------------------------------------------------- Rendu
  function render() {
    applyTheme();
    renderToolbar();
    const body = $("#nv-body");
    body.innerHTML = "";

    if (!state.records.length) {
      body.appendChild(emptyState("Aucune donnée", "Cette table ne contient aucun enregistrement. Cliquez sur « Nouveau » pour en ajouter un."));
      return;
    }

    let rows = state.records.filter((r) => passFilters(r) && passSearch(r));
    rows = applySort(rows);

    if (!rows.length) {
      body.appendChild(emptyState("Aucun résultat", "Aucune carte ne correspond à votre recherche / vos filtres."));
      return;
    }

    const groups = groupRows(rows);
    for (const grp of groups) body.appendChild(renderGroup(grp));
  }

  function renderGroup(grp) {
    const wrap = el("div", "nv-group");
    const isGrouped = grp.colId != null;
    const collapseKey = grp.key == null ? "__all__" : grp.key;
    if (state.collapsed[collapseKey]) wrap.classList.add("collapsed");

    if (isGrouped) {
      const head = el("div", "nv-group-header");
      const caret = el("span", "nv-caret"); caret.innerHTML = ICONS.caret;
      head.appendChild(caret);

      if (grp.label) {
        head.appendChild(el("span", "nv-group-title", grp.label));
      } else if (baseType(grp.colId) === "Choice" || baseType(grp.colId) === "ChoiceList") {
        const c = colorForChoice(grp.colId, grp.rawKey);
        const pill = el("span", "nv-group-pill", formatScalar(grp.rawKey));
        pill.style.background = c.bg; pill.style.color = c.fg;
        head.appendChild(pill);
      } else {
        head.appendChild(el("span", "nv-group-title", formatScalar(grp.rawKey)));
      }
      head.appendChild(el("span", "nv-group-count", String(grp.rows.length)));

      const add = el("button", "nv-btn nv-group-add");
      add.innerHTML = ICONS.plus + "<span>Nouveau</span>";
      add.addEventListener("click", (e) => { e.stopPropagation(); createRecord(grp.rawKey); });
      head.appendChild(add);

      head.addEventListener("click", () => {
        state.collapsed[collapseKey] = !state.collapsed[collapseKey];
        wrap.classList.toggle("collapsed");
      });
      wrap.appendChild(head);
    }

    const grid = el("div", "nv-grid size-" + state.config.cardSize);
    if (isGrouped) {
      // permet de déposer une carte dans ce groupe (changement de valeur)
      grid.addEventListener("dragover", (e) => { e.preventDefault(); });
      grid.addEventListener("drop", (e) => onDropInGroup(e, grp));
    }
    for (const rec of grp.rows) grid.appendChild(renderCard(rec, grp));
    // tuile "Nouveau" en fin de grille
    grid.appendChild(renderNewTile(grp.rawKey));
    wrap.appendChild(grid);
    return wrap;
  }

  function renderCard(rec, grp) {
    const card = el("div", "nv-card");
    card.dataset.id = rec.id;
    if (state.config.manualOrder) {
      card.draggable = true;
      card.addEventListener("dragstart", (e) => {
        card.classList.add("nv-dragging");
        e.dataTransfer.setData("text/plain", String(rec.id));
        e.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dragend", () => card.classList.remove("nv-dragging"));
      card.addEventListener("dragover", (e) => { e.preventDefault(); card.classList.add("nv-drag-over"); });
      card.addEventListener("dragleave", () => card.classList.remove("nv-drag-over"));
      card.addEventListener("drop", (e) => { card.classList.remove("nv-drag-over"); onDropOnCard(e, rec, grp); });
    }

    // Couverture
    if (coverCol()) {
      const cover = el("div", "nv-cover fit-" + state.config.imageFit);
      const url = coverImageUrl(rec);
      if (url) cover.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
      else { const ph = el("div", "nv-cover-placeholder"); ph.innerHTML = ICONS.image; cover.appendChild(ph); }
      card.appendChild(cover);
    }

    const cbody = el("div", "nv-card-body");

    // Titre
    if (titleCol()) {
      const tv = rec[titleCol()];
      const title = el("div", "nv-card-title");
      if (isBlank(tv)) { title.classList.add("empty"); title.textContent = "Sans titre"; }
      else title.textContent = formatScalar(tv);
      cbody.appendChild(title);
    }

    // Propriétés
    for (const colId of propCols()) {
      const val = rec[colId];
      if (state.config.hideEmpty && isBlank(val)) continue;
      const prop = el("div", "nv-prop");
      if (state.config.showPropNames) prop.appendChild(el("div", "nv-prop-name", colLabel(colId)));
      prop.appendChild(renderValue(colId, val));
      cbody.appendChild(prop);
    }

    card.appendChild(cbody);
    card.addEventListener("click", () => openRecord(rec.id));
    return card;
  }

  function renderNewTile(groupValue) {
    const tile = el("div", "nv-card nv-new-card");
    tile.innerHTML = ICONS.plus + "<span>Nouveau</span>";
    tile.addEventListener("click", () => createRecord(groupValue));
    return tile;
  }

  function emptyState(title, msg) {
    const s = el("div", "nv-state");
    const h = el("h3", null, title);
    const p = el("p", null, msg);
    s.appendChild(h); s.appendChild(p);
    return s;
  }

  // ---------------------------------------------------------- Glisser-déposer
  async function onDropOnCard(e, targetRec, grp) {
    e.preventDefault(); e.stopPropagation();
    const draggedId = Number(e.dataTransfer.getData("text/plain"));
    if (!draggedId || draggedId === targetRec.id) return;
    const dragged = state.records.find((r) => r.id === draggedId);
    if (!dragged) return;

    const fields = {};
    // changement de groupe si on dépose dans un autre groupe
    if (grp && grp.colId && baseType(grp.colId) === "Choice") {
      if (dragged[grp.colId] !== grp.rawKey) fields[grp.colId] = grp.rawKey || null;
    }
    // réordonnancement via manualSort (indexation fractionnaire)
    if (state.config.manualOrder && targetRec.manualSort != null) {
      const ordered = applySort(grp ? grp.rows : state.records);
      const ti = ordered.findIndex((r) => r.id === targetRec.id);
      const before = ordered[ti - 1];
      const newSort = before ? (before.manualSort + targetRec.manualSort) / 2 : targetRec.manualSort - 1;
      fields.manualSort = newSort;
    }
    if (Object.keys(fields).length) await updateRecord(draggedId, fields);
  }

  async function onDropInGroup(e, grp) {
    e.preventDefault();
    const draggedId = Number(e.dataTransfer.getData("text/plain"));
    if (!draggedId) return;
    const dragged = state.records.find((r) => r.id === draggedId);
    if (!dragged || !grp.colId) return;
    if (baseType(grp.colId) === "Choice" && dragged[grp.colId] !== grp.rawKey) {
      await updateRecord(draggedId, { [grp.colId]: grp.rawKey || null });
    }
  }

  // ------------------------------------------------------------- Persistance
  async function updateRecord(id, fields) {
    try {
      await grist.selectedTable.update({ id, fields });
    } catch (e) {
      // repli via applyUserActions
      await grist.docApi.applyUserActions([["UpdateRecord", state.tableId, id, fields]]);
    }
  }
  async function createRecord(groupValue) {
    const fields = {};
    const g = state.config.groupBy;
    if (g && groupValue != null && !isBlank(groupValue) && baseType(g) === "Choice") fields[g] = groupValue;
    let newId;
    try {
      const res = await grist.selectedTable.create({ fields });
      newId = res.id;
    } catch (e) {
      const res = await grist.docApi.applyUserActions([["AddRecord", state.tableId, null, fields]]);
      newId = res.retValues ? res.retValues[0] : null;
    }
    // ouvre la fiche pour édition une fois les données rafraîchies
    if (newId) setTimeout(() => openRecord(newId), 250);
  }
  async function deleteRecord(id) {
    try { await grist.selectedTable.destroy(id); }
    catch (e) { await grist.docApi.applyUserActions([["RemoveRecord", state.tableId, id]]); }
  }

  // --------------------------------------------------- Modal détail (peek)
  function openRecord(id) {
    const rec = state.records.find((r) => r.id === id);
    if (!rec) return;
    try { grist.setCursorPos({ rowId: id }); } catch (e) { /* lien curseur facultatif */ }

    const overlay = el("div", "nv-modal-overlay");
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    function close() { overlay.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);

    const modal = el("div", "nv-modal");

    // couverture
    if (coverCol()) {
      const url = coverImageUrl(rec);
      const cover = el("div", "nv-modal-cover");
      if (url) cover.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
      modal.appendChild(cover);
    }

    const head = el("div", "nv-modal-head");
    head.appendChild(el("span", "nv-spacer"));
    const delBtn = el("button", "nv-icon-btn"); delBtn.innerHTML = ICONS.trash; delBtn.title = "Supprimer";
    delBtn.addEventListener("click", async () => { if (confirm("Supprimer cet enregistrement ?")) { await deleteRecord(id); close(); } });
    const closeBtn = el("button", "nv-icon-btn"); closeBtn.innerHTML = ICONS.close;
    closeBtn.addEventListener("click", close);
    head.appendChild(delBtn); head.appendChild(closeBtn);
    modal.appendChild(head);

    const body = el("div", "nv-modal-body");

    // Titre éditable
    if (titleCol()) {
      const t = el("textarea", "nv-modal-title");
      t.rows = 1; t.placeholder = "Sans titre";
      t.value = isBlank(rec[titleCol()]) ? "" : formatScalar(rec[titleCol()]);
      autosize(t);
      t.addEventListener("input", () => autosize(t));
      t.addEventListener("blur", () => commitField(id, titleCol(), t.value));
      body.appendChild(t);
    }

    // Toutes les propriétés mappées, éditables
    const fieldCols = propCols().filter((c) => c !== titleCol());
    for (const colId of fieldCols) {
      body.appendChild(renderEditableField(rec, id, colId));
    }

    modal.appendChild(body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  function autosize(ta) { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }

  function renderEditableField(rec, id, colId) {
    const field = el("div", "nv-field");
    const label = el("div", "nv-field-label", colLabel(colId));
    const control = el("div", "nv-field-control");
    const t = baseType(colId);
    const val = rec[colId];

    if (t === "Bool") {
      const wrap = el("label", "nv-switch");
      const cb = el("input"); cb.type = "checkbox"; cb.checked = !!val;
      cb.addEventListener("change", () => commitField(id, colId, cb.checked));
      const slider = el("span");
      wrap.appendChild(cb); wrap.appendChild(slider);
      control.appendChild(wrap);
    } else if (t === "Choice") {
      control.appendChild(choiceEditor(id, colId, val, false));
    } else if (t === "ChoiceList") {
      control.appendChild(choiceEditor(id, colId, val, true));
    } else if (t === "Date" || t === "DateTime") {
      const inp = el("input"); inp.type = t === "DateTime" ? "datetime-local" : "date";
      if (typeof val === "number") {
        const d = new Date(val * 1000);
        inp.value = t === "DateTime" ? d.toISOString().slice(0, 16) : d.toISOString().slice(0, 10);
      }
      inp.addEventListener("change", () => {
        const ms = inp.value ? new Date(inp.value).getTime() : null;
        commitField(id, colId, ms == null ? null : Math.round(ms / 1000));
      });
      control.appendChild(inp);
    } else if (t === "Numeric" || t === "Int") {
      const inp = el("input"); inp.type = "number"; inp.value = val == null ? "" : val;
      inp.addEventListener("blur", () => commitField(id, colId, inp.value === "" ? null : Number(inp.value)));
      control.appendChild(inp);
    } else if (t === "Attachments") {
      control.appendChild(attachmentEditor(rec, id, colId));
    } else if (t === "Ref" || t === "RefList") {
      // lecture seule (édition de référence non triviale hors widget)
      control.appendChild(renderValue(colId, val));
    } else {
      const isLong = String(formatScalar(val)).length > 60;
      const inp = el(isLong ? "textarea" : "input");
      if (!isLong) inp.type = "text";
      inp.value = isBlank(val) ? "" : formatScalar(val);
      if (isLong) { autosize(inp); inp.addEventListener("input", () => autosize(inp)); }
      inp.addEventListener("blur", () => commitField(id, colId, inp.value));
      control.appendChild(inp);
    }

    field.appendChild(label); field.appendChild(control);
    return field;
  }

  function choiceEditor(id, colId, val, multi) {
    const wrap = el("div", "nv-chips");
    const choices = (state.meta[colId] && state.meta[colId].widgetOptions.choices) || [];
    const current = multi ? decodeList(val) : (isBlank(val) ? [] : [val]);

    function redraw() {
      wrap.innerHTML = "";
      current.forEach((ch) => {
        const c = colorForChoice(colId, ch);
        const chip = el("span", "nv-chip", null);
        chip.style.background = c.bg; chip.style.color = c.fg;
        chip.appendChild(document.createTextNode(formatScalar(ch)));
        const rm = el("button", null, "×");
        rm.addEventListener("click", () => {
          const i = current.indexOf(ch); if (i >= 0) current.splice(i, 1);
          save(); redraw();
        });
        chip.appendChild(rm);
        wrap.appendChild(chip);
      });
      const add = el("button", "nv-chip-add", "+");
      add.addEventListener("click", () => openChoicePicker(add, choices, current, multi, () => { save(); redraw(); }));
      wrap.appendChild(add);
    }
    function save() {
      const out = multi ? ["L", ...current] : (current[0] != null ? current[0] : null);
      commitField(id, colId, out);
    }
    redraw();
    return wrap;
  }

  function openChoicePicker(anchor, choices, current, multi, onChange) {
    closePopovers();
    const pop = el("div", "nv-popover");
    pop.dataset.popover = "1";
    choices.forEach((ch) => {
      const row = el("div", "nv-row");
      const c = colorForChoice(null, ch);
      const pill = el("span", "nv-pill", ch); pill.style.background = c.bg; pill.style.color = c.fg;
      row.appendChild(pill);
      row.style.cursor = "pointer";
      if (current.includes(ch)) { const chk = el("span", null, "✓"); chk.style.marginLeft = "auto"; row.appendChild(chk); }
      row.addEventListener("click", () => {
        if (multi) { if (!current.includes(ch)) current.push(ch); }
        else { current.length = 0; current.push(ch); }
        onChange();
        if (!multi) closePopovers(); else openChoicePicker(anchor, choices, current, multi, onChange);
      });
      pop.appendChild(row);
    });
    if (!choices.length) pop.appendChild(el("div", "nv-row", "Aucun choix défini"));
    positionPopover(pop, anchor);
    document.body.appendChild(pop);
  }

  function attachmentEditor(rec, id, colId) {
    const wrap = el("div");
    const thumbs = el("div", "nv-thumbs"); thumbs.style.marginBottom = "6px";
    const ids = decodeList(rec[colId]);
    ids.forEach((aid) => { const img = el("img", "nv-thumb"); img.src = attachmentUrl(aid); thumbs.appendChild(img); });
    wrap.appendChild(thumbs);

    const dz = el("div", "nv-dropzone", "Glissez un fichier ici ou cliquez pour téléverser");
    const fileInput = el("input"); fileInput.type = "file"; fileInput.style.display = "none";
    dz.addEventListener("click", () => fileInput.click());
    ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("hover"); }));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("hover"); }));
    async function handle(file) {
      dz.textContent = "Téléversement…";
      try {
        const aid = await uploadAttachment(file);
        const next = ["L", ...ids, aid];
        await commitField(id, colId, next);
        toast("Pièce jointe ajoutée");
      } catch (err) { toast("Échec du téléversement"); dz.textContent = "Glissez un fichier ici ou cliquez pour téléverser"; }
    }
    dz.addEventListener("drop", (e) => { if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); });
    fileInput.addEventListener("change", () => { if (fileInput.files[0]) handle(fileInput.files[0]); });
    wrap.appendChild(dz); wrap.appendChild(fileInput);
    return wrap;
  }

  async function commitField(id, colId, value) {
    // colId peut être un alias mappé ; on l'utilise tel quel (c'est l'ID réel)
    await updateRecord(id, { [colId]: value });
  }

  // --------------------------------------------------------------- Toolbar
  function renderToolbar() {
    const tb = $("#nv-toolbar");
    if (tb.dataset.built) { syncToolbarState(); return; }
    tb.dataset.built = "1";

    const search = el("div", "nv-search");
    search.innerHTML = ICONS.search;
    const inp = el("input"); inp.type = "text"; inp.placeholder = "Rechercher…";
    inp.addEventListener("input", () => { state.search = inp.value; render(); inp.focus(); });
    search.appendChild(inp);
    tb.appendChild(search);

    tb.appendChild(makeToolBtn("sort", "Trier", ICONS.sort, openSortPopover));
    tb.appendChild(makeToolBtn("filter", "Filtrer", ICONS.filter, openFilterPopover));
    tb.appendChild(makeToolBtn("group", "Grouper", ICONS.group, openGroupPopover));

    tb.appendChild(el("span", "nv-spacer"));

    tb.appendChild(makeToolBtn("settings", "", ICONS.gear, openSettingsPopover));
    const add = el("button", "nv-btn nv-btn-primary");
    add.innerHTML = ICONS.plus + "<span>Nouveau</span>";
    add.addEventListener("click", () => createRecord(null));
    tb.appendChild(add);

    syncToolbarState();
  }
  function makeToolBtn(key, label, icon, onClick) {
    const b = el("button", "nv-btn");
    b.dataset.key = key;
    b.innerHTML = icon + (label ? `<span>${label}</span>` : "");
    b.addEventListener("click", (e) => { e.stopPropagation(); onClick(b); });
    return b;
  }
  function syncToolbarState() {
    const tb = $("#nv-toolbar");
    const setActive = (key, on) => { const b = tb.querySelector(`[data-key="${key}"]`); if (b) b.classList.toggle("nv-active", on); };
    setActive("sort", state.config.sort.some((s) => s.colId));
    setActive("filter", state.config.filters.some((f) => f.colId));
    setActive("group", !!state.config.groupBy);
  }

  // -------------------------------------------------------------- Popovers
  function closePopovers() { document.querySelectorAll('[data-popover]').forEach((p) => p.remove()); }
  function positionPopover(pop, anchor) {
    const r = anchor.getBoundingClientRect();
    pop.style.visibility = "hidden";
    document.body.appendChild(pop);
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    pop.remove(); pop.style.visibility = "";
    let left = r.left, top = r.bottom + 6;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
    pop.style.left = Math.max(8, left) + "px";
    pop.style.top = top + "px";
  }
  // ferme les popovers au clic extérieur
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-popover]") && !e.target.closest(".nv-btn")) closePopovers();
  });

  function editableColIds() {
    // colonnes pertinentes pour tri/filtre/group : titre + propriétés mappées
    const set = new Set([titleCol(), ...propCols()].filter(Boolean));
    return [...set];
  }

  function openSortPopover(anchor) {
    closePopovers();
    const pop = el("div", "nv-popover"); pop.dataset.popover = "1";
    pop.appendChild(headTitle("Trier par"));
    const cols = editableColIds();
    state.config.sort.forEach((s, idx) => {
      const row = el("div", "nv-filter-row");
      row.appendChild(colSelect(s.colId, cols, (v) => { s.colId = v; persist(); render(); }));
      const dir = el("select");
      [["asc", "Croissant"], ["desc", "Décroissant"]].forEach(([v, t]) => { const o = el("option", null, t); o.value = v; if (s.dir === v) o.selected = true; dir.appendChild(o); });
      dir.addEventListener("change", () => { s.dir = dir.value; persist(); render(); });
      row.appendChild(dir);
      const rm = el("button", "nv-icon-btn"); rm.innerHTML = ICONS.close;
      rm.addEventListener("click", () => { state.config.sort.splice(idx, 1); persist(); render(); openSortPopover(anchor); });
      row.appendChild(rm);
      pop.appendChild(row);
    });
    const add = el("div", "nv-add-link", "+ Ajouter un tri");
    add.addEventListener("click", () => { state.config.sort.push({ colId: cols[0] || "", dir: "asc" }); persist(); render(); openSortPopover(anchor); });
    pop.appendChild(add);
    positionPopover(pop, anchor); document.body.appendChild(pop);
  }

  function openFilterPopover(anchor) {
    closePopovers();
    const pop = el("div", "nv-popover"); pop.dataset.popover = "1";
    pop.appendChild(headTitle("Filtres"));
    const cols = editableColIds();
    const ops = [
      ["contains", "contient"], ["notcontains", "ne contient pas"], ["is", "est"],
      ["gt", ">"], ["lt", "<"], ["empty", "est vide"], ["notempty", "non vide"],
      ["checked", "coché"], ["unchecked", "décoché"],
    ];
    state.config.filters.forEach((f, idx) => {
      const row = el("div", "nv-filter-row");
      row.appendChild(colSelect(f.colId, cols, (v) => { f.colId = v; persist(); render(); }));
      const op = el("select");
      ops.forEach(([v, t]) => { const o = el("option", null, t); o.value = v; if (f.op === v) o.selected = true; op.appendChild(o); });
      op.addEventListener("change", () => { f.op = op.value; persist(); render(); });
      row.appendChild(op);
      if (!["empty", "notempty", "checked", "unchecked"].includes(f.op)) {
        const inp = el("input"); inp.type = "text"; inp.value = f.value || ""; inp.placeholder = "valeur";
        inp.addEventListener("input", () => { f.value = inp.value; persist(); render(); });
        row.appendChild(inp);
      }
      const rm = el("button", "nv-icon-btn"); rm.innerHTML = ICONS.close;
      rm.addEventListener("click", () => { state.config.filters.splice(idx, 1); persist(); render(); openFilterPopover(anchor); });
      row.appendChild(rm);
      pop.appendChild(row);
    });
    const add = el("div", "nv-add-link", "+ Ajouter un filtre");
    add.addEventListener("click", () => { state.config.filters.push({ colId: cols[0] || "", op: "contains", value: "" }); persist(); render(); openFilterPopover(anchor); });
    pop.appendChild(add);
    positionPopover(pop, anchor); document.body.appendChild(pop);
  }

  function openGroupPopover(anchor) {
    closePopovers();
    const pop = el("div", "nv-popover"); pop.dataset.popover = "1";
    pop.appendChild(headTitle("Grouper par"));
    const none = el("div", "nv-row"); none.style.cursor = "pointer";
    none.appendChild(el("label", null, "Aucun"));
    if (!state.config.groupBy) none.appendChild(el("span", null, "✓"));
    none.addEventListener("click", () => { state.config.groupBy = ""; persist(); render(); openGroupPopover(anchor); });
    pop.appendChild(none);
    editableColIds().forEach((colId) => {
      const row = el("div", "nv-row"); row.style.cursor = "pointer";
      row.appendChild(el("label", null, colLabel(colId)));
      if (state.config.groupBy === colId) row.appendChild(el("span", null, "✓"));
      row.addEventListener("click", () => { state.config.groupBy = colId; ensureRefLabels(colId); persist(); render(); openGroupPopover(anchor); });
      pop.appendChild(row);
    });
    positionPopover(pop, anchor); document.body.appendChild(pop);
  }

  function openSettingsPopover(anchor) {
    closePopovers();
    const pop = el("div", "nv-popover"); pop.dataset.popover = "1";
    pop.appendChild(headTitle("Affichage de la galerie"));

    pop.appendChild(segRow("Taille des cartes", [["small", "Petite"], ["medium", "Moyenne"], ["large", "Grande"]],
      state.config.cardSize, (v) => { state.config.cardSize = v; persist(); render(); }));
    pop.appendChild(segRow("Ajustement image", [["cover", "Remplir"], ["contain", "Ajuster"]],
      state.config.imageFit, (v) => { state.config.imageFit = v; persist(); render(); }));
    pop.appendChild(divider());
    pop.appendChild(toggleRow("Afficher le nom des propriétés", state.config.showPropNames, (v) => { state.config.showPropNames = v; persist(); render(); }));
    pop.appendChild(toggleRow("Masquer les propriétés vides", state.config.hideEmpty, (v) => { state.config.hideEmpty = v; persist(); render(); }));
    pop.appendChild(toggleRow("Réordonnancement (glisser-déposer)", state.config.manualOrder, (v) => { state.config.manualOrder = v; persist(); render(); }));
    pop.appendChild(divider());
    pop.appendChild(segRow("Thème", [["auto", "Auto"], ["light", "Clair"], ["dark", "Sombre"]],
      state.config.theme, (v) => { state.config.theme = v; persist(); render(); }));

    positionPopover(pop, anchor); document.body.appendChild(pop);
  }

  // Petits constructeurs d'UI pour les popovers
  function headTitle(t) { const h = el("h4", null, t); return h; }
  function divider() { return el("div", "nv-divider"); }
  function colSelect(current, cols, onChange) {
    const sel = el("select");
    cols.forEach((c) => { const o = el("option", null, colLabel(c)); o.value = c; if (c === current) o.selected = true; sel.appendChild(o); });
    sel.addEventListener("change", () => onChange(sel.value));
    return sel;
  }
  function segRow(label, opts, current, onChange) {
    const row = el("div", "nv-row");
    row.appendChild(el("label", null, label));
    const seg = el("div", "nv-seg");
    opts.forEach(([v, t]) => {
      const b = el("button", current === v ? "active" : null, t);
      b.addEventListener("click", () => { onChange(v); });
      seg.appendChild(b);
    });
    row.appendChild(seg);
    return row;
  }
  function toggleRow(label, checked, onChange) {
    const row = el("div", "nv-row");
    row.appendChild(el("label", null, label));
    const sw = el("label", "nv-switch");
    const cb = el("input"); cb.type = "checkbox"; cb.checked = checked;
    cb.addEventListener("change", () => onChange(cb.checked));
    sw.appendChild(cb); sw.appendChild(el("span"));
    row.appendChild(sw);
    return row;
  }

  // ----------------------------------------------------------------- Thème
  function applyTheme() {
    let theme = state.config.theme;
    if (theme === "auto") {
      theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", theme);
  }

  // ------------------------------------------------------------- Config I/O
  let persistTimer = null;
  function persist() {
    syncToolbarState();
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try { grist.setOption("config", state.config); } catch (e) { /* noop */ }
    }, 300);
  }

  function toast(msg) {
    let t = $("#nv-toast");
    if (!t) { t = el("div", "nv-toast"); t.id = "nv-toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2000);
  }

  // ---------------------------------------------------------------- Données
  async function onData(records, mappings) {
    state.records = records || [];
    if (mappings) state.mappings = mappings;
    // pré-charge les libellés de référence pour les colonnes affichées
    const refCols = [titleCol(), ...propCols(), state.config.groupBy].filter((c) => c && /^Ref(List)?:/.test(colType(c)));
    await Promise.all(refCols.map(ensureRefLabels));
    render();
  }

  // ----------------------------------------------------------------- Boot
  async function init() {
    grist.ready({
      requiredAccess: "full",
      allowSelectBy: true,
      columns: [
        { name: "Title", title: "Titre", type: "Text,Numeric,Int,Choice,Date,DateTime", optional: true,
          description: "Champ affiché en titre de la carte (comme le nom de page Notion)." },
        { name: "Cover", title: "Image de couverture", type: "Attachments,Text", optional: true,
          description: "Pièce jointe ou URL d'image utilisée en couverture de carte." },
        { name: "CardProperties", title: "Propriétés affichées", type: "Any", optional: true, allowMultiple: true,
          description: "Colonnes affichées sur les cartes (ordre = ordre d'affichage)." },
      ],
      onEditOptions: () => openSettingsPopover($('#nv-toolbar [data-key="settings"]') || document.body),
    });

    grist.onOptions((options) => {
      if (options && options.config) {
        state.config = Object.assign(defaultConfig(), options.config);
        applyTheme();
        render();
      }
    });

    // Récupère l'id de la table puis les métadonnées
    grist.onRecords(async (records, mappings) => {
      if (!state.tableId) {
        try { state.tableId = await grist.selectedTable.getTableId(); } catch (e) { /* noop */ }
        await refreshToken();
        await loadMeta();
      }
      await onData(records, mappings);
    });

    // réagit au thème système en mode auto
    if (window.matchMedia) {
      try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (state.config.theme === "auto") render(); }); } catch (e) {}
    }
  }

  if (typeof grist === "undefined") {
    document.getElementById("nv-body").innerHTML =
      '<div class="nv-state"><h3>API Grist introuvable</h3><p>Ce widget doit être ouvert depuis Grist (grist-plugin-api.js non chargé).</p></div>';
  } else {
    init();
  }
})();
