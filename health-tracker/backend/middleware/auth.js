const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'health_tracker_dev_secret_change_in_production';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }
    req.user = decoded; // { id, email }
    next();
  });
}

module.exports = { authenticateToken, JWT_SECRET };
