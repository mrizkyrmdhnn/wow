'use strict';

const express    = require('express');
const path       = require('path');
const fs         = require('fs');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const multer     = require('multer');
const db         = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── KONFIGURASI ──────────────────────────────────────────────────────────────
const JWT_SECRET  = process.env.JWT_SECRET  || 'pengvisualisasi_datamu_secret_2024_!@#';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// ─── MULTER (Upload File) ─────────────────────────────────────────────────────
const storage = multer.memoryStorage(); // Simpan di memori, parse di server
const upload  = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Hanya file .csv, .xlsx, atau .xls yang diizinkan'));
  },
});

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── MIDDLEWARE: JWT AUTENTIKASI ──────────────────────────────────────────────
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
  if (!token) return res.status(401).json({ error: 'Token tidak ditemukan. Silakan login.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token tidak valid atau sudah expired. Silakan login ulang.' });
  }
}

// ─── HELPER: Parse CSV dari Buffer ────────────────────────────────────────────
function parseCSVBuffer(buffer) {
  const text = buffer.toString('utf-8');
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return { cols: [], data: [] };

  const splitLine = (line) => {
    const result = [];
    let cur = '', inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  };

  const header = splitLine(lines[0]);
  const cols = header.map((h, i) => String(h || '').trim() || `Kolom_${i + 1}`);
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = splitLine(line);
    const row = {};
    cols.forEach((col, idx) => { row[col] = (values[idx] || '').trim(); });
    data.push(row);
  }

  return { cols, data };
}

// ─── HELPER: Parse XLSX dari Buffer ──────────────────────────────────────────
function parseXLSXBuffer(buffer) {
  // Dynamically require xlsx only when needed
  const XLSX = require('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
  if (!workbook.SheetNames.length) throw new Error('Tidak ada sheet dalam file');

  let sheet = null;
  for (const name of workbook.SheetNames) {
    if (workbook.Sheets[name] && workbook.Sheets[name]['!ref']) {
      sheet = workbook.Sheets[name];
      break;
    }
  }
  if (!sheet) throw new Error('Semua sheet kosong');

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  if (!rows.length) return { cols: [], data: [] };

  const rawHeaders = rows[0];
  const cols = rawHeaders.map((h, i) => (String(h || '').trim() || `Kolom_${i + 1}`));
  const data = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c === '' || c == null)) continue;
    const obj = {};
    cols.forEach((col, idx) => {
      const val = row[idx];
      if (val == null || val === '') obj[col] = '';
      else if (val instanceof Date) obj[col] = val.toISOString().slice(0, 10);
      else obj[col] = String(val).trim();
    });
    data.push(obj);
  }

  return { cols, data };
}

// ─── HELPER: Catat Aktivitas ke activity_log ──────────────────────────────────
function logActivity({ userId, fileId, fileName, actionType, description, rowsAffected = 0, rowsSkipped = 0 }) {
  try {
    db.prepare(
      `INSERT INTO activity_log (user_id, file_id, file_name, action_type, description, rows_affected, rows_skipped)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, fileId || null, fileName, actionType, description, rowsAffected, rowsSkipped);
  } catch (err) {
    console.warn('[logActivity] Gagal mencatat aktivitas:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API ROUTES: AUTENTIKASI
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username minimal 3 karakter.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR (email IS NOT NULL AND email = ?)').get(username, email || null);
  if (existing) {
    return res.status(409).json({ error: 'Username atau email sudah digunakan.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  try {
    const stmt = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)');
    const result = stmt.run(username, email || null, passwordHash);
    const userId = result.lastInsertRowid;

    const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    return res.status(201).json({
      message: 'Registrasi berhasil! Selamat datang.',
      token,
      user: { id: userId, username, email: email || null },
    });
  } catch (err) {
    console.error('[Register Error]', err);
    return res.status(500).json({ error: 'Gagal mendaftar. Coba lagi.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  return res.json({
    message: `Selamat datang, ${user.username}!`,
    token,
    user: { id: user.id, username: user.username, email: user.email },
  });
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
  return res.json({ user });
});

// ─────────────────────────────────────────────────────────────────────────────
// API ROUTES: DATA (FILE & ROWS)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/data/files — daftar semua file milik user
app.get('/api/data/files', requireAuth, (req, res) => {
  const files = db.prepare(
    'SELECT id, file_name, original_name, column_names, inv_config, row_count, created_at, updated_at FROM data_files WHERE user_id = ? ORDER BY updated_at DESC'
  ).all(req.user.userId);

  const parsed = files.map(f => ({
    ...f,
    column_names: JSON.parse(f.column_names),
    inv_config:   JSON.parse(f.inv_config || '{}'),
  }));

  return res.json({ files: parsed });
});

// POST /api/data/upload — upload file baru
app.post('/api/data/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan dalam request.' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  let cols, data;

  try {
    if (ext === '.csv') {
      ({ cols, data } = parseCSVBuffer(req.file.buffer));
    } else {
      ({ cols, data } = parseXLSXBuffer(req.file.buffer));
    }
  } catch (err) {
    return res.status(422).json({ error: `Gagal memproses file: ${err.message}` });
  }

  if (!data.length) return res.status(422).json({ error: 'File kosong atau formatnya tidak didukung.' });

  // Simpan metadata file
  const insertFile = db.prepare(
    'INSERT INTO data_files (user_id, file_name, original_name, column_names, row_count) VALUES (?, ?, ?, ?, ?)'
  );
  const fileResult = insertFile.run(
    req.user.userId,
    req.file.originalname,
    req.file.originalname,
    JSON.stringify(cols),
    data.length
  );
  const fileId = fileResult.lastInsertRowid;

  // Simpan semua baris sekaligus dalam satu transaksi
  const insertRow = db.prepare('INSERT INTO data_rows (file_id, row_index, row_data) VALUES (?, ?, ?)');
  const insertMany = db.transaction((rows) => {
    rows.forEach((row, idx) => {
      insertRow.run(fileId, idx, JSON.stringify(row));
    });
  });
  insertMany(data);

  // Catat aktivitas upload
  logActivity({
    userId:       req.user.userId,
    fileId:       fileId,
    fileName:     req.file.originalname,
    actionType:   'upload',
    description:  `Unggah file baru: ${cols.length} kolom`,
    rowsAffected: data.length,
    rowsSkipped:  0,
  });

  return res.status(201).json({
    message: `File berhasil diunggah: ${data.length} baris, ${cols.length} kolom`,
    file: {
      id: fileId,
      file_name: req.file.originalname,
      column_names: cols,
      row_count: data.length,
    },
  });
});

// GET /api/data/rows/:fileId — ambil semua baris data file tertentu
app.get('/api/data/rows/:fileId', requireAuth, (req, res) => {
  const fileId = parseInt(req.params.fileId);

  // Pastikan file milik user ini
  const file = db.prepare('SELECT * FROM data_files WHERE id = ? AND user_id = ?').get(fileId, req.user.userId);
  if (!file) return res.status(404).json({ error: 'File tidak ditemukan.' });

  const rows = db.prepare('SELECT id, row_index, row_data FROM data_rows WHERE file_id = ? ORDER BY row_index ASC').all(fileId);
  const parsedRows = rows.map(r => ({ _rowId: r.id, ...JSON.parse(r.row_data) }));

  return res.json({
    file: {
      ...file,
      column_names: JSON.parse(file.column_names),
      inv_config:   JSON.parse(file.inv_config || '{}'),
    },
    rows: parsedRows,
    total: parsedRows.length,
  });
});

// POST /api/data/rows/:fileId — tambah satu baris baru
app.post('/api/data/rows/:fileId', requireAuth, (req, res) => {
  const fileId = parseInt(req.params.fileId);
  const file = db.prepare('SELECT * FROM data_files WHERE id = ? AND user_id = ?').get(fileId, req.user.userId);
  if (!file) return res.status(404).json({ error: 'File tidak ditemukan.' });

  const { row_data } = req.body;
  if (!row_data) return res.status(400).json({ error: 'Data baris tidak boleh kosong.' });

  const currentMax = db.prepare('SELECT COALESCE(MAX(row_index), -1) as maxIdx FROM data_rows WHERE file_id = ?').get(fileId);
  const nextIdx = (currentMax.maxIdx || 0) + 1;

  const result = db.prepare('INSERT INTO data_rows (file_id, row_index, row_data) VALUES (?, ?, ?)').run(fileId, nextIdx, JSON.stringify(row_data));

  // Update row_count
  db.prepare('UPDATE data_files SET row_count = row_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(fileId);

  // Catat aktivitas tambah baris manual
  const previewVal = Object.values(row_data).filter(v => v !== '' && v != null).slice(0, 2).join(', ') || '(data baru)';
  logActivity({
    userId:       req.user.userId,
    fileId:       fileId,
    fileName:     file.file_name,
    actionType:   'add_row',
    description:  `Tambah manual: ${previewVal}`,
    rowsAffected: 1,
    rowsSkipped:  0,
  });

  return res.status(201).json({ message: 'Baris berhasil ditambahkan.', rowId: result.lastInsertRowid });
});

// PUT /api/data/rows/:fileId/:rowId — edit satu baris
app.put('/api/data/rows/:fileId/:rowId', requireAuth, (req, res) => {
  const fileId = parseInt(req.params.fileId);
  const rowId  = parseInt(req.params.rowId);

  const file = db.prepare('SELECT id FROM data_files WHERE id = ? AND user_id = ?').get(fileId, req.user.userId);
  if (!file) return res.status(404).json({ error: 'File tidak ditemukan.' });

  const { row_data } = req.body;
  if (!row_data) return res.status(400).json({ error: 'Data baris tidak boleh kosong.' });

  db.prepare('UPDATE data_rows SET row_data = ? WHERE id = ? AND file_id = ?').run(JSON.stringify(row_data), rowId, fileId);
  db.prepare('UPDATE data_files SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(fileId);

  return res.json({ message: 'Baris berhasil diperbarui.' });
});

// DELETE /api/data/rows/:fileId — hapus baris-baris terpilih (rowIds sebagai JSON array di body)
app.delete('/api/data/rows/:fileId', requireAuth, (req, res) => {
  const fileId = parseInt(req.params.fileId);
  const file = db.prepare('SELECT id FROM data_files WHERE id = ? AND user_id = ?').get(fileId, req.user.userId);
  if (!file) return res.status(404).json({ error: 'File tidak ditemukan.' });

  const { row_ids } = req.body;
  if (!Array.isArray(row_ids) || !row_ids.length) return res.status(400).json({ error: 'row_ids harus berupa array.' });

  const deleteStmt = db.prepare('DELETE FROM data_rows WHERE id = ? AND file_id = ?');
  const deleteMany = db.transaction((ids) => {
    ids.forEach(id => deleteStmt.run(id, fileId));
  });
  deleteMany(row_ids);

  // Update row_count
  const cnt = db.prepare('SELECT COUNT(*) as c FROM data_rows WHERE file_id = ?').get(fileId);
  db.prepare('UPDATE data_files SET row_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(cnt.c, fileId);

  return res.json({ message: `${row_ids.length} baris berhasil dihapus.` });
});

// POST /api/data/import/:fileId — import/merge file baru ke dataset yang sudah ada
// mode: "append" (gabung) | "replace" (timpa)
// skip_duplicates: "true" (default) | "false"
app.post('/api/data/import/:fileId', requireAuth, upload.single('file'), (req, res) => {
  const fileId        = parseInt(req.params.fileId);
  const mode          = req.body.mode || 'append';
  const skipDuplicates = req.body.skip_duplicates !== 'false'; // default: true

  const file = db.prepare('SELECT * FROM data_files WHERE id = ? AND user_id = ?').get(fileId, req.user.userId);
  if (!file) return res.status(404).json({ error: 'File tidak ditemukan.' });
  if (!req.file) return res.status(400).json({ error: 'File import tidak ditemukan.' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  let cols, data;

  try {
    if (ext === '.csv') {
      ({ cols, data } = parseCSVBuffer(req.file.buffer));
    } else {
      ({ cols, data } = parseXLSXBuffer(req.file.buffer));
    }
  } catch (err) {
    return res.status(422).json({ error: `Gagal memproses file: ${err.message}` });
  }

  if (!data.length) return res.status(422).json({ error: 'File import kosong.' });

  const existingCols = JSON.parse(file.column_names);

  // Gabungkan kolom (union) jika ada kolom baru
  const allCols = [...new Set([...existingCols, ...cols])];

  // Normalisasi data import agar sesuai dengan skema kolom
  const normalizedData = data.map(row => {
    const normalized = {};
    allCols.forEach(col => { normalized[col] = row[col] !== undefined ? String(row[col]).trim() : ''; });
    return normalized;
  });

  // Helper: buat fingerprint unik dari sebuah baris (semua nilai kolom digabung)
  const makeFingerprint = (rowObj) =>
    allCols.map(col => String(rowObj[col] ?? '')).join('\x00');

  const importAndUpdate = db.transaction(() => {
    let insertedCount = 0;
    let skippedCount  = 0;

    if (mode === 'replace') {
      // Hapus semua baris lama, lalu insert semua baris baru
      db.prepare('DELETE FROM data_rows WHERE file_id = ?').run(fileId);
      const insertRow = db.prepare('INSERT INTO data_rows (file_id, row_index, row_data) VALUES (?, ?, ?)');
      normalizedData.forEach((row, i) => {
        insertRow.run(fileId, i, JSON.stringify(row));
        insertedCount++;
      });
    } else {
      // ── APPEND MODE ──────────────────────────────────────────────────────────
      // Bangun set fingerprint dari baris yang sudah ada di database
      const existingFingerprints = new Set();
      if (skipDuplicates) {
        const existingRows = db.prepare('SELECT row_data FROM data_rows WHERE file_id = ?').all(fileId);
        existingRows.forEach(r => {
          try {
            const obj = JSON.parse(r.row_data);
            // Normalisasi kolom ke allCols untuk konsistensi
            const normalized = {};
            allCols.forEach(col => { normalized[col] = String(obj[col] ?? '').trim(); });
            existingFingerprints.add(makeFingerprint(normalized));
          } catch (_) { /* baris corrupt, abaikan */ }
        });
      }

      // Tentukan row_index awal
      const maxIdx = db.prepare('SELECT COALESCE(MAX(row_index), -1) as m FROM data_rows WHERE file_id = ?').get(fileId);
      let nextIdx = (maxIdx.m ?? 0) + 1;

      const insertRow = db.prepare('INSERT INTO data_rows (file_id, row_index, row_data) VALUES (?, ?, ?)');

      normalizedData.forEach(row => {
        if (skipDuplicates) {
          const fp = makeFingerprint(row);
          if (existingFingerprints.has(fp)) {
            skippedCount++;
            return; // lewati baris duplikat
          }
          existingFingerprints.add(fp); // cegah duplikat dalam file yang sama
        }
        insertRow.run(fileId, nextIdx, JSON.stringify(row));
        nextIdx++;
        insertedCount++;
      });
    }

    // Update metadata file
    const newCount = db.prepare('SELECT COUNT(*) as c FROM data_rows WHERE file_id = ?').get(fileId).c;
    db.prepare(
      'UPDATE data_files SET column_names = ?, row_count = ?, file_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(JSON.stringify(allCols), newCount, req.file.originalname, fileId);

    return { insertedCount, skippedCount };
  });

  const stats = importAndUpdate();

  // Susun pesan respons
  let message;
  if (mode === 'replace') {
    message = `Data berhasil diganti dengan ${stats.insertedCount} baris dari file "${req.file.originalname}".`;
  } else {
    if (stats.insertedCount === 0 && stats.skippedCount > 0) {
      message = `Semua ${stats.skippedCount} baris sudah ada di dataset (tidak ada data baru).`;
    } else {
      message = `${stats.insertedCount} baris berhasil ditambahkan dari "${req.file.originalname}".`;
      if (stats.skippedCount > 0) {
        message += ` ${stats.skippedCount} baris duplikat dilewati.`;
      }
    }
  }

  const updatedFile = db.prepare('SELECT * FROM data_files WHERE id = ?').get(fileId);

  // Catat aktivitas import
  logActivity({
    userId:       req.user.userId,
    fileId:       fileId,
    fileName:     req.file.originalname,
    actionType:   mode === 'replace' ? 'import_replace' : 'import_append',
    description:  message,
    rowsAffected: stats.insertedCount,
    rowsSkipped:  stats.skippedCount,
  });

  return res.json({
    message,
    inserted: stats.insertedCount,
    skipped:  stats.skippedCount,
    file: {
      ...updatedFile,
      column_names: JSON.parse(updatedFile.column_names),
      inv_config:   JSON.parse(updatedFile.inv_config || '{}'),
    },
  });
});

// PUT /api/data/config/:fileId — simpan konfigurasi kolom inventaris
app.put('/api/data/config/:fileId', requireAuth, (req, res) => {
  const fileId = parseInt(req.params.fileId);
  const file = db.prepare('SELECT id FROM data_files WHERE id = ? AND user_id = ?').get(fileId, req.user.userId);
  if (!file) return res.status(404).json({ error: 'File tidak ditemukan.' });

  const { inv_config } = req.body;
  db.prepare('UPDATE data_files SET inv_config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    JSON.stringify(inv_config || {}), fileId
  );

  return res.json({ message: 'Konfigurasi berhasil disimpan.' });
});

// DELETE /api/data/files/:fileId — hapus seluruh file dataset
app.delete('/api/data/files/:fileId', requireAuth, (req, res) => {
  const fileId = parseInt(req.params.fileId);
  const file = db.prepare('SELECT id FROM data_files WHERE id = ? AND user_id = ?').get(fileId, req.user.userId);
  if (!file) return res.status(404).json({ error: 'File tidak ditemukan.' });

  db.prepare('DELETE FROM data_files WHERE id = ?').run(fileId);
  return res.json({ message: 'Dataset berhasil dihapus.' });
});

// GET /api/activity — ambil riwayat inputan user (maks 200 entri)
app.get('/api/activity', requireAuth, (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  || '200'), 200);
  const offset = parseInt(req.query.offset || '0');

  const logs = db.prepare(`
    SELECT
      al.id,
      al.file_id,
      al.file_name,
      al.action_type,
      al.description,
      al.rows_affected,
      al.rows_skipped,
      al.created_at,
      df.file_name AS current_file_name
    FROM activity_log al
    LEFT JOIN data_files df ON df.id = al.file_id
    WHERE al.user_id = ?
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.user.userId, limit, offset);

  const total = db.prepare('SELECT COUNT(*) as c FROM activity_log WHERE user_id = ?').get(req.user.userId).c;

  return res.json({ logs, total, limit, offset });
});

// ─────────────────────────────────────────────────────────────────────────────
// SERVE STATIC FILES (Frontend)
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname), {
  index: 'index.html',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js'))  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
  },
}));

// Fallback: semua route non-API ke index.html
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Ukuran file terlalu besar (maks 50MB).' });
  }
  return res.status(500).json({ error: err.message || 'Terjadi kesalahan server.' });
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════╗`);
  console.log(`║    Pengvisualisasi Datamu v2.0        ║`);
  console.log(`╠═══════════════════════════════════════╣`);
  console.log(`║  Server  : http://localhost:${PORT}       ║`);
  console.log(`║  Database: Pengvisualisasi Datamu.sqlite ║`);
  console.log(`╚═══════════════════════════════════════╝\n`);
});
