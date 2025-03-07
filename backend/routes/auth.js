const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication operations
 */

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstname
 *               - lastname
 *               - email
 *               - gender
 *               - password
 *             properties:
 *               firstname:
 *                 type: string
 *                 description: The user's first name
 *               lastname:
 *                 type: string
 *                 description: The user's last name
 *               email:
 *                 type: string
 *                 description: The user's email address
 *               gender:
 *                 type: string
 *                 description: The user's gender
 *               password:
 *                 type: string
 *                 description: The user's password
 *               isApiUser:
 *                 type: boolean
 *                 description: Whether the user is an API user
 *                 example: false
 *     responses:
 *       201:
 *         description: User registered successfully
 *       500:
 *         description: Database error
 *       400:
 *         description: Missing required fields
 */
// Sign-Up Route
router.post('/signup', async (req, res) => {
    const { firstname, lastname, email, gender, password, isApiUser } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 8);
        const sql = 'INSERT INTO tbl_user (FirstName, LastName, Email, Gender, Password, IsApiUser) VALUES (?, ?, ?, ?, ?, ?)';
        db.query(sql, [firstname, lastname, email, gender, hashedPassword, isApiUser || false], (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Database error');
            }
            res.status(201).send('User registered!');
        });
    } catch (error) {
        console.error('Error during registration', error);
        res.status(500).send('An error occurred during registration.');
    }
});

/**
 * @swagger
 * /api/auth/signin:
 *   post:
 *     summary: Log in a user and return a JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 description: The user's email address
 *               password:
 *                 type: string
 *                 description: The user's password
 *     responses:
 *       200:
 *         description: Successful login, returns a JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: The generated JWT token
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Database error
 */
// Login Route
router.post('/signin', (req, res) => {
    const { email, password } = req.body;

    const sql = 'SELECT * FROM tbl_user WHERE Email = ?';
    db.query(sql, [email], async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Database error');
        }
        if (!results.length || !(await bcrypt.compare(password, results[0].Password))) {
            return res.status(401).send('Invalid credentials!');
        }

        const token = jwt.sign({ id: results[0].UserID }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    });
});

module.exports = router;
