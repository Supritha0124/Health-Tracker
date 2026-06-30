const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Simple admin check - in production use a proper role-based system
function requireAdmin(req, res, next) {
  db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, row) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    if (!row || row.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  });
}

// GET system-wide stats (admin only)
router.get('/stats', authenticateToken, requireAdmin, (req, res) => {
  const stats = {};
  db.get('SELECT COUNT(*) as count FROM users', [], (e1, r1) => {
    stats.totalUsers = r1 ? r1.count : 0;
    db.get('SELECT COUNT(*) as count FROM medical_records', [], (e2, r2) => {
      stats.totalRecords = r2 ? r2.count : 0;
      db.get('SELECT COUNT(*) as count FROM appointments', [], (e3, r3) => {
        stats.totalAppointments = r3 ? r3.count : 0;
        db.get('SELECT COUNT(*) as count FROM medications', [], (e4, r4) => {
          stats.totalMedications = r4 ? r4.count : 0;
          res.json(stats);
        });
      });
    });
  });
});

// GET all users (admin only)
router.get('/users', authenticateToken, requireAdmin, (req, res) => {
  db.all('SELECT id, full_name, email, phone, role, created_at FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    res.json(rows);
  });
});

module.exports = router;
