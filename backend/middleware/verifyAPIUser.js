const jwt = require('jsonwebtoken');
const db = require('../config/db');

module.exports = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).send('Token required.');

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).send('Invalid or expired token.');

        const sql = 'SELECT IsApiUser FROM tbl_user WHERE UserID = ?';
        db.query(sql, [decoded.id], (dbErr, results) => {
            if (dbErr || results.length === 0 || !results[0].IsApiUser) {
                return res.status(403).send('Access denied.');
            }
            req.user = decoded;
            next();
        });
    });
};
