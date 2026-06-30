const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// ---------- REGISTER ----------
router.post(
  '/register',
  [
    body('fullName').trim().notEmpty().withMessage('Full name is required'),
    body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone').trim().notEmpty().withMessage('Phone number is required')
      .matches(/^[0-9+\-\s()]{7,20}$/).withMessage('Enter a valid phone number'),
    body('dateOfBirth').optional({ checkFalsy: true }).trim(),
    body('gender').trim().notEmpty().withMessage('Gender is required')
      .isIn(['Female', 'Male', 'Other', 'Prefer not to say']).withMessage('Select a valid gender'),
    body('bloodGroup').optional({ checkFalsy: true }).trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    }

    const { fullName, email, password, phone, dateOfBirth, gender, bloodGroup } = req.body;

    try {
      db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
        if (err) return res.status(500).json({ message: 'Database error', error: err.message });
        if (row) return res.status(409).json({ message: 'An account with this email already exists.' });

        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
          `INSERT INTO users (full_name, email, password, phone, date_of_birth, gender, blood_group)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [fullName, email, hashedPassword, phone || null, dateOfBirth || null, gender || null, bloodGroup || null],
          function (insertErr) {
            if (insertErr) {
              return res.status(500).json({ message: 'Failed to create account', error: insertErr.message });
            }

            const userId = this.lastID;
            const token = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '7d' });

            return res.status(201).json({
              message: 'Account created successfully',
              token,
              user: { id: userId, fullName, email, phone, dateOfBirth, gender, bloodGroup },
            });
          }
        );
      });
    } catch (e) {
      res.status(500).json({ message: 'Server error', error: e.message });
    }
  }
);

// ---------- LOGIN ----------
router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err.message });
      if (!user) return res.status(401).json({ message: 'Invalid email or password' });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          phone: user.phone,
          dateOfBirth: user.date_of_birth,
          gender: user.gender,
          bloodGroup: user.blood_group,
        },
      });
    });
  }
);

// ---------- GET PROFILE ----------
router.get('/profile', authenticateToken, (req, res) => {
  db.get(
    'SELECT id, full_name, email, phone, date_of_birth, gender, blood_group, created_at FROM users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err.message });
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json({
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        dateOfBirth: user.date_of_birth,
        gender: user.gender,
        bloodGroup: user.blood_group,
        createdAt: user.created_at,
      });
    }
  );
});

// ---------- UPDATE PROFILE ----------
router.put('/profile', authenticateToken, (req, res) => {
  const { fullName, phone, dateOfBirth, gender, bloodGroup } = req.body;

  db.run(
    `UPDATE users SET full_name = ?, phone = ?, date_of_birth = ?, gender = ?, blood_group = ? WHERE id = ?`,
    [fullName, phone || null, dateOfBirth || null, gender || null, bloodGroup || null, req.user.id],
    function (err) {
      if (err) return res.status(500).json({ message: 'Database error', error: err.message });
      res.json({ message: 'Profile updated successfully' });
    }
  );
});

module.exports = router;
