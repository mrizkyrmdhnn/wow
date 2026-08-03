'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// KONFIGURASI API
// ═══════════════════════════════════════════════════════════════════════════════
const API_BASE = '';  // same origin

// ─── API HELPER ───────────────────────────────────────────────────────────────
async function apiRequest(method, path, body = null, isFormData = false) {
  const token = AuthManager.getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isFormData ? body : JSON.stringify(body);

  const res = await fetch(API_BASE + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH MANAGER
// ═══════════════════════════════════════════════════════════════════════════════
const AuthManager = {
  TOKEN_KEY: 'pdm_token',
  USER_KEY:  'pdm_user',

  getToken() { return localStorage.getItem(this.TOKEN_KEY); },
  getUser()  { return JSON.parse(localStorage.getItem(this.USER_KEY) || 'null'); },

  setSession(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },

  isLoggedIn() { return !!this.getToken(); },
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATE GLOBAL
// ═══════════════════════════════════════════════════════════════════════════════
let parsedData   = [];
let filteredData = [];
let columns      = [];
let currentFile  = { id: null, name: '', size: 0, rows: 0 };
let userFiles    = [];  // daftar file dari API

// Inventory column mapping
let invCols = { device: '', status: '', type: '', location: '', ip: '', vendor: '' };

// Chart instances
let chartInstances = { bar: null, line: null, pie: null, status: null, type: null, location: null };

// Pagination & Table Edit state
const PAGE_SIZE = 20;
let currentPage    = 1;
let sortCol        = null;
let sortDir        = 'asc';
let searchQuery    = '';
let selectedRowsSet = new Set();
let isTableEditMode = false;

// Import state
let importFile = null;

// ─── COLOR PALETTE ────────────────────────────────────────────────────────────
const PALETTE = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899',
  '#8b5cf6', '#14b8a6', '#f97316', '#3b82f6', '#22c55e',
  '#ef4444', '#84cc16', '#a855f7', '#06b6d4', '#d946ef',
  '#eab308', '#f43f5e', '#64748b', '#0891b2', '#2563eb',
];

const STATUS_COLORS = {
  up: '#10b981', online: '#10b981', aktif: '#10b981', active: '#10b981',
  down: '#ef4444', offline: '#ef4444', nonaktif: '#ef4444', inactive: '#ef4444',
  standby: '#f59e0b', maintenance: '#f59e0b', warning: '#f59e0b',
  unknown: '#94a3b8',
};

function hexAlpha(hex, alpha) {
  if (!hex || hex[0] !== '#') return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── CHART.JS GLOBAL DEFAULTS ─────────────────────────────────────────────────
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 12.5;
Chart.defaults.color = '#64748b';
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,23,42,0.95)';
Chart.defaults.plugins.tooltip.titleColor = '#f1f5f9';
Chart.defaults.plugins.tooltip.bodyColor = '#94a3b8';
Chart.defaults.plugins.tooltip.padding = { x: 14, y: 12 };
Chart.defaults.plugins.tooltip.cornerRadius = 10;
Chart.defaults.plugins.tooltip.titleFont = { weight: '700', size: 13 };
Chart.defaults.plugins.tooltip.bodyFont = { size: 12.5 };
Chart.defaults.plugins.tooltip.displayColors = true;
Chart.defaults.plugins.tooltip.boxPadding = 5;
Chart.defaults.animation.duration = 700;
Chart.defaults.animation.easing = 'easeOutCubic';

// ─── DOM REFS ─────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ═══════════════════════════════════════════════════════════════════════════════
// INIT: CEK AUTH & TAMPILKAN HALAMAN YANG TEPAT
// ═══════════════════════════════════════════════════════════════════════════════
let appInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
  // Pasang listener auth form di sini (DOM sudah siap)
  setupAuthForms();

  if (AuthManager.isLoggedIn()) {
    showApp();
  } else {
    showAuthOverlay();
  }
});

function showAuthOverlay() {
  const overlay = $('authOverlay');
  const wrapper = $('appWrapper');
  if (overlay) overlay.classList.remove('hidden');
  if (wrapper) wrapper.classList.add('hidden');
  // Reset ke tab login
  switchAuthTab('login');
}

function showApp() {
  $('authOverlay').classList.add('hidden');
  $('appWrapper').classList.remove('hidden');
  if (!appInitialized) {
    initApp();
    appInitialized = true;
  }
  loadUserFiles();
  updateUserBadge();
  loadActivityLog(); // muat riwayat inputan
}

function updateUserBadge() {
  const user = AuthManager.getUser();
  if (!user) return;
  const nameEl   = $('userNameDisplay');
  const avatarEl = $('userAvatar');
  if (nameEl)   nameEl.textContent   = user.username;
  if (avatarEl) avatarEl.textContent = user.username.charAt(0).toUpperCase();
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH FORMS
// ═══════════════════════════════════════════════════════════════════════════════
function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  $('tabLogin').classList.toggle('active', isLogin);
  $('tabRegister').classList.toggle('active', !isLogin);
  $('loginForm').classList.toggle('hidden', !isLogin);
  $('registerForm').classList.toggle('hidden', isLogin);
  $('loginError').classList.add('hidden');
  $('registerError').classList.add('hidden');
}

function togglePasswordVisibility(inputId, btnId) {
  const input = $(inputId);
  const btn   = $(btnId);
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.textContent = isHidden ? '🙈' : '👁';
}

function setupAuthForms() {
  // ── Form Login ─────────────────────────────────────────────────────────────
  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('loginUsername').value.trim();
    const password = $('loginPassword').value;
    const errEl    = $('loginError');
    const btn      = $('loginBtn');
    const spinner  = $('loginSpinner');

    errEl.classList.add('hidden');
    btn.disabled = true;
    spinner.classList.remove('hidden');

    try {
      const data = await apiRequest('POST', '/api/auth/login', { username, password });
      AuthManager.setSession(data.token, data.user);
      showApp();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      spinner.classList.add('hidden');
    }
  });

  // ── Form Register ──────────────────────────────────────────────────────────
  $('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('regUsername').value.trim();
    const email    = $('regEmail').value.trim();
    const password = $('regPassword').value;
    const errEl    = $('registerError');
    const btn      = $('registerBtn');
    const spinner  = $('registerSpinner');

    errEl.classList.add('hidden');
    btn.disabled = true;
    spinner.classList.remove('hidden');

    try {
      const data = await apiRequest('POST', '/api/auth/register', { username, email, password });
      AuthManager.setSession(data.token, data.user);
      showApp();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      spinner.classList.add('hidden');
    }
  });

  // ── File Selector ──────────────────────────────────────────────────────────
  $('fileSelector').addEventListener('change', async (e) => {
    const fileId = parseInt(e.target.value);
    if (!fileId) return;
    await loadFileFromDB(fileId);
  });

  // ── Hapus File (inline confirm bar) ────────────────────────────────────────
  const deleteConfirmBar = $('deleteConfirmBar');
  const deleteConfirmMsg = $('deleteConfirmMsg');
  const deleteConfirmYes = $('deleteConfirmYes');
  const deleteConfirmNo  = $('deleteConfirmNo');

  // Tombol trash → tampilkan confirm bar
  $('btnDeleteFile').addEventListener('click', () => {
    if (!currentFile.id) return;
    deleteConfirmMsg.textContent = `Hapus "${currentFile.name}"? Data tidak dapat dipulihkan.`;
    deleteConfirmBar.classList.remove('hidden');
    // Simpan id & nama ke dataset attr agar tidak berubah saat user scroll/klik
    deleteConfirmYes.dataset.fileId   = currentFile.id;
    deleteConfirmYes.dataset.fileName = currentFile.name;
  });

  // Tombol "Batal"
  deleteConfirmNo.addEventListener('click', () => {
    deleteConfirmBar.classList.add('hidden');
  });

  // Tombol "Ya, Hapus"
  deleteConfirmYes.addEventListener('click', async () => {
    deleteConfirmBar.classList.add('hidden');
    const fileId   = Number(deleteConfirmYes.dataset.fileId);
    const fileName = deleteConfirmYes.dataset.fileName;
    if (!fileId) { showToast('ID dataset tidak valid'); return; }
    try {
      await apiRequest('DELETE', `/api/data/files/${fileId}`);
      userFiles = userFiles.filter(f => Number(f.id) !== fileId);
      resetAll();
      updateFileSelector();
      showToast(`Dataset "${fileName}" berhasil dihapus`);
    } catch (err) {
      console.error('[Delete]', err);
      showToast('Gagal menghapus: ' + err.message);
    }
  });
}

// (logout dipasang di dalam initApp() di bawah)


// ═══════════════════════════════════════════════════════════════════════════════
// FILE MANAGER: Load daftar file user
// ═══════════════════════════════════════════════════════════════════════════════
async function loadUserFiles() {
  try {
    const data = await apiRequest('GET', '/api/data/files');
    userFiles = data.files || [];
    updateFileSelector();
  } catch (err) {
    console.warn('[loadUserFiles]', err.message);
  }
}

function updateFileSelector() {
  const sel = $('fileSelector');
  const btnDel = $('btnDeleteFile');
  sel.innerHTML = '<option value="">— Pilih Dataset —</option>';
  userFiles.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = `${f.file_name} (${f.row_count} baris)`;
    sel.appendChild(opt);
  });
  if (currentFile.id) {
    sel.value = currentFile.id;
    btnDel.style.display = '';
  } else {
    btnDel.style.display = 'none';
  }
}



async function loadFileFromDB(fileId) {
  showLoading('Memuat data...');
  try {
    const data = await apiRequest('GET', `/api/data/rows/${fileId}`);
    const { file, rows } = data;
    const cols = file.column_names;
    const parsedRows = rows.map(r => {
      const { _rowId, ...rest } = r;
      return rest;
    });
    currentFile = { id: file.id, name: file.file_name, size: 0, rows: parsedRows.length };
    // Store row IDs for sync
    onDataLoaded(parsedRows, cols, file.inv_config || {});
    updateFileSelector();
  } catch (err) {
    showToast('Gagal memuat data: ' + err.message);
  } finally {
    hideLoading();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP INIT (dijalankan setelah login)
// ═══════════════════════════════════════════════════════════════════════════════
function initApp() {
  const csvInput    = $('csvInput');
  const dropZone    = $('dropZone');
  const uploadSection = $('uploadSection');
  const dashboard   = $('dashboard');

  // Upload file baru
  csvInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) uploadFile(file);
  });

  // Drag & Drop
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && isValidFile(file.name)) uploadFile(file);
    else showToast('Hanya file .csv atau .xlsx yang diterima');
  });

  // Tab switching
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach((t) => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      document.querySelectorAll('.tab-panel').forEach((p) => {
        p.classList.toggle('hidden', p.id !== `panel-${target}`);
      });
      // Muat ulang riwayat saat tab Riwayat dibuka
      if (target === 'history') loadActivityLog();
    });
  });

  // Tombol Muat Ulang di tab Riwayat
  const btnRefreshHistory = $('btnRefreshHistory');
  if (btnRefreshHistory) btnRefreshHistory.addEventListener('click', loadActivityLog);

  // Header reset
  $('btnHeaderReset').addEventListener('click', resetAll);

  // ── Logout ────────────────────────────────────────────────────────────────
  const btnLogout = $('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      AuthManager.clearSession();
      resetAll();
      userFiles = [];
      showAuthOverlay();
      showToast('Berhasil keluar. Sampai jumpa!');
    });
  }

  // Chart controls
  $('btnRender').addEventListener('click', renderCustomCharts);
  $('labelCol').addEventListener('change', () => { if (parsedData.length) renderCustomCharts(); });
  $('valueCol').addEventListener('change', () => { if (parsedData.length) renderCustomCharts(); });
  $('chartType').addEventListener('change', () => { if (parsedData.length) renderCustomCharts(); });
  $('btnReset').addEventListener('click', () => {
    destroyCharts('bar', 'line', 'pie');
    $('chartsArea').classList.add('hidden');
    showToast('Grafik direset');
  });

  // Download buttons
  $('btnDlBar').addEventListener('click', () => downloadChart('barChart', 'bar-chart.png'));
  $('btnDlLine').addEventListener('click', () => downloadChart('lineChart', 'line-chart.png'));
  $('btnDlPie').addEventListener('click', () => downloadChart('pieChart', 'pie-chart.png'));
  $('btnDlStatus').addEventListener('click', () => downloadChart('statusChart', 'status-chart.png'));
  $('btnDlType').addEventListener('click', () => downloadChart('typeChart', 'type-chart.png'));
  $('btnDlLocation').addEventListener('click', () => downloadChart('locationChart', 'location-chart.png'));

  // Config
  $('btnApplyConfig').addEventListener('click', applyConfig);
  $('btnAutoDetect').addEventListener('click', autoDetectColumns);

  // Table search
  $('tableSearch').addEventListener('input', () => {
    searchQuery = $('tableSearch').value.toLowerCase();
    applyFilter();
  });

  // Table Edit Toggle
  const btnToggleEditTable = $('btnToggleEditTable');
  btnToggleEditTable.addEventListener('click', () => {
    if (!parsedData || !parsedData.length) { showToast('Belum ada data untuk diedit'); return; }
    isTableEditMode = !isTableEditMode;
    btnToggleEditTable.classList.toggle('active', isTableEditMode);
    btnToggleEditTable.textContent = isTableEditMode ? '✓ Selesai Edit' : 'Edit Data';
    const notice = $('tableEditNotice');
    if (notice) notice.classList.toggle('hidden', !isTableEditMode);
    if (!isTableEditMode) selectedRowsSet.clear();
    updateDeleteSelectedBtn();
    showToast(isTableEditMode ? 'Mode Edit aktif' : 'Mode Edit dimatikan');
    buildTableHead();
    renderTablePage();
  });

  // Delete Selected
  const btnDeleteSelected = $('btnDeleteSelected');
  if (btnDeleteSelected) {
    btnDeleteSelected.addEventListener('click', async () => {
      if (selectedRowsSet.size === 0) return;
      const count = selectedRowsSet.size;
      if (!confirm(`Apakah Anda yakin ingin menghapus ${count} baris data terpilih?`)) return;

      // Get rowIds from selected rows
      const rowsToDelete = [...selectedRowsSet];
      const rowIds = rowsToDelete.map(r => r._rowId).filter(Boolean);

      // Remove from local data
      parsedData = parsedData.filter(r => !selectedRowsSet.has(r));
      selectedRowsSet.clear();
      updateDeleteSelectedBtn();
      onTableDataModified();
      applyFilter();

      // Sync to DB if file loaded from DB
      if (currentFile.id && rowIds.length) {
        try {
          await apiRequest('DELETE', `/api/data/rows/${currentFile.id}`, { row_ids: rowIds });
        } catch (err) {
          console.warn('[Delete rows]', err.message);
        }
      }
      showToast(`${count} baris data berhasil dihapus`);
    });
  }

  $('btnExportCSV').addEventListener('click', exportCSV);

  // Pagination
  $('btnPrevPage').addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTablePage(); } });
  $('btnNextPage').addEventListener('click', () => {
    const maxPage = Math.ceil(filteredData.length / PAGE_SIZE);
    if (currentPage < maxPage) { currentPage++; renderTablePage(); }
  });

  // Input Data Form
  $('inputDataForm').addEventListener('submit', handleAddNewData);
  $('btnClearInput').addEventListener('click', () => { $('inputDataForm').reset(); showToast('Form dikosongkan'); });

  // Import File Button
  $('btnImportFile').addEventListener('click', openImportModal);

  // Import File Input
  $('importFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) selectImportFile(file);
  });

  // Import Drop Zone
  const importDropZone = $('importDropZone');
  importDropZone.addEventListener('dragover', (e) => { e.preventDefault(); importDropZone.classList.add('dragover'); });
  importDropZone.addEventListener('dragleave', () => importDropZone.classList.remove('dragover'));
  importDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    importDropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && isValidFile(file.name)) selectImportFile(file);
    else showToast('Hanya file .csv atau .xlsx yang diterima');
  });

  // Mode Import radio → tampilkan/sembunyikan opsi dedup
  document.querySelectorAll('input[name="importMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const dedupOpt = $('dedupOption');
      if (!dedupOpt) return;
      if (radio.value === 'replace' && radio.checked) {
        // Saat Replace: dedup tidak relevan, dimmed
        dedupOpt.classList.add('dimmed');
      } else {
        dedupOpt.classList.remove('dimmed');
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPLOAD FILE (ke backend)
// ═══════════════════════════════════════════════════════════════════════════════
async function uploadFile(file) {
  if (!isValidFile(file.name)) { showToast('Hanya file .csv atau .xlsx yang diterima'); return; }

  showLoading('Mengunggah & memproses file...');

  try {
    const formData = new FormData();
    formData.append('file', file);

    const data = await apiRequest('POST', '/api/data/upload', formData, true);
    const { file: fileInfo } = data;

    showToast(data.message);

    // Tambah ke list user files
    userFiles.unshift({
      id: fileInfo.id,
      file_name: fileInfo.file_name,
      original_name: fileInfo.file_name,
      column_names: fileInfo.column_names,
      inv_config: {},
      row_count: fileInfo.row_count,
    });

    // Load file dari DB
    await loadFileFromDB(fileInfo.id);
    updateFileSelector();
    $('fileSelector').value = fileInfo.id;

  } catch (err) {
    showToast('Gagal mengunggah: ' + err.message);
    hideLoading();
  }
}

// ─── FILE VALIDATION ──────────────────────────────────────────────────────────
function isValidFile(name) { return /\.(csv|xlsx|xls)$/i.test(name); }

// ─── ON DATA LOADED ───────────────────────────────────────────────────────────
function onDataLoaded(data, cols, savedInvConfig = {}) {
  parsedData = data.map((row, i) => ({ _rowId: row._rowId || null, ...row }));
  columns = cols;
  selectedRowsSet.clear();
  updateDeleteSelectedBtn();
  reindexSequenceColumns();
  filteredData = [...parsedData];
  currentFile.rows = data.length;
  currentPage = 1;
  sortCol = null;
  sortDir = 'asc';
  searchQuery = '';

  // Restore saved config or auto-detect
  if (savedInvConfig && Object.values(savedInvConfig).some(v => v)) {
    invCols = { device: '', status: '', type: '', location: '', ip: '', vendor: '', ...savedInvConfig };
    syncConfigSelects();
  } else {
    autoDetectColumns(false);
  }

  // Setup UI
  hideLoading();
  $('uploadSection').classList.add('hidden');
  $('dashboard').classList.remove('hidden');

  // Header
  $('headerStatus').textContent = `${data.length.toLocaleString('id-ID')} baris · ${cols.length} kolom`;
  $('btnHeaderReset').classList.remove('hidden');
  $('dataFileInfo').textContent = currentFile.name;

  // Populate selects
  populateAllSelects();

  // Render all
  buildKPI();
  renderInventoryCharts();
  renderCustomCharts();
  buildTableHead();
  renderTablePage();
  buildFileInfo();
  buildColumnChips();
  renderInputForm();
  renderInputLog();

  showToast(`Data dimuat: ${data.length} baris, ${cols.length} kolom`);
  const csvInput = $('csvInput');
  if (csvInput) csvInput.value = '';
}

// ─── INPUT FORM DYNAMIC GENERATION ───────────────────────────────────────────
let recentAdditions = [];

function renderInputForm() {
  const inputFieldsGrid = $('inputFieldsGrid');
  if (!inputFieldsGrid) return;
  inputFieldsGrid.innerHTML = '';
  if (!columns || !columns.length) return;

  const displayCols = columns.filter(c => c !== '_rowId');

  displayCols.forEach((col, idx) => {
    const fieldWrap = document.createElement('div');
    fieldWrap.className = 'input-field';
    const isSeq = isSequenceColumn(col);

    const label = document.createElement('label');
    label.className = 'field-label';
    label.setAttribute('for', `input-col-${idx}`);
    label.textContent = isSeq ? `${col} (Otomatis)` : col;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input-control';
    input.id = `input-col-${idx}`;
    input.name = col;

    if (isSeq) {
      input.value = parsedData.length + 1;
      input.readOnly = true;
      input.style.backgroundColor = '#f1f5f9';
      input.style.cursor = 'not-allowed';
    } else {
      input.placeholder = `Masukkan ${col}...`;
      const listId = `datalist-col-${idx}`;
      const datalist = document.createElement('datalist');
      datalist.id = listId;
      const uniqueVals = new Set();
      parsedData.forEach(row => {
        const val = row[col];
        if (val !== undefined && val !== null && String(val).trim() !== '') uniqueVals.add(String(val).trim());
      });
      if (uniqueVals.size > 0 && uniqueVals.size <= 50) {
        uniqueVals.forEach(v => { const opt = document.createElement('option'); opt.value = v; datalist.appendChild(opt); });
        input.setAttribute('list', listId);
      }
      fieldWrap.appendChild(label);
      fieldWrap.appendChild(input);
      if (datalist.children.length > 0) fieldWrap.appendChild(datalist);
      $('inputFieldsGrid').appendChild(fieldWrap);
      return;
    }

    fieldWrap.appendChild(label);
    fieldWrap.appendChild(input);
    $('inputFieldsGrid').appendChild(fieldWrap);
  });
}

async function handleAddNewData(e) {
  e.preventDefault();
  if (!parsedData || !columns.length) { showToast('Belum ada data file yang dimuat'); return; }

  const formData = new FormData($('inputDataForm'));
  const newRow = {};
  let hasOtherFieldValues = false;

  columns.filter(c => c !== '_rowId').forEach(col => {
    if (isSequenceColumn(col)) {
      newRow[col] = parsedData.length + 1;
    } else {
      const val = (formData.get(col) || '').toString().trim();
      newRow[col] = val;
      if (val !== '') hasOtherFieldValues = true;
    }
  });

  if (!hasOtherFieldValues) { showToast('Data masih kosong'); return; }

  // Add to local dataset
  const localRow = { _rowId: null, ...newRow };
  parsedData.push(localRow);
  reindexSequenceColumns();
  filteredData = [...parsedData];
  currentFile.rows = parsedData.length;
  $('headerStatus').textContent = `${parsedData.length.toLocaleString('id-ID')} baris · ${columns.length} kolom`;

  // Sync to DB
  if (currentFile.id) {
    try {
      const result = await apiRequest('POST', `/api/data/rows/${currentFile.id}`, { row_data: newRow });
      localRow._rowId = result.rowId;
      // Update file list row count
      const fileRef = userFiles.find(f => f.id === currentFile.id);
      if (fileRef) fileRef.row_count = parsedData.length;
      updateFileSelector();
    } catch (err) {
      console.warn('[Add row sync]', err.message);
    }
  }

  // Log addition
  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const mainVal = newRow[invCols.device] || newRow[columns.filter(c => c !== '_rowId')[0]] || 'Data Baru';
  const detailStr = columns.filter(c => c !== '_rowId').map(c => newRow[c] ? `${c}: ${newRow[c]}` : null).filter(Boolean).join(' | ');
  recentAdditions.unshift({ time: timeStr, main: mainVal, detail: detailStr });

  // Re-render UI
  buildKPI();
  renderInventoryCharts();
  renderCustomCharts();
  renderTablePage();
  const tableBadge = $('tableBadge');
  if (tableBadge) tableBadge.textContent = `${filteredData.length.toLocaleString('id-ID')} baris`;
  buildFileInfo();
  renderInputForm();
  renderInputLog();

  $('inputDataForm').reset();
  showToast('Data baru berhasil ditambahkan');
  loadActivityLog(); // perbarui tab Riwayat
}

function renderInputLog() {
  const inputLogList = $('inputLogList');
  const inputLogCount = $('inputLogCount');
  if (!inputLogList) return;
  inputLogList.innerHTML = '';
  if (!recentAdditions.length) { inputLogCount.textContent = 'Belum ada data yang ditambahkan'; return; }
  inputLogCount.textContent = `${recentAdditions.length} entri ditambahkan`;
  recentAdditions.forEach(item => {
    const div = document.createElement('div');
    div.className = 'input-log-item';
    div.innerHTML = `
      <div class="input-log-time">${escapeHtml(item.time)}</div>
      <div class="input-log-main">${escapeHtml(item.main)}</div>
      <div class="input-log-detail">${escapeHtml(item.detail)}</div>
    `;
    inputLogList.appendChild(div);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT FILE MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function openImportModal() {
  if (!currentFile.id) { showToast('Pilih atau unggah dataset terlebih dahulu'); return; }
  importFile = null;
  $('importFileInput').value = '';
  $('importFilePreview').classList.add('hidden');
  $('importDropZone').classList.remove('hidden');
  $('importError').classList.add('hidden');
  // Reset mode & dedup ke default
  $('modeAppend').checked = true;
  $('chkSkipDuplicates').checked = true;
  $('dedupOption').classList.remove('dimmed');
  $('importModalOverlay').classList.remove('hidden');
}

function closeImportModal() {
  $('importModalOverlay').classList.add('hidden');
  importFile = null;
}

function selectImportFile(file) {
  if (!isValidFile(file.name)) { showToast('Hanya .csv atau .xlsx yang diterima'); return; }
  importFile = file;
  $('importFileName').textContent = file.name;
  $('importFileSize').textContent = formatBytes(file.size);
  $('importFilePreview').classList.remove('hidden');
  $('importDropZone').classList.add('hidden');
}

function clearImportFile() {
  importFile = null;
  $('importFileInput').value = '';
  $('importFilePreview').classList.add('hidden');
  $('importDropZone').classList.remove('hidden');
}

async function confirmImport() {
  if (!importFile) { showToast('Pilih file terlebih dahulu'); return; }
  const mode = document.querySelector('input[name="importMode"]:checked').value;
  const skipDuplicates = $('chkSkipDuplicates') ? $('chkSkipDuplicates').checked : true;
  const errEl = $('importError');
  const btnText = $('importBtnText');
  const btnSpinner = $('importBtnSpinner');

  errEl.classList.add('hidden');
  btnText.classList.add('hidden');
  btnSpinner.classList.remove('hidden');
  $('btnConfirmImport').disabled = true;

  try {
    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('mode', mode);
    formData.append('skip_duplicates', String(skipDuplicates));

    const data = await apiRequest('POST', `/api/data/import/${currentFile.id}`, formData, true);

    // Tampilkan pesan detail (termasuk info duplikat)
    let toastMsg = data.message;
    closeImportModal();
    showToast(toastMsg, data.skipped > 0 ? 4500 : 3000);

    // Reload data dari DB dan perbarui riwayat
    await loadFileFromDB(currentFile.id);
    await loadUserFiles();
    loadActivityLog();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btnText.classList.remove('hidden');
    btnSpinner.classList.add('hidden');
    $('btnConfirmImport').disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-DETECT INVENTORY COLUMNS
// ═══════════════════════════════════════════════════════════════════════════════
function autoDetectColumns(showMsg = true) {
  const keywords = {
    device:   ['device', 'hostname', 'host', 'nama', 'name', 'perangkat', 'node', 'equipment', 'asset'],
    status:   ['status', 'kondisi', 'state', 'health', 'availability'],
    type:     ['type', 'tipe', 'kategori', 'category', 'jenis', 'kind', 'model', 'class'],
    location: ['location', 'lokasi', 'site', 'gedung', 'building', 'area', 'region', 'kota', 'city', 'rack', 'floor'],
    ip:       ['ip', 'ip_address', 'ipaddress', 'alamat', 'address'],
    vendor:   ['vendor', 'merek', 'brand', 'manufacturer', 'merk', 'make'],
  };

  const visibleCols = columns.filter(c => c !== '_rowId');
  const detected = {};
  visibleCols.forEach(col => {
    const lower = col.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const [key, kws] of Object.entries(keywords)) {
      if (!detected[key] && kws.some(kw => lower.includes(kw))) detected[key] = col;
    }
  });

  invCols = {
    device:   detected.device   || visibleCols[0] || '',
    status:   detected.status   || '',
    type:     detected.type     || '',
    location: detected.location || '',
    ip:       detected.ip       || '',
    vendor:   detected.vendor   || '',
  };

  syncConfigSelects();
  if (showMsg) {
    const found = Object.entries(invCols).filter(([, v]) => v).map(([k]) => k);
    showToast(`Auto-deteksi: ${found.join(', ')} ditemukan`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RIWAYAT INPUTAN
// ═══════════════════════════════════════════════════════════════════════════════
async function loadActivityLog() {
  try {
    const data = await apiRequest('GET', '/api/activity?limit=200');
    renderActivityLog(data.logs || [], data.total || 0);
  } catch (err) {
    console.warn('[loadActivityLog]', err.message);
  }
}

function renderActivityLog(logs, total) {
  const body    = $('historyBody');
  const totalEl = $('historyTotal');
  const emptyEl = $('historyEmpty');
  const wrapEl  = $('historyTableWrap');

  if (!body) return;

  // Update counter
  if (totalEl) totalEl.textContent = `${total.toLocaleString('id-ID')} aktivitas`;

  if (!logs.length) {
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (wrapEl)  wrapEl.classList.add('hidden');
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');
  if (wrapEl)  wrapEl.classList.remove('hidden');

  // Label badge per action type
  const actionLabel = {
    upload:         'Unggah',
    import_append:  'Import Gabung',
    import_replace: 'Import Timpa',
    add_row:        'Tambah Manual',
  };

  body.innerHTML = '';
  logs.forEach(log => {
    const tr = document.createElement('tr');

    // Format waktu
    const dt = new Date(log.created_at);
    const timeStr = dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
      + ' ' + dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // Badge aksi
    const label = actionLabel[log.action_type] || log.action_type;
    const badgeHtml = `<span class="action-badge ${escapeHtml(log.action_type)}">${escapeHtml(label)}</span>`;

    // Dataset name (gunakan snapshot file_name, tunjukkan "(dihapus)" jika file sudah tidak ada)
    const datasetName = log.file_name || '—';
    const isDeleted   = !log.current_file_name && log.file_id;
    const datasetHtml = `<span class="history-dataset${isDeleted ? ' deleted' : ''}" title="${escapeHtml(datasetName)}">${escapeHtml(datasetName)}${isDeleted ? ' (dihapus)' : ''}</span>`;

    // Rows badge
    let rowsHtml = `<span class="history-rows-badge">+${log.rows_affected}</span>`;
    if (log.rows_skipped > 0) {
      rowsHtml += `<span class="history-rows-badge skipped">${log.rows_skipped} skip</span>`;
    }

    tr.innerHTML = `
      <td><span class="history-time">${escapeHtml(timeStr)}</span></td>
      <td>${badgeHtml}</td>
      <td>${datasetHtml}</td>
      <td><span class="history-desc" title="${escapeHtml(log.description)}">${escapeHtml(log.description)}</span></td>
      <td class="col-rows">${rowsHtml}</td>
    `;
    body.appendChild(tr);
  });
}

function syncConfigSelects() {
  const map = {
    device: $('cfgColDevice'), status: $('cfgColStatus'),
    type: $('cfgColType'), location: $('cfgColLocation'),
    ip: $('cfgColIP'), vendor: $('cfgColVendor'),
  };
  for (const [key, el] of Object.entries(map)) {
    if (el && invCols[key]) el.value = invCols[key];
  }
}

// ─── POPULATE ALL SELECTS ─────────────────────────────────────────────────────
function populateAllSelects() {
  const visibleCols = columns.filter(c => c !== '_rowId');
  populateSelect($('labelCol'), visibleCols, false);
  populateSelect($('valueCol'), visibleCols, false);
  [$('cfgColDevice'), $('cfgColStatus'), $('cfgColType'), $('cfgColLocation'), $('cfgColIP'), $('cfgColVendor')].forEach(sel => {
    populateSelect(sel, visibleCols, true);
  });
  const numericCol = visibleCols.find(col =>
    parsedData.slice(0, 10).every(row => !isNaN(parseFloat(row[col])) && row[col] !== '')
  );
  $('labelCol').value = invCols.device || visibleCols[0];
  $('valueCol').value = numericCol || (visibleCols.length > 1 ? visibleCols[1] : visibleCols[0]);
}

function populateSelect(el, cols, withEmpty = false) {
  if (!el) return;
  el.innerHTML = withEmpty ? '<option value="">— Tidak dipetakan —</option>' : '';
  cols.forEach(col => {
    const opt = document.createElement('option');
    opt.value = col;
    opt.textContent = col;
    el.appendChild(opt);
  });
}

// ─── APPLY CONFIG ─────────────────────────────────────────────────────────────
async function applyConfig() {
  invCols.device   = $('cfgColDevice').value;
  invCols.status   = $('cfgColStatus').value;
  invCols.type     = $('cfgColType').value;
  invCols.location = $('cfgColLocation').value;
  invCols.ip       = $('cfgColIP').value;
  invCols.vendor   = $('cfgColVendor').value;

  buildKPI();
  renderInventoryCharts();
  buildColumnChips();

  // Simpan konfigurasi ke DB
  if (currentFile.id) {
    try {
      await apiRequest('PUT', `/api/data/config/${currentFile.id}`, { inv_config: invCols });
    } catch (err) { console.warn('[Save config]', err.message); }
  }
  showToast('Konfigurasi diterapkan');
}

// ─── KPI CARDS ────────────────────────────────────────────────────────────────
function buildKPI() {
  const cards = [];
  cards.push({ label: 'Total Perangkat', value: parsedData.length.toLocaleString('id-ID'), sub: 'entri dalam dataset', color: 'blue' });

  if (invCols.status) {
    const freq = getFrequency(invCols.status);
    const upKeys   = ['up', 'online', 'aktif', 'active'];
    const downKeys = ['down', 'offline', 'nonaktif', 'inactive'];
    const upCount   = upKeys.reduce((sum, k)   => sum + (freq[Object.keys(freq).find(fk => fk.toLowerCase() === k)] || 0), 0);
    const downCount = downKeys.reduce((sum, k)  => sum + (freq[Object.keys(freq).find(fk => fk.toLowerCase() === k)] || 0), 0);
    if (upCount   > 0) cards.push({ label: 'Perangkat Aktif', value: upCount.toLocaleString('id-ID'),   sub: 'status online/up',    color: 'green'  });
    if (downCount > 0) cards.push({ label: 'Perangkat Mati',  value: downCount.toLocaleString('id-ID'), sub: 'status offline/down', color: 'red'    });
  }
  if (invCols.type)     cards.push({ label: 'Tipe Perangkat', value: Object.keys(getFrequency(invCols.type)).length.toLocaleString('id-ID'),     sub: 'kategori berbeda', color: 'purple' });
  if (invCols.location) cards.push({ label: 'Lokasi / Site',  value: Object.keys(getFrequency(invCols.location)).length.toLocaleString('id-ID'), sub: 'site terdaftar',   color: 'cyan'   });
  if (invCols.vendor)   cards.push({ label: 'Vendor',         value: Object.keys(getFrequency(invCols.vendor)).length.toLocaleString('id-ID'),   sub: 'merek/vendor',     color: 'yellow' });
  if (cards.length < 2) cards.push({ label: 'Total Kolom', value: columns.filter(c => c !== '_rowId').length, sub: 'field data', color: 'orange' });

  const kpiGrid = $('kpiGrid');
  kpiGrid.innerHTML = '';
  cards.forEach((card, i) => {
    const el = document.createElement('div');
    el.className = 'kpi-card';
    el.dataset.color = card.color;
    el.innerHTML = `<div class="kpi-body"><div class="kpi-label">${card.label}</div><div class="kpi-value">${card.value}</div><div class="kpi-sub">${card.sub}</div></div>`;
    el.style.animationDelay = `${i * 0.07}s`;
    el.classList.add('animate-in');
    kpiGrid.appendChild(el);
  });
}

// ─── INVENTORY CHARTS ─────────────────────────────────────────────────────────
function renderInventoryCharts() { renderStatusChart(); renderTypeChart(); renderLocationChart(); }

function renderStatusChart() {
  const noNotice = $('noStatusCol');
  const canvas   = $('statusChart');
  destroyCharts('status');
  if (!invCols.status) { noNotice.classList.remove('hidden'); canvas.style.display = 'none'; return; }
  noNotice.classList.add('hidden');
  canvas.style.display = '';
  const freq   = getFrequency(invCols.status);
  const labels = Object.keys(freq);
  const values = Object.values(freq);
  const colors = labels.map(l => STATUS_COLORS[l.toLowerCase()] || PALETTE[labels.indexOf(l) % PALETTE.length]);
  chartInstances.status = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors.map(c => hexAlpha(c, 0.85)), borderColor: '#fff', borderWidth: 3, hoverOffset: 12 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      animation: { animateRotate: true, animateScale: true, duration: 900, easing: 'easeOutQuart' },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, boxHeight: 12, padding: 14, font: { size: 12 }, color: '#475569', usePointStyle: true, pointStyle: 'circle' } },
        tooltip: { callbacks: { label: (item) => { const total = item.dataset.data.reduce((a, b) => a + b, 0); const pct = ((item.raw / total) * 100).toFixed(1); return ` ${item.label}: ${item.raw} (${pct}%)`; } } },
      },
    },
  });
}

function renderTypeChart() {
  const noNotice = $('noTypeCol');
  const canvas   = $('typeChart');
  destroyCharts('type');
  if (!invCols.type) { noNotice.classList.remove('hidden'); canvas.style.display = 'none'; return; }
  noNotice.classList.add('hidden');
  canvas.style.display = '';
  const freq   = getFrequency(invCols.type);
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const labels = sorted.map(([k]) => k);
  const values = sorted.map(([, v]) => v);
  const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);
  chartInstances.type = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Jumlah', data: values, backgroundColor: colors.map(c => hexAlpha(c, 0.82)), borderColor: colors, borderWidth: 1.5, borderRadius: 7, borderSkipped: false }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (item) => ` Jumlah: ${formatNumber(item.raw)}` } } },
      scales: {
        x: { beginAtZero: true, grid: { color: 'rgba(226,232,240,0.7)' }, border: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 }, callback: (v) => formatNumber(v) } },
        y: { grid: { display: false }, border: { display: false }, ticks: { color: '#475569', font: { size: 12, weight: '500' }, autoSkip: false } },
      },
    },
  });
}

function renderLocationChart() {
  const noNotice = $('noLocationCol');
  const canvas   = $('locationChart');
  destroyCharts('location');
  if (!invCols.location) { noNotice.classList.remove('hidden'); canvas.style.display = 'none'; return; }
  noNotice.classList.add('hidden');
  canvas.style.display = '';
  const freq   = getFrequency(invCols.location);
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const labels = sorted.map(([k]) => k);
  const values = sorted.map(([, v]) => v);
  const barW   = Math.max(labels.length * 80, canvas.parentElement.clientWidth - 1);
  canvas.style.width = barW + 'px';
  canvas.style.height = '100%';
  chartInstances.location = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Jumlah Perangkat', data: values, backgroundColor: labels.map((_, i) => hexAlpha(PALETTE[i % PALETTE.length], 0.82)), borderColor: labels.map((_, i) => PALETTE[i % PALETTE.length]), borderWidth: 2, borderRadius: 8, borderSkipped: false }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (item) => ` Perangkat: ${formatNumber(item.raw)}` } } },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: '#64748b', font: { size: 11.5, weight: '500' }, maxRotation: 30, autoSkip: false }, title: { display: true, text: invCols.location, color: '#94a3b8', font: { size: 11, weight: '600' }, padding: { top: 8 } } },
        y: { beginAtZero: true, grid: { color: 'rgba(226,232,240,0.7)' }, border: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 }, callback: (v) => formatNumber(v) } },
      },
    },
  });
}

// ─── CUSTOM CHARTS ────────────────────────────────────────────────────────────
function renderCustomCharts() {
  const labelCol  = $('labelCol').value;
  const valueCol  = $('valueCol').value;
  const chartType = $('chartType').value;
  if (!labelCol || !valueCol) { showToast('Pilih kolom label dan nilai terlebih dahulu'); return; }

  const rawValues  = parsedData.map(r => r[valueCol]);
  const numParsed  = rawValues.map(v => parseFloat(v));
  const numericCount = numParsed.filter(v => !isNaN(v)).length;
  const isNumeric  = numericCount / rawValues.length >= 0.5;

  let labels, values, yAxisLabel;
  if (isNumeric) {
    const agg = {};
    parsedData.forEach((r, i) => { const key = String(r[labelCol] ?? '(kosong)').trim(); const val = numParsed[i]; if (isNaN(val)) return; agg[key] = (agg[key] || 0) + val; });
    const sortedAgg = Object.entries(agg).sort((a, b) => b[1] - a[1]);
    labels = sortedAgg.map(([k]) => k);
    values = sortedAgg.map(([, v]) => v);
    yAxisLabel = valueCol;
  } else {
    const freq = {};
    parsedData.forEach(r => { const key = String(r[labelCol] ?? '(kosong)'); freq[key] = (freq[key] || 0) + 1; });
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    labels = sorted.map(([k]) => k);
    values = sorted.map(([, v]) => v);
    yAxisLabel = 'Jumlah';
    showToast(`Mode frekuensi: "${labelCol}"`);
  }

  renderStats(valueCol, isNumeric ? null : values);
  destroyCharts('bar', 'line', 'pie');
  const chartsArea = $('chartsArea');
  chartsArea.classList.remove('hidden');

  const showBar  = chartType === 'all' || chartType === 'bar';
  const showLine = chartType === 'all' || chartType === 'line';
  const showPie  = chartType === 'all' || chartType === 'pie';
  const wrapBar  = $('wrapBar'), wrapLine = $('wrapLine'), wrapPie = $('wrapPie');
  const rowBarLine = $('rowBarLine'), rowPie = $('rowPie');

  rowBarLine.style.display = (showBar || showLine) ? '' : 'none';
  wrapBar.style.display  = showBar  ? '' : 'none';
  wrapLine.style.display = showLine ? '' : 'none';
  rowPie.style.display   = showPie  ? '' : 'none';

  [wrapBar, wrapLine, wrapPie].forEach(el => { el.classList.remove('animate-in'); void el.offsetWidth; el.classList.add('animate-in'); });

  const singleColor = PALETTE[0];
  if (showBar) {
    const barData = groupSmallSlices(labels, values, 12, 0);
    const barCanvas = $('barChart');
    const barW = Math.max(barData.labels.length * 80, barCanvas.parentElement.clientWidth - 1);
    barCanvas.style.width = barW + 'px'; barCanvas.style.height = '100%';
    const barColors = barData.labels.map((_, i) => PALETTE[i % PALETTE.length]);
    if (barData.grouped) barColors[barColors.length - 1] = '#94a3b8';
    chartInstances.bar = new Chart(barCanvas, { type: 'bar', data: { labels: barData.labels, datasets: [{ label: yAxisLabel, data: barData.values, backgroundColor: barColors.map(c => hexAlpha(c, 0.82)), borderColor: barColors, borderWidth: 2, borderRadius: 10, borderSkipped: false, hoverBackgroundColor: barColors }] }, options: buildBarOptions(labelCol, yAxisLabel) });
  }
  if (showLine) {
    const lineData = groupSmallSlices(labels, values, 12, 0);
    const lineCanvas = $('lineChart');
    const lineW = Math.max(lineData.labels.length * 64, lineCanvas.parentElement.clientWidth - 1);
    lineCanvas.style.width = lineW + 'px'; lineCanvas.style.height = '100%';
    chartInstances.line = new Chart(lineCanvas, { type: 'line', data: { labels: lineData.labels, datasets: [{ label: yAxisLabel, data: lineData.values, borderColor: singleColor, backgroundColor: hexAlpha(singleColor, 0.08), borderWidth: 2.5, pointBackgroundColor: singleColor, pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: lineData.labels.length > 20 ? 3 : 5, pointHoverRadius: lineData.labels.length > 20 ? 7 : 9, fill: true, tension: 0.4 }] }, options: buildLineOptions(labelCol, yAxisLabel, lineData.labels.length) });
  }
  if (showPie) {
    const pieData = groupSmallSlices(labels, values, 10);
    const pieColors = pieData.labels.map((_, i) => PALETTE[i % PALETTE.length]);
    if (pieData.grouped) pieColors[pieColors.length - 1] = '#94a3b8';
    chartInstances.pie = new Chart($('pieChart'), { type: 'pie', data: { labels: pieData.labels, datasets: [{ data: pieData.values, backgroundColor: pieColors.map(c => hexAlpha(c, 0.88)), borderColor: '#fff', borderWidth: 2.5, hoverOffset: 14 }] }, options: buildPieOptions(yAxisLabel, pieData.grouped) });
  }
}

// ─── CHART OPTIONS ────────────────────────────────────────────────────────────
function buildBarOptions(labelCol, yAxisLabel) {
  return {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 700, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { title: (items) => items[0].label, label: (item) => { const total = item.dataset.data.reduce((a, b) => a + b, 0); const pct = total ? ((item.raw / total) * 100).toFixed(1) : 0; return ` ${yAxisLabel}: ${formatNumber(item.raw)}  (${pct}%)`; } } },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 30, font: { size: 12, weight: '500' }, color: '#64748b', autoSkip: false }, title: { display: true, text: labelCol, color: '#94a3b8', font: { size: 11, weight: '600' }, padding: { top: 8 } } },
      y: { beginAtZero: true, grid: { color: 'rgba(226,232,240,0.7)' }, border: { display: false, dash: [4, 4] }, ticks: { color: '#94a3b8', font: { size: 11 }, callback: (v) => formatNumber(v) }, title: { display: true, text: yAxisLabel, color: '#94a3b8', font: { size: 11, weight: '600' }, padding: { bottom: 8 } } },
    },
  };
}

function buildLineOptions(labelCol, yAxisLabel, dataCount) {
  return {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 900, easing: 'easeInOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (item) => ` ${yAxisLabel}: ${formatNumber(item.raw)}` } } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: dataCount > 20 ? 45 : 0, font: { size: dataCount > 20 ? 10 : 12 }, color: '#64748b', autoSkip: dataCount > 30, maxTicksLimit: dataCount > 30 ? 20 : undefined }, title: { display: true, text: labelCol, color: '#94a3b8', font: { size: 11, weight: '600' }, padding: { top: 8 } } },
      y: { beginAtZero: true, grid: { color: 'rgba(226,232,240,0.7)' }, border: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 }, callback: (v) => formatNumber(v) }, title: { display: true, text: yAxisLabel, color: '#94a3b8', font: { size: 11, weight: '600' }, padding: { bottom: 8 } } },
    },
  };
}

function buildPieOptions(valueCol, hasOther = false) {
  return {
    responsive: true, maintainAspectRatio: false, layout: { padding: 10 },
    animation: { animateRotate: true, animateScale: true, duration: 900, easing: 'easeOutQuart', delay: (ctx) => ctx.dataIndex * 40 },
    plugins: {
      legend: {
        position: 'right', align: 'center',
        labels: { boxWidth: 12, boxHeight: 12, padding: 14, font: { size: 12 }, color: '#475569', usePointStyle: true, pointStyle: 'circle',
          generateLabels: (chart) => {
            const data = chart.data;
            return data.labels.map((label, i) => {
              const ds = data.datasets[0];
              const total = ds.data.reduce((a, b) => a + b, 0);
              const pct   = total ? ((ds.data[i] / total) * 100).toFixed(1) : '0';
              const shortLabel = label.length > 24 ? label.slice(0, 22) + '…' : label;
              return { text: `${shortLabel}  ${pct}%`, fillStyle: ds.backgroundColor[i], strokeStyle: ds.borderColor, lineWidth: 0, hidden: false, index: i };
            });
          },
        },
      },
      tooltip: { callbacks: { label: (item) => { const total = item.dataset.data.reduce((a, b) => (a || 0) + (b || 0), 0); const pct = total ? ((item.raw / total) * 100).toFixed(1) : 0; return ` ${item.label}: ${formatNumber(item.raw)} (${pct}%)`; } } },
    },
  };
}

// ─── GROUP SMALL SLICES ───────────────────────────────────────────────────────
function groupSmallSlices(labels, values, maxItems = 10, minPct = 5) {
  const total = values.reduce((a, b) => a + b, 0);
  if (!total || !labels.length) return { labels: [...labels], values: [...values], grouped: false, groupedCount: 0 };
  const indexed = labels.map((l, i) => ({ label: l, value: values[i] }));
  indexed.sort((a, b) => b.value - a.value);
  const main = [], others = [];
  indexed.forEach((item, idx) => { const pct = (item.value / total) * 100; if (idx >= maxItems || (minPct > 0 && pct < minPct)) others.push(item); else main.push(item); });
  if (!main.length && others.length) main.push(others.shift());
  const otherTotal = others.reduce((a, b) => a + b.value, 0);
  const newLabels  = main.map(d => d.label);
  const newValues  = main.map(d => d.value);
  if (others.length) { newLabels.push(`Lainnya (${others.length})`); newValues.push(otherTotal); }
  return { labels: newLabels, values: newValues, grouped: others.length > 0, groupedCount: others.length };
}

// ─── RENDER STATS ─────────────────────────────────────────────────────────────
function renderStats(valCol, overrideValues = null) {
  const values = overrideValues
    ? overrideValues.filter(v => !isNaN(v))
    : parsedData.map(r => parseFloat(r[valCol])).filter(v => !isNaN(v));
  $('statRows').textContent = parsedData.length.toLocaleString('id-ID');
  $('statCols').textContent = columns.filter(c => c !== '_rowId').length;
  if (values.length > 0) {
    const max = Math.max(...values), min = Math.min(...values);
    const sum = values.reduce((a, b) => a + b, 0), avg = sum / values.length;
    $('statMax').textContent = formatNumber(max);
    $('statMin').textContent = formatNumber(min);
    $('statSum').textContent = formatNumber(sum);
    $('statAvg').textContent = formatNumber(avg);
  } else {
    [$('statMax'), $('statMin'), $('statSum'), $('statAvg')].forEach(el => el.textContent = '-');
  }
  document.querySelectorAll('.stat-card').forEach((card, i) => {
    card.classList.remove('animate-in'); void card.offsetWidth;
    card.style.animationDelay = `${i * 0.06}s`;
    card.classList.add('animate-in');
  });
}

// ─── TABLE ────────────────────────────────────────────────────────────────────
function updateDeleteSelectedBtn() {
  const btn = $('btnDeleteSelected');
  if (!btn) return;
  const count = selectedRowsSet.size;
  btn.textContent = `Hapus Terpilih (${count})`;
  if (isTableEditMode && count > 0) btn.classList.remove('hidden');
  else btn.classList.add('hidden');
}

function buildTableHead() {
  const tableHead = $('tableHead');
  const tr = document.createElement('tr');
  const visibleCols = columns.filter(c => c !== '_rowId');

  if (isTableEditMode) {
    const thSelect = document.createElement('th');
    thSelect.style.width = '40px'; thSelect.style.textAlign = 'center';
    const chkAll = document.createElement('input');
    chkAll.type = 'checkbox'; chkAll.id = 'selectAllRows'; chkAll.title = 'Pilih Semua Baris di Halaman Ini';
    const start    = (currentPage - 1) * PAGE_SIZE;
    const end      = Math.min(start + PAGE_SIZE, filteredData.length);
    const pageData = filteredData.slice(start, end);
    chkAll.checked = pageData.length > 0 && pageData.every(r => selectedRowsSet.has(r));
    chkAll.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      pageData.forEach(r => { if (isChecked) selectedRowsSet.add(r); else selectedRowsSet.delete(r); });
      renderTablePage(); updateDeleteSelectedBtn();
    });
    thSelect.appendChild(chkAll);
    tr.appendChild(thSelect);
  }

  visibleCols.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col; th.dataset.col = col;
    th.addEventListener('click', () => {
      if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else { sortCol = col; sortDir = 'asc'; }
      document.querySelectorAll('.data-table th').forEach(t => t.classList.remove('sorted-asc', 'sorted-desc'));
      th.classList.add(sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
      applyFilter();
    });
    tr.appendChild(th);
  });

  if (isTableEditMode) {
    const thAction = document.createElement('th');
    thAction.textContent = 'Aksi';
    tr.appendChild(thAction);
  }

  tableHead.innerHTML = '';
  tableHead.appendChild(tr);
}

function applyFilter() {
  let result = [...parsedData];
  if (searchQuery) {
    result = result.filter(row =>
      columns.filter(c => c !== '_rowId').some(col => String(row[col] ?? '').toLowerCase().includes(searchQuery))
    );
  }
  if (sortCol) {
    result.sort((a, b) => {
      const va = a[sortCol] ?? '', vb = b[sortCol] ?? '';
      const na = parseFloat(va), nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb)) return sortDir === 'asc' ? na - nb : nb - na;
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }
  filteredData = result;
  currentPage = 1;
  renderTablePage();
}

function renderTablePage() {
  const tableBody  = $('tableBody');
  const tableBadge = $('tableBadge');
  const dataTable  = $('dataTable');
  const visibleCols = columns.filter(c => c !== '_rowId');

  if (dataTable) dataTable.classList.toggle('edit-mode', isTableEditMode);

  const total   = filteredData.length;
  const maxPage = Math.ceil(total / PAGE_SIZE) || 1;
  if (currentPage > maxPage) currentPage = maxPage;
  const start    = (currentPage - 1) * PAGE_SIZE;
  const end      = Math.min(start + PAGE_SIZE, total);
  const pageData = filteredData.slice(start, end);

  tableBody.innerHTML = '';

  pageData.forEach(row => {
    const tr = document.createElement('tr');
    const parsedIdx = parsedData.indexOf(row);
    if (selectedRowsSet.has(row)) tr.classList.add('row-selected');

    if (isTableEditMode) {
      const tdSelect = document.createElement('td');
      tdSelect.style.textAlign = 'center';
      const chk = document.createElement('input');
      chk.type = 'checkbox'; chk.className = 'row-checkbox'; chk.checked = selectedRowsSet.has(row);
      chk.addEventListener('change', (e) => {
        if (e.target.checked) { selectedRowsSet.add(row); tr.classList.add('row-selected'); }
        else { selectedRowsSet.delete(row); tr.classList.remove('row-selected'); }
        updateDeleteSelectedBtn();
        const chkAll = $('selectAllRows');
        if (chkAll) chkAll.checked = pageData.length > 0 && pageData.every(r => selectedRowsSet.has(r));
      });
      tdSelect.appendChild(chk);
      tr.appendChild(tdSelect);
    }

    visibleCols.forEach(c => {
      const td  = document.createElement('td');
      const val = row[c] ?? '';
      if (isTableEditMode) {
        td.contentEditable = 'true';
        td.textContent = val;
        td.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); td.blur(); } });
        td.addEventListener('blur', async () => {
          const newText = td.textContent.trim();
          if (row[c] !== newText) {
            row[c] = newText;
            if (parsedIdx !== -1) parsedData[parsedIdx][c] = newText;
            onTableDataModified();
            showToast('Sel data diperbarui');
            // Sync to DB
            if (currentFile.id && row._rowId) {
              const rowData = {};
              visibleCols.forEach(col => { rowData[col] = parsedData[parsedIdx][col]; });
              try { await apiRequest('PUT', `/api/data/rows/${currentFile.id}/${row._rowId}`, { row_data: rowData }); }
              catch (err) { console.warn('[Cell edit sync]', err.message); }
            }
          }
        });
      } else {
        if (c === invCols.status && val) {
          const key = val.toLowerCase();
          td.innerHTML = `<span class="status-badge ${key}">${escapeHtml(val)}</span>`;
        } else {
          td.textContent = val;
        }
      }
      tr.appendChild(td);
    });

    if (isTableEditMode) {
      const tdAction = document.createElement('td');
      const btnDelete = document.createElement('button');
      btnDelete.className = 'btn-delete-row';
      btnDelete.textContent = 'Hapus';
      btnDelete.title = 'Hapus baris ini';
      btnDelete.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (parsedIdx !== -1) {
          const rowId = parsedData[parsedIdx]._rowId;
          parsedData.splice(parsedIdx, 1);
          onTableDataModified();
          applyFilter();
          showToast('Baris data dihapus');
          if (currentFile.id && rowId) {
            try { await apiRequest('DELETE', `/api/data/rows/${currentFile.id}`, { row_ids: [rowId] }); }
            catch (err) { console.warn('[Delete row]', err.message); }
          }
        }
      });
      tdAction.appendChild(btnDelete);
      tr.appendChild(tdAction);
    }

    tableBody.appendChild(tr);
  });

  if (tableBadge) tableBadge.textContent = searchQuery ? `${total} hasil dari ${parsedData.length} baris` : `${parsedData.length} baris`;
  $('paginationInfo').textContent = `Menampilkan ${total > 0 ? start + 1 : 0}–${end} dari ${total} entri`;
  $('btnPrevPage').disabled = currentPage <= 1;
  $('btnNextPage').disabled = currentPage >= maxPage;

  const pageNums = $('pageNums');
  pageNums.innerHTML = '';
  const range = buildPageRange(currentPage, maxPage);
  range.forEach(p => {
    const btn = document.createElement('button');
    btn.className = `page-num${p === currentPage ? ' active' : ''}`;
    btn.textContent = p; btn.disabled = p === currentPage;
    btn.addEventListener('click', () => { currentPage = p; renderTablePage(); });
    pageNums.appendChild(btn);
  });
}

function onTableDataModified() {
  reindexSequenceColumns();
  currentFile.rows = parsedData.length;
  $('headerStatus').textContent = `${parsedData.length.toLocaleString('id-ID')} baris · ${columns.filter(c => c !== '_rowId').length} kolom`;
  buildKPI();
  renderInventoryCharts();
  renderCustomCharts();
  buildFileInfo();
  renderInputForm();
}

function buildPageRange(cur, max) {
  if (max <= 7) return Array.from({ length: max }, (_, i) => i + 1);
  const range = new Set([1, max, cur]);
  for (let i = Math.max(1, cur - 2); i <= Math.min(max, cur + 2); i++) range.add(i);
  return [...range].sort((a, b) => a - b);
}

// ─── FILE INFO & COLUMN CHIPS ─────────────────────────────────────────────────
function buildFileInfo() {
  const visibleCols = columns.filter(c => c !== '_rowId');
  const rows = [
    { label: 'Nama File',    value: currentFile.name },
    { label: 'Total Baris',  value: parsedData.length.toLocaleString('id-ID') },
    { label: 'Total Kolom',  value: visibleCols.length },
  ];
  if (currentFile.size) rows.splice(1, 0, { label: 'Ukuran', value: formatBytes(currentFile.size) });
  $('fileInfoList').innerHTML = rows.map(r =>
    `<div class="file-info-row"><span class="file-info-label">${r.label}</span><span class="file-info-value">${escapeHtml(String(r.value))}</span></div>`
  ).join('');
}

function buildColumnChips() {
  const mapped = new Set(Object.values(invCols).filter(Boolean));
  const visibleCols = columns.filter(c => c !== '_rowId');
  $('columnChips').innerHTML = visibleCols.map(col =>
    `<span class="col-chip${mapped.has(col) ? ' mapped' : ''}">${escapeHtml(col)}</span>`
  ).join('');
}

// ─── SEQUENCE / NO COLUMN AUTO-REINDEXING ─────────────────────────────────────
function isSequenceColumn(colName) {
  if (!colName) return false;
  const clean = String(colName).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean === 'no' || clean === 'nomor' || clean === 'nourut' || clean === 'no_urut' || clean === 'id';
}

function reindexSequenceColumns() {
  if (!parsedData || !parsedData.length || !columns || !columns.length) return;
  const seqCols = columns.filter(c => c !== '_rowId' && isSequenceColumn(c));
  if (seqCols.length > 0) {
    parsedData.forEach((row, index) => { seqCols.forEach(col => { row[col] = index + 1; }); });
  }
}

// ─── EXPORT CSV ───────────────────────────────────────────────────────────────
function exportCSV() {
  const visibleCols = columns.filter(c => c !== '_rowId');
  const rows = [visibleCols.join(',')];
  filteredData.forEach(row => {
    rows.push(visibleCols.map(col => {
      const val = String(row[col] ?? '');
      return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(','));
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'export-inventaris.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('Data berhasil diekspor');
}

// ─── DOWNLOAD CHART ───────────────────────────────────────────────────────────
function downloadChart(canvasId, filename) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const exp = document.createElement('canvas');
  exp.width = canvas.width; exp.height = canvas.height;
  const ctx = exp.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, exp.width, exp.height);
  ctx.drawImage(canvas, 0, 0);
  const a = document.createElement('a');
  a.download = filename; a.href = exp.toDataURL('image/png'); a.click();
  showToast('Grafik berhasil diunduh');
}

// ─── RESET ────────────────────────────────────────────────────────────────────
function resetAll() {
  parsedData   = [];
  filteredData = [];
  columns      = [];
  currentFile  = { id: null, name: '', size: 0, rows: 0 };
  invCols      = { device: '', status: '', type: '', location: '', ip: '', vendor: '' };
  searchQuery  = '';
  sortCol      = null;

  destroyCharts('bar', 'line', 'pie', 'status', 'type', 'location');

  $('dashboard').classList.add('hidden');
  $('uploadSection').classList.remove('hidden');
  const chartsArea = $('chartsArea');
  if (chartsArea) chartsArea.classList.add('hidden');
  $('headerStatus').textContent = 'Belum ada data dimuat';
  $('btnHeaderReset').classList.add('hidden');
  $('dataFileInfo').textContent = '';
  $('tableSearch').value = '';
  const csvInput = $('csvInput');
  if (csvInput) csvInput.value = '';

  // Reset to first tab
  document.querySelectorAll('.tab').forEach((t, i) => { t.classList.toggle('active', i === 0); t.setAttribute('aria-selected', i === 0 ? 'true' : 'false'); });
  document.querySelectorAll('.tab-panel').forEach((p, i) => p.classList.toggle('hidden', i !== 0));

  isTableEditMode = false;
  selectedRowsSet.clear();
  updateDeleteSelectedBtn();
  const btnToggleEditTable = $('btnToggleEditTable');
  if (btnToggleEditTable) { btnToggleEditTable.classList.remove('active'); btnToggleEditTable.textContent = 'Edit Data'; }
  if ($('tableEditNotice')) $('tableEditNotice').classList.add('hidden');

  recentAdditions = [];
  if ($('inputFieldsGrid')) $('inputFieldsGrid').innerHTML = '';
  if ($('inputLogList'))    $('inputLogList').innerHTML = '';
  if ($('inputLogCount'))   $('inputLogCount').textContent = 'Belum ada data yang ditambahkan';
  if ($('inputDataForm'))   $('inputDataForm').reset();

  const fileSelector = $('fileSelector');
  if (fileSelector) fileSelector.value = '';
  const btnDeleteFile = $('btnDeleteFile');
  if (btnDeleteFile) btnDeleteFile.style.display = 'none';
  const bar = $('deleteConfirmBar');
  if (bar) bar.classList.add('hidden');
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function destroyCharts(...keys) {
  keys.forEach(key => { if (chartInstances[key]) { chartInstances[key].destroy(); chartInstances[key] = null; } });
}

function getFrequency(col) {
  const freq = {};
  parsedData.forEach(r => { const key = String(r[col] ?? '(kosong)').trim(); freq[key] = (freq[key] || 0) + 1; });
  return freq;
}

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '-';
  if (Number.isInteger(num)) return num.toLocaleString('id-ID');
  return parseFloat(num.toFixed(2)).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showLoading(text = 'Memproses...') {
  const el = $('loadingOverlay');
  const textEl = el.querySelector('.loading-text');
  if (textEl) textEl.textContent = text;
  el.classList.remove('hidden');
}

function hideLoading() {
  $('loadingOverlay').classList.add('hidden');
}

let toastTimer = null;
function showToast(msg, duration = 2800) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}
