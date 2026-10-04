(() => {
  'use strict';

  const STORAGE_KEY = 'generateur-etiquettes-deplacables.autosave.v1';
  // Préférences d'affichage communes à tous les outils Apps1D76.
  const PREFS_KEY = 'apps1d-prefs';
  const DEFAULT_PREFS = { theme: 'auto', text: '100', motion: 'auto', contrast: false };
  const PALETTE = [
    '#ffffff', '#f8fafc', '#e5e7eb', '#111827', '#ef4444', '#f97316',
    '#facc15', '#22c55e', '#38bdf8', '#2563eb', '#8b5cf6', '#ec4899'
  ];
  const COLUMN_PALETTE = ['#dbeafe', '#dcfce7', '#fef3c7', '#fee2e2', '#ede9fe', '#fce7f3', '#e0f2fe', '#f1f5f9'];

  // Polices installées d'abord, puis les polices « Etiq … » du dossier assets/fonts (voir style.css).
  const FONT_FAMILIES = {
    'Arial': ['Arial'],
    'Century Gothic': ['Century Gothic', 'CenturyGothic'],
    'Marelle 2': ['Marelle 2', 'Marelle2', 'Marelle', 'Etiq Marelle 2'],
    'Marelle Baton 2': ['Marelle Bâton 2', 'Marelle Baton 2', 'MarelleBaton2', 'Etiq Marelle Baton 2'],
    'OpenDyslexic': ['OpenDyslexic', 'OpenDyslexic3', 'Open Dyslexic', 'Etiq OpenDyslexic'],
    'Comic Sans MS': ['Comic Sans MS', 'Comic Sans']
  };
  const FONT_STACKS = Object.fromEntries(Object.entries(FONT_FAMILIES).map(([name, families]) => [
    name,
    `${families.map((family) => `"${family}"`).join(', ')}, Arial, sans-serif`
  ]));

  const state = {
    labels: [],
    columns: [],
    settings: {
      menuPosition: 'top',
      menuVisible: true
    },
    styles: {
      textColor: '#111827',
      bgColor: '#ffffff',
      borderColor: '#111827',
      columnColor: '#dbeafe'
    },
    currentFileName: 'activite-etiquettes.etiq',
    nextId: 1
  };

  let prefs = loadPrefs();

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const els = {
    body: document.body,
    root: document.documentElement,
    themeToggle: $('#themeToggle'),
    menuPanel: $('#menuPanel'),
    workspace: $('#workspace'),
    columnsLayer: $('#columnsLayer'),
    labelsLayer: $('#labelsLayer'),
    trashZone: $('#trashZone'),
    menuToggle: $('#menuToggle'),
    menuToggleText: $('#menuToggle .menu-tab-text'),
    fullscreenBtn: $('#fullscreenBtn'),
    settingsBtn: $('#settingsBtn'),
    settingsDialog: $('#settingsDialog'),
    settingsForm: $('#settingsDialog form'),
    saveAsDialog: $('#saveAsDialog'),
    saveAsName: $('#saveAsName'),
    textInput: $('#textInput'),
    splitPreview: $('#splitPreview'),
    fontSelect: $('#fontSelect'),
    customFontInput: $('#customFontInput'),
    fontStatus: $('#fontStatus'),
    fontSizeInput: $('#fontSizeInput'),
    fontSizeValue: $('#fontSizeValue'),
    boldInput: $('#boldInput'),
    underlineInput: $('#underlineInput'),
    roundedInput: $('#roundedInput'),
    txtFileInput: $('#txtFileInput'),
    imageFileInput: $('#imageFileInput'),
    imageSizeSelect: $('#imageSizeSelect'),
    imageBorderInput: $('#imageBorderInput'),
    imageRoundedInput: $('#imageRoundedInput'),
    openFileInput: $('#openFileInput'),
    customColumnTitle: $('#customColumnTitle'),
    columnList: $('#columnList')
  };

  function init() {
    buildPalettes();
    bindEvents();
    setupInlineTooltips();
    setupReliableTaps();
    loadAutosave();
    applyPrefs();
    applySettings();
    renderAll();
    updateFontSizeLabel();
    updateFontStatus();
    updateSplitPreview();
  }

  function bindEvents() {
    $$('.tab-button').forEach((btn) => btn.addEventListener('click', () => openTab(btn.dataset.tab)));

    $('#createTextLabelsBtn').addEventListener('click', () => createTextLabels(false));
    $('#createRandomTextLabelsBtn').addEventListener('click', () => createTextLabels(true));
    $('#loadTxtBtn').addEventListener('click', () => els.txtFileInput.click());
    els.txtFileInput.addEventListener('change', handleTxtFile);
    els.fontSizeInput.addEventListener('input', updateFontSizeLabel);
    els.textInput.addEventListener('input', updateSplitPreview);
    $$('input[name="splitMode"]').forEach((input) => input.addEventListener('change', updateSplitPreview));
    els.fontSelect.addEventListener('change', updateFontStatus);
    els.customFontInput.addEventListener('input', debounce(updateFontStatus, 300));

    $('#addImagesBtn').addEventListener('click', () => els.imageFileInput.click());
    els.imageFileInput.addEventListener('change', handleImageFiles);

    $$('.preset-columns').forEach((btn) => btn.addEventListener('click', () => applyColumnPreset(btn.dataset.preset)));
    $('#addColumnBtn').addEventListener('click', addCustomColumn);
    $('#clearColumnsBtn').addEventListener('click', () => {
      if (!window.confirm('Supprimer toutes les colonnes ?')) return;
      state.columns = [];
      renderColumns();
      saveAutosave();
    });

    $('#newBtn').addEventListener('click', newActivity);
    $('#openBtn').addEventListener('click', () => els.openFileInput.click());
    els.openFileInput.addEventListener('change', handleOpenActivity);
    $('#saveBtn').addEventListener('click', () => saveActivity(state.currentFileName || 'activite-etiquettes.etiq'));
    $('#saveAsBtn').addEventListener('click', () => {
      els.saveAsName.value = state.currentFileName.replace(/\.etiq$/, '');
      showDialog(els.saveAsDialog);
      els.saveAsName.select();
    });
    els.saveAsDialog.addEventListener('close', () => {
      if (els.saveAsDialog.returnValue !== 'save') return;
      saveActivity(els.saveAsName.value.trim().replace(/[\\/:*?"<>|]/g, '-') || 'activite-etiquettes');
    });
    $('#clearLabelsBtn').addEventListener('click', () => {
      if (!window.confirm('Supprimer toutes les étiquettes ?')) return;
      state.labels = [];
      renderLabels();
      saveAutosave();
    });
    els.fullscreenBtn.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', updateFullscreenButton);
    if (!document.fullscreenEnabled) els.fullscreenBtn.hidden = true;

    els.menuToggle.addEventListener('click', () => setMenuVisible(!state.settings.menuVisible));
    // Au TNI, un appui long ouvrirait le menu contextuel du navigateur au lieu de déplacer l'étiquette.
    els.workspace.addEventListener('contextmenu', (event) => event.preventDefault());
    els.settingsBtn.addEventListener('click', () => {
      syncSettingsForm();
      showDialog(els.settingsDialog);
    });
    $('#resetUiBtn').addEventListener('click', resetUiSettings);
    els.themeToggle.addEventListener('click', () => {
      setPrefs({ theme: els.root.dataset.theme === 'dark' ? 'light' : 'dark' });
    });

    els.settingsForm.addEventListener('change', (event) => {
      const { name, value, checked } = event.target;
      if (name === 'menuPosition') {
        state.settings.menuPosition = value;
        applySettings();
        saveAutosave();
      } else if (name === 'contrast') {
        setPrefs({ contrast: checked });
      } else if (name in DEFAULT_PREFS) {
        setPrefs({ [name]: value });
      }
    });

    ['(prefers-color-scheme: dark)', '(prefers-reduced-motion: reduce)'].forEach((query) => {
      window.matchMedia?.(query).addEventListener?.('change', applyPrefs);
    });

    window.addEventListener('resize', debounce(() => {
      clampAllLabels();
      renderLabels();
      saveAutosave();
    }, 150));

    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        createTextLabels(false);
      }
    });
  }


  function setupInlineTooltips() {
    const tooltip = document.createElement('div');
    tooltip.className = 'global-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltip);

    function show(target) {
      const text = target.dataset.tooltip || target.getAttribute('title') || '';
      if (!text) return;
      tooltip.textContent = text;
      tooltip.classList.add('visible');
      const rect = target.getBoundingClientRect();
      const tipRect = tooltip.getBoundingClientRect();
      let left = rect.left + rect.width / 2 - tipRect.width / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - tipRect.width - 12));
      let top = rect.bottom + 10;
      if (top + tipRect.height > window.innerHeight - 12) {
        top = Math.max(12, rect.top - tipRect.height - 10);
      }
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }

    function hide() {
      tooltip.classList.remove('visible');
    }

    document.querySelectorAll('.inline-help').forEach((button) => {
      button.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') show(button); });
      button.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse') hide(); });
      // Au doigt ou au stylet, la bulle s'ouvre et se ferme d'un appui.
      button.addEventListener('click', () => (tooltip.classList.contains('visible') ? hide() : show(button)));
      button.addEventListener('blur', hide);
    });
    document.addEventListener('pointerdown', (event) => {
      if (!event.target.closest('.inline-help')) hide();
    });
  }

  // Au doigt ou au stylet (TNI / VPI), Chromium perd parfois le « clic » de l'appui qui suit le
  // glissement d'une étiquette : le bouton semble ne pas répondre. Si un appui net sur un bouton
  // n'est pas suivi d'un clic, on le déclenche nous-mêmes (jamais deux fois).
  function setupReliableTaps() {
    const TAPPABLE = 'button, summary, a[href], .seg label, .switch, .toggle-row label';
    let tap = null;

    document.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' || !event.isPrimary) return;
      const target = event.target.closest(TAPPABLE);
      tap = target && !target.closest('.label-item') ? { target, x: event.clientX, y: event.clientY } : null;
    }, true);

    document.addEventListener('pointerup', (event) => {
      if (!tap || event.pointerType === 'mouse') return;
      const { target, x, y } = tap;
      tap = null;
      if (event.target.closest(TAPPABLE) !== target || Math.hypot(event.clientX - x, event.clientY - y) > 12) return;
      let clicked = false;
      const onClick = () => { clicked = true; };
      document.addEventListener('click', onClick, { capture: true, once: true });
      setTimeout(() => {
        document.removeEventListener('click', onClick, true);
        if (!clicked && target.isConnected) target.click();
      }, 350);
    }, true);
  }

  function openTab(name) {
    $$('.tab-button').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === name));
    $$('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${name}`));
  }

  function showDialog(dialog) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', 'open');
  }

  function buildPalettes() {
    createPalette('textColorPalette', 'textColor', PALETTE);
    createPalette('bgColorPalette', 'bgColor', PALETTE);
    createPalette('borderColorPalette', 'borderColor', PALETTE);
    createPalette('columnColorPalette', 'columnColor', COLUMN_PALETTE);
  }

  function createPalette(containerId, key, colors) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    colors.forEach((color) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.style.backgroundColor = color;
      btn.title = color;
      btn.dataset.color = color;
      btn.addEventListener('click', () => {
        state.styles[key] = color;
        updatePaletteSelections();
        saveAutosave();
      });
      container.appendChild(btn);
    });
  }

  function updatePaletteSelections() {
    ['textColor', 'bgColor', 'borderColor', 'columnColor'].forEach((key) => {
      const palette = document.querySelector(`[data-target="${key}"] .palette`);
      if (!palette) return;
      palette.querySelectorAll('.swatch').forEach((swatch) => {
        swatch.classList.toggle('selected', swatch.dataset.color === state.styles[key]);
      });
    });
  }

  function updateFontSizeLabel() {
    els.fontSizeValue.textContent = `${els.fontSizeInput.value} px`;
  }

  function getChosenFont() {
    return els.customFontInput.value.trim() || els.fontSelect.value || 'Arial';
  }

  // Vérifie qu'au moins une des familles de la police choisie est réellement utilisable.
  async function isFontAvailable(font) {
    const families = FONT_FAMILIES[font] || [font.replace(/["']/g, '').trim()];
    const ctx = document.createElement('canvas').getContext('2d');
    const sample = 'mmmwwwiiilll Le chat dort 0123';
    const width = (family) => {
      ctx.font = `40px ${family}`;
      return ctx.measureText(sample).width;
    };
    for (const family of families) {
      await document.fonts.load(`40px "${family}"`).catch(() => {});
      if (['monospace', 'serif'].some((generic) => width(`"${family}", ${generic}`) !== width(generic))) return true;
    }
    return false;
  }

  let fontStatusRequest = 0;

  async function updateFontStatus() {
    const font = getChosenFont();
    const request = ++fontStatusRequest;
    const available = await isFontAvailable(font);
    if (request !== fontStatusRequest) return;
    els.fontStatus.className = `font-status ${available ? 'ok' : 'missing'}`;
    els.fontStatus.textContent = available
      ? `✓ Police « ${font} » disponible`
      : `Police « ${font} » introuvable : Arial sera utilisée. Voir l'onglet Aide pour l'installer.`;
  }

  function createTextLabels(shuffle = false) {
    const raw = els.textInput.value;
    const parts = splitText(raw, getSplitMode());
    if (!parts.length) return;

    const labelsToCreate = shuffle ? shuffleArray(parts) : parts;

    const options = {
      fontFamily: getChosenFont(),
      fontSize: Number(els.fontSizeInput.value),
      fontWeight: els.boldInput.checked ? 'bold' : 'normal',
      textDecoration: els.underlineInput.checked ? 'underline' : 'none',
      textColor: state.styles.textColor,
      bgColor: state.styles.bgColor,
      borderColor: state.styles.borderColor,
      borderWidth: 3,
      borderRadius: els.roundedInput.checked ? 16 : 0
    };

    labelsToCreate.forEach((text, index) => {
      const pos = nextPlacement(index);
      state.labels.push({
        id: makeId(),
        type: 'text',
        text,
        x: pos.x,
        y: pos.y,
        ...options
      });
    });

    els.textInput.value = '';
    updateSplitPreview();
    renderLabels();
    saveAutosave();
  }

  function shuffleArray(items) {
    const output = [...items];
    for (let i = output.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
  }

  function getSplitMode() {
    return $('input[name="splitMode"]:checked')?.value || 'list';
  }

  // Annonce combien d'étiquettes seront créées, pour repérer un mauvais découpage avant de générer.
  function updateSplitPreview() {
    const parts = splitText(els.textInput.value, getSplitMode());
    if (!parts.length) {
      els.splitPreview.textContent = '';
      return;
    }
    const shown = parts.slice(0, 4).map((part) => `« ${part} »`).join(', ');
    const more = parts.length > 4 ? '…' : '';
    els.splitPreview.textContent = `${parts.length} étiquette${parts.length > 1 ? 's' : ''} : ${shown}${more}`;
  }

  function splitText(raw, mode) {
    if (!raw || !raw.trim()) return [];
    if (mode === 'word') return raw.trim().split(/\s+/).filter(Boolean);
    if (mode === 'letter') return Array.from(raw.replace(/\s/g, '')).filter(Boolean);
    // Une virgule entre deux chiffres (1,5) est décimale : elle ne coupe pas l'étiquette.
    const separators = mode === 'line' ? /\r?\n/ : /[\r\n;]|(?<!\d),|,(?!\d)/;
    return raw.split(separators).map((part) => part.trim()).filter(Boolean);
  }

  function nextPlacement(index = 0) {
    const rect = els.workspace.getBoundingClientRect();
    const usableW = Math.max(240, rect.width - 180);
    const count = state.labels.length + index;
    const x = 150 + ((count * 165) % usableW);
    const y = 90 + (Math.floor((count * 165) / usableW) * 86) % Math.max(120, rect.height - 180);
    return { x, y };
  }

  function makeId() {
    return `label-${Date.now()}-${state.nextId++}`;
  }

  async function handleTxtFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    els.textInput.value = text;
    updateSplitPreview();
    event.target.value = '';
  }

  async function handleImageFiles(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const size = Number(els.imageSizeSelect.value || 180);
    const hasBorder = els.imageBorderInput.checked;
    const radius = els.imageRoundedInput.checked ? 18 : 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await readFileAsDataUrl(file);
      const pos = nextPlacement(i);
      state.labels.push({
        id: makeId(),
        type: 'image',
        name: file.name,
        src: dataUrl,
        x: pos.x,
        y: pos.y,
        width: size,
        height: size,
        borderColor: state.styles.borderColor,
        borderWidth: hasBorder ? 3 : 0,
        borderRadius: radius,
        bgColor: '#ffffff'
      });
    }

    event.target.value = '';
    renderLabels();
    saveAutosave();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderAll() {
    updatePaletteSelections();
    renderColumns();
    renderLabels();
  }

  function renderLabels() {
    els.labelsLayer.innerHTML = '';
    state.labels.forEach((label) => {
      const node = label.type === 'image' ? createImageLabel(label) : createTextLabel(label);
      els.labelsLayer.appendChild(node);
      // Une étiquette longue placée près du bord ne doit pas dépasser du plateau.
      clampLabel(label, node);
      node.style.setProperty('--x', `${label.x}px`);
      node.style.setProperty('--y', `${label.y}px`);
      makeDraggable(node, label);
    });
  }

  function createTextLabel(label) {
    const node = document.createElement('div');
    node.className = 'label-item text-label';
    node.dataset.id = label.id;
    node.textContent = label.text;
    node.style.setProperty('--x', `${label.x}px`);
    node.style.setProperty('--y', `${label.y}px`);
    node.style.fontFamily = quoteFont(label.fontFamily);
    node.style.fontSize = `${label.fontSize || 36}px`;
    node.style.fontWeight = label.fontWeight || 'normal';
    node.style.textDecoration = label.textDecoration || 'none';
    node.style.color = label.textColor || '#111827';
    node.style.backgroundColor = label.bgColor || '#ffffff';
    node.style.border = `${label.borderWidth ?? 3}px solid ${label.borderColor || '#111827'}`;
    node.style.borderRadius = `${label.borderRadius ?? 16}px`;
    return node;
  }

  function quoteFont(font) {
    if (!font) return FONT_STACKS.Arial;
    if (FONT_STACKS[font]) return FONT_STACKS[font];
    const safeFont = font.replace(/["']/g, '').trim();
    return safeFont ? `"${safeFont}", Arial, sans-serif` : FONT_STACKS.Arial;
  }

  function createImageLabel(label) {
    const node = document.createElement('div');
    node.className = 'label-item image-label';
    node.dataset.id = label.id;
    node.style.setProperty('--x', `${label.x}px`);
    node.style.setProperty('--y', `${label.y}px`);
    node.style.width = `${label.width || 180}px`;
    node.style.height = `${label.height || 180}px`;
    node.style.border = `${label.borderWidth || 0}px solid ${label.borderColor || '#111827'}`;
    node.style.borderRadius = `${label.borderRadius || 0}px`;
    node.style.backgroundColor = label.bgColor || '#ffffff';

    const img = document.createElement('img');
    img.src = label.src;
    img.alt = label.name || 'Image';
    node.appendChild(img);

    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.title = 'Redimensionner';
    node.appendChild(handle);
    makeResizable(handle, node, label);

    return node;
  }

  function makeDraggable(node, label) {
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let moved = false;

    node.addEventListener('pointerdown', (event) => {
      if (event.target.classList.contains('resize-handle')) return;
      event.preventDefault();
      node.setPointerCapture?.(event.pointerId);
      startX = event.clientX;
      startY = event.clientY;
      originX = label.x;
      originY = label.y;
      moved = false;
      node.classList.add('dragging');
      els.trashZone.classList.add('active');
    });

    node.addEventListener('pointermove', (event) => {
      if (!node.classList.contains('dragging')) return;
      event.preventDefault();
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      label.x = originX + dx;
      label.y = originY + dy;
      node.style.setProperty('--x', `${label.x}px`);
      node.style.setProperty('--y', `${label.y}px`);
      els.trashZone.classList.toggle('hot', intersects(node, els.trashZone));
    });

    const endDrag = (event) => {
      if (!node.classList.contains('dragging')) return;
      node.releasePointerCapture?.(event.pointerId);
      node.classList.remove('dragging');
      els.trashZone.classList.remove('active');
      const inTrash = intersects(node, els.trashZone);
      els.trashZone.classList.remove('hot');
      if (inTrash && moved) {
        state.labels = state.labels.filter((item) => item.id !== label.id);
        renderLabels();
      } else {
        clampLabel(label, node);
        node.style.setProperty('--x', `${label.x}px`);
        node.style.setProperty('--y', `${label.y}px`);
      }
      saveAutosave();
    };

    node.addEventListener('pointerup', endDrag);
    node.addEventListener('pointercancel', endDrag);
  }

  function makeResizable(handle, node, label) {
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;

    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      handle.setPointerCapture?.(event.pointerId);
      startX = event.clientX;
      startY = event.clientY;
      startW = label.width || node.offsetWidth;
      startH = label.height || node.offsetHeight;
      node.classList.add('dragging');
    });

    handle.addEventListener('pointermove', (event) => {
      event.stopPropagation();
      if (!node.classList.contains('dragging')) return;
      event.preventDefault();
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const next = Math.max(60, Math.min(520, Math.max(startW + dx, startH + dy)));
      label.width = next;
      label.height = next;
      node.style.width = `${next}px`;
      node.style.height = `${next}px`;
    });

    const endResize = (event) => {
      event.stopPropagation();
      if (!node.classList.contains('dragging')) return;
      handle.releasePointerCapture?.(event.pointerId);
      node.classList.remove('dragging');
      saveAutosave();
    };
    handle.addEventListener('pointerup', endResize);
    handle.addEventListener('pointercancel', endResize);
  }

  function intersects(a, b) {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return !(ra.right < rb.left || ra.left > rb.right || ra.bottom < rb.top || ra.top > rb.bottom);
  }

  function clampAllLabels() {
    state.labels.forEach((label) => {
      const fakeSize = estimateLabelSize(label);
      clampLabel(label, fakeSize);
    });
  }

  function clampLabel(label, nodeOrSize) {
    const rect = els.workspace.getBoundingClientRect();
    const width = nodeOrSize instanceof Element ? nodeOrSize.offsetWidth : nodeOrSize.width;
    const height = nodeOrSize instanceof Element ? nodeOrSize.offsetHeight : nodeOrSize.height;
    label.x = Math.max(0, Math.min(label.x, Math.max(0, rect.width - width - 8)));
    label.y = Math.max(0, Math.min(label.y, Math.max(0, rect.height - height - 8)));
  }

  function estimateLabelSize(label) {
    if (label.type === 'image') return { width: label.width || 180, height: label.height || 180 };
    const len = String(label.text || '').length;
    return { width: Math.max(80, len * (label.fontSize || 36) * 0.65 + 40), height: (label.fontSize || 36) + 28 };
  }

  function applyColumnPreset(preset) {
    const presets = {
      '2': ['Colonne 1', 'Colonne 2'],
      '3': ['Colonne 1', 'Colonne 2', 'Colonne 3'],
      '4': ['Colonne 1', 'Colonne 2', 'Colonne 3', 'Colonne 4'],
      'oui-non': ['Oui', 'Non'],
      'vrai-faux': ['Vrai', 'Faux']
    };
    const titles = presets[preset] || [];
    state.columns = titles.map((title, index) => ({
      title,
      color: COLUMN_PALETTE[index % COLUMN_PALETTE.length]
    }));
    renderColumns();
    saveAutosave();
  }

  function addCustomColumn() {
    const title = els.customColumnTitle.value.trim() || `Colonne ${state.columns.length + 1}`;
    state.columns.push({ title, color: state.styles.columnColor });
    els.customColumnTitle.value = '';
    renderColumns();
    saveAutosave();
  }

  function renderColumns() {
    els.columnsLayer.innerHTML = '';
    state.columns.forEach((column) => {
      const block = document.createElement('div');
      block.className = 'column-block';
      block.style.setProperty('--column-color', column.color || '#dbeafe');
      const title = document.createElement('div');
      title.className = 'column-title';
      title.textContent = column.title || '';
      block.appendChild(title);
      els.columnsLayer.appendChild(block);
    });
    renderColumnList();
  }

  function renderColumnList() {
    els.columnList.innerHTML = '';
    if (!state.columns.length) {
      els.columnList.className = 'column-list empty';
      els.columnList.textContent = 'Aucune colonne pour le moment.';
      return;
    }
    els.columnList.className = 'column-list';
    state.columns.forEach((column, index) => {
      const item = document.createElement('div');
      item.className = 'column-list-item';
      const dot = document.createElement('span');
      dot.className = 'column-color-dot';
      dot.style.background = column.color;
      const name = document.createElement('strong');
      name.textContent = column.title;
      item.append(dot, name);
      const editBtn = document.createElement('button');
      editBtn.className = 'mini-button';
      editBtn.textContent = 'Modifier';
      editBtn.addEventListener('click', () => editColumn(index));
      const delBtn = document.createElement('button');
      delBtn.className = 'mini-button';
      delBtn.textContent = 'Supprimer';
      delBtn.addEventListener('click', () => {
        state.columns.splice(index, 1);
        renderColumns();
        saveAutosave();
      });
      item.appendChild(editBtn);
      item.appendChild(delBtn);
      els.columnList.appendChild(item);
    });
  }

  function editColumn(index) {
    const current = state.columns[index];
    const title = window.prompt('Nouveau titre de la colonne :', current.title);
    if (title === null) return;
    current.title = title.trim() || current.title;
    current.color = state.styles.columnColor || current.color;
    renderColumns();
    saveAutosave();
  }

  function setMenuVisible(visible) {
    state.settings.menuVisible = visible;
    applySettings();
    saveAutosave();
  }

  function applySettings() {
    ['top', 'bottom', 'left', 'right'].forEach((pos) => els.body.classList.remove(`menu-${pos}`));
    els.body.classList.add(`menu-${state.settings.menuPosition || 'top'}`);
    els.body.classList.toggle('menu-hidden', !state.settings.menuVisible);
    els.menuToggle.setAttribute('aria-expanded', String(state.settings.menuVisible));
    els.menuToggleText.textContent = state.settings.menuVisible ? 'Masquer le menu' : 'Menu';
    els.menuToggle.setAttribute('aria-label', state.settings.menuVisible ? 'Masquer le menu' : 'Afficher le menu');
  }

  function updateFullscreenButton() {
    const active = Boolean(document.fullscreenElement);
    els.fullscreenBtn.classList.toggle('active', active);
    const label = active ? 'Quitter le plein écran' : 'Plein écran';
    els.fullscreenBtn.setAttribute('aria-label', label);
    els.fullscreenBtn.title = label;
    els.fullscreenBtn.querySelector('.btn-label').textContent = label;
  }

  function loadPrefs() {
    try {
      return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(PREFS_KEY)) || {}) };
    } catch (error) {
      return { ...DEFAULT_PREFS };
    }
  }

  function setPrefs(changes) {
    prefs = { ...prefs, ...changes };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (error) {
      // Préférences non conservées (navigation privée…) : elles restent actives pour la session.
    }
    applyPrefs();
    syncSettingsForm();
  }

  function applyPrefs() {
    const matches = (query) => Boolean(window.matchMedia?.(query).matches);
    const dark = prefs.theme === 'dark' || (prefs.theme !== 'light' && matches('(prefers-color-scheme: dark)'));
    const reduce = prefs.motion === 'reduce' || (prefs.motion !== 'on' && matches('(prefers-reduced-motion: reduce)'));
    els.root.dataset.theme = dark ? 'dark' : 'light';
    els.root.dataset.motion = reduce ? 'reduce' : 'full';
    els.root.dataset.contrast = prefs.contrast ? 'high' : 'normal';
    els.root.style.setProperty('--text-scale', ({ 115: 1.15, 130: 1.3 })[prefs.text] || 1);
    els.themeToggle.setAttribute('aria-label', dark ? 'Activer le mode clair' : 'Activer le mode sombre');
  }

  function syncSettingsForm() {
    const form = els.settingsForm.elements;
    form.theme.value = prefs.theme;
    form.text.value = String(prefs.text);
    form.motion.value = prefs.motion;
    form.contrast.checked = Boolean(prefs.contrast);
    form.menuPosition.value = state.settings.menuPosition;
  }

  function resetUiSettings() {
    state.settings.menuPosition = 'top';
    state.settings.menuVisible = true;
    applySettings();
    saveAutosave();
    setPrefs(DEFAULT_PREFS);
  }

  function newActivity() {
    if (!window.confirm('Vider l’activité en cours ?')) return;
    state.labels = [];
    state.columns = [];
    state.currentFileName = 'activite-etiquettes.etiq';
    renderAll();
    saveAutosave();
  }

  function serializeState() {
    return {
      app: 'Générateur d’étiquettes déplaçables',
      version: 1,
      savedAt: new Date().toISOString(),
      labels: state.labels,
      columns: state.columns,
      settings: state.settings,
      styles: state.styles,
      nextId: state.nextId
    };
  }

  function saveActivity(filename) {
    const safeName = filename.endsWith('.etiq') ? filename : `${filename}.etiq`;
    const blob = new Blob([JSON.stringify(serializeState(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    state.currentFileName = safeName;
  }

  async function handleOpenActivity(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object') throw new Error('Format invalide');
      loadState(data);
      state.currentFileName = file.name.endsWith('.etiq') ? file.name : `${file.name}.etiq`;
      renderAll();
      applySettings();
      saveAutosave();
    } catch (error) {
      alert('Impossible d’ouvrir ce fichier .etiq.');
    } finally {
      event.target.value = '';
    }
  }

  function loadState(data) {
    const isObject = (item) => item && typeof item === 'object';
    state.labels = (Array.isArray(data.labels) ? data.labels : []).filter((label) =>
      isObject(label) && Number.isFinite(label.x) && Number.isFinite(label.y) &&
      (label.type === 'image' ? typeof label.src === 'string' : typeof label.text === 'string'));
    state.columns = (Array.isArray(data.columns) ? data.columns : []).filter(isObject);
    const settings = data.settings || {};
    if (['top', 'bottom', 'left', 'right'].includes(settings.menuPosition)) state.settings.menuPosition = settings.menuPosition;
    if (typeof settings.menuVisible === 'boolean') state.settings.menuVisible = settings.menuVisible;
    state.styles = { ...state.styles, ...(data.styles || {}) };
    state.nextId = Number(data.nextId) || state.labels.length + 1;
  }

  let autosaveWarningShown = false;

  function saveAutosave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState()));
      autosaveWarningShown = false;
    } catch (error) {
      // Certaines grosses activités avec beaucoup d’images peuvent dépasser le quota localStorage.
      if (autosaveWarningShown) return;
      autosaveWarningShown = true;
      alert('La sauvegarde automatique a échoué (activité trop volumineuse, sans doute à cause des images). Pensez à enregistrer l’activité en .etiq pour ne rien perdre.');
    }
  }

  function loadAutosave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') loadState(data);
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  function debounce(fn, wait) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  init();
})();
