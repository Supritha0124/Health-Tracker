const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// CREATE
router.post('/', authenticateToken, (req, res) => {
  const { doctorName, specialization, appointmentDate, appointmentTime, location, notes } = req.body;

  if (!doctorName || !appointmentDate) {
    return res.status(400).json({ message: 'Doctor name and appointment date are required' });
  }

  db.run(
    `INSERT INTO appointments (user_id, doctor_name, specialization, appointment_date, appointment_time, location, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, doctorName, specialization || null, appointmentDate, appointmentTime || null, location || null, notes || null, 'scheduled'],
    function (err) {
      if (err) return res.status(500).json({ message: 'Failed to create appointment', error: err.message });
      res.status(201).json({ message: 'Appointment scheduled successfully', id: this.lastID });
    }
  );
});

// READ ALL
router.get('/', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM appointments WHERE user_id = ? ORDER BY appointment_date ASC, appointment_time ASC',
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err.message });
      res.json(rows);
    }
  );
});

// UPDATE STATUS / DETAILS
router.put('/:id', authenticateToken, (req, res) => {
  const { doctorName, specialization, appointmentDate, appointmentTime, location, notes, status } = req.body;

  db.get('SELECT * FROM appointments WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, appt) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });

    db.run(
      `UPDATE appointments SET doctor_name=?, specialization=?, appointment_date=?, appointment_time=?, location=?, notes=?, status=?
       WHERE id=?`,
      [
        doctorName || appt.doctor_name,
        specialization !== undefined ? specialization : appt.specialization,
        appointmentDate || appt.appointment_date,
        appointmentTime !== undefined ? appointmentTime : appt.appointment_time,
        location !== undefined ? location : appt.location,
        notes !== undefined ? notes : appt.notes,
        status || appt.status,
        req.params.id,
      ],
      (updateErr) => {
        if (updateErr) return res.status(500).json({ message: 'Failed to update appointment', error: updateErr.message });
        res.json({ message: 'Appointment updated successfully' });
      }
    );
  });
});

// DELETE
router.delete('/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM appointments WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function (err) {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });
    if (this.changes === 0) return res.status(404).json({ message: 'Appointment not found' });
    res.json({ message: 'Appointment deleted successfully' });
  });
});

module.exports = router;
