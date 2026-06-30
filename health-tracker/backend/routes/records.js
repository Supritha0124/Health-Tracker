const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const MAX_FILES_PER_RECORD = 10;

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, image, and Word files are allowed'));
  },
});

// ---------- CREATE / UPLOAD RECORD (up to 10 files) ----------
router.post('/', authenticateToken, upload.array('files', MAX_FILES_PER_RECORD), (req, res) => {
  const { title, recordType, description, recordDate } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Record title is required' });
  }

  const files = (req.files || []).map((f) => ({
    fileName: f.originalname,
    filePath: f.filename,
  }));

  db.run(
    `INSERT INTO medical_records (user_id, title, record_type, description, files, record_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [req.user.id, title, recordType || null, description || null, files, recordDate || null],
    function (err) {
      if (err) return res.status(500).json({ message: 'Failed to save record', error: err.message });
      res.status(201).json({ message: 'Medical record added successfully', id: this.lastID });
    }
  );
});

// ---------- GET ALL RECORDS FOR USER ----------
router.get('/', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM medical_records WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err.message });
      res.json(rows);
    }
  );
});

// ---------- DOWNLOAD A RECORD FILE (by index, defaults to first file) ----------
router.get('/:id/file/:fileIndex?', authenticateToken, (req, res) => {
  db.get(
    'SELECT * FROM medical_records WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    (err, record) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err.message });
      const files = (record && record.files) || [];
      const idx = req.params.fileIndex ? parseInt(req.params.fileIndex, 10) : 0;
      const file = files[idx];
      if (!record || !file) return res.status(404).json({ message: 'File not found' });
      const fullPath = path.join(uploadDir, file.filePath);
      res.download(fullPath, file.fileName);
    }
  );
});

// ---------- DELETE A RECORD ----------
router.delete('/:id', authenticateToken, (req, res) => {
  db.get(
    'SELECT * FROM medical_records WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    (err, record) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err.message });
      if (!record) return res.status(404).json({ message: 'Record not found' });

      if (record.files && record.files.length) {
        record.files.forEach((f) => {
          const fullPath = path.join(uploadDir, f.filePath);
          fs.unlink(fullPath, () => {});
        });
      }

      db.run('DELETE FROM medical_records WHERE id = ?', [req.params.id], (delErr) => {
        if (delErr) return res.status(500).json({ message: 'Failed to delete record', error: delErr.message });
        res.json({ message: 'Record deleted successfully' });
      });
    }
  );
});

// ---------- CREATE SHARE LINK ----------
router.post('/:id/share', authenticateToken, (req, res) => {
  const { doctorEmail, expiresInDays } = req.body;

  db.get(
    'SELECT * FROM medical_records WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    (err, record) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err.message });
      if (!record) return res.status(404).json({ message: 'Record not found' });

      const token = crypto.randomBytes(16).toString('hex');
      const days = expiresInDays ? parseInt(expiresInDays, 10) : 7;
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      db.run(
        `INSERT INTO shared_links (user_id, record_id, share_token, doctor_email, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, req.params.id, token, doctorEmail || null, expiresAt],
        function (insertErr) {
          if (insertErr) return res.status(500).json({ message: 'Failed to create share link', error: insertErr.message });
          res.status(201).json({
            message: 'Share link created',
            shareToken: token,
            expiresAt,
            shareUrl: `/api/records/shared/${token}`,
          });
        }
      );
    }
  );
});

// ---------- VIEW SHARED RECORD (PUBLIC, NO AUTH) ----------
router.get('/shared/:token', (req, res) => {
  db.get(
    `SELECT sl.*, mr.title, mr.record_type, mr.description, mr.files, mr.record_date
     FROM shared_links sl JOIN medical_records mr ON sl.record_id = mr.id
     WHERE sl.share_token = ?`,
    [req.params.token],
    (err, row) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err.message });
      if (!row) return res.status(404).json({ message: 'Shared record not found' });
      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        return res.status(410).json({ message: 'This share link has expired' });
      }
      res.json({
        title: row.title,
        recordType: row.record_type,
        description: row.description,
        fileNames: (row.files || []).map((f) => f.fileName),
        recordDate: row.record_date,
      });
    }
  );
});

module.exports = router;
