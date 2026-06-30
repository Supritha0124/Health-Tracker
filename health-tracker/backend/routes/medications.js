const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// CREATE
router.post('/', authenticateToken, (req, res) => {
  const { medicineName, dosage, frequency, startDate, endDate, notes } = req.body;

  if (!medicineName) {
    return res.status(400).json({ message: 'Medicine name is required' });
  }

  db.run(
    `INSERT INTO medications (user_id, medicine_name, dosage, frequency, start_date, end_date, notes, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, medicineName, dosage || null, frequency || null, startDate || null, endDate || null, notes || null, 1],
    function (err) {
      if (err) return res.status(500).json({ message: 'Failed to add medication', error: err.message });
      res.status(201).json({ message: 'Medication added successfully', id: this.lastID });
    }
  );
});

// READ ALL
router.get('/', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM medications WHERE user_id = ? ORDER BY active DESC, created_at DESC',
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err.message });
      res.json(rows);
    }
  );
});

// UPDATE (e.g. toggle active, edit details)
router.put('/:id', authenticateToken, (req, res) => {
  const { medicineName, dosage, frequency, startDate, endDate, notes, active } = req.body;

  db.get('SELECT * FROM medications WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, med) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    if (!med) return res.status(404).json({ message: 'Medication not found' });

    db.run(
      `UPDATE medications SET medicine_name=?, dosage=?, frequency=?, start_date=?, end_date=?, notes=?, active=?
       WHERE id=?`,
      [
        medicineName || med.medicine_name,
        dosage !== undefined ? dosage : med.dosage,
        frequency !== undefined ? frequency : med.frequency,
        startDate !== undefined ? startDate : med.start_date,
        endDate !== undefined ? endDate : med.end_date,
        notes !== undefined ? notes : med.notes,
        active !== undefined ? (active ? 1 : 0) : med.active,
        req.params.id,
      ],
      (updateErr) => {
        if (updateErr) return res.status(500).json({ message: 'Failed to update medication', error: updateErr.message });
        res.json({ message: 'Medication updated successfully' });
      }
    );
  });
});

// DELETE
router.delete('/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM medications WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function (err) {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    if (this.changes === 0) return res.status(404).json({ message: 'Medication not found' });
    res.json({ message: 'Medication deleted successfully' });
  });
});

module.exports = router;
