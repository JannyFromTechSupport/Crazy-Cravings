const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const verifyApiUser = require('../middleware/verifyAPIUser');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Operations related to user data
 */

/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     summary: Get the profile information of the logged-in user
 *     security:
 *       - bearerAuth: [] 
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: The user's profile information and their recipes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 FirstName:
 *                   type: string
 *                 LastName:
 *                   type: string
 *                 Email:
 *                   type: string
 *                 recipes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       RecipeID:
 *                         type: integer
 *                       Title:
 *                         type: string
 *                       Description:
 *                         type: string
 *                       ImageURL:
 *                         type: string
 *                       Category:
 *                         type: string
 *                       ingredients:
 *                         type: array
 *                         items:
 *                           type: string
 *                       instructions:
 *                         type: array
 *                         items:
 *                           type: string
 *       401:
 *         description: Unauthorized (No token provided)
 *       404:
 *         description: User not found
 *       500:
 *         description: Error fetching user or recipes
 */
router.get('/profile', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).send('Access denied. No token provided.');
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        const userSql = 'SELECT FirstName, LastName, Email FROM tbl_user WHERE UserID = ?';
        db.query(userSql, [userId], (err, userResults) => {
            if (err) {
                console.error("Database error:", err);
                return res.status(500).send('Database error');
            }
            if (userResults.length === 0) {
                console.log("No user found with UserID:", userId);
                return res.status(404).send('User not found');
            }

            const recipesSql = `
                SELECT r.RecipeID, r.Title, r.Description, r.ImageURL, r.Category
                FROM tbl_recipe r
                WHERE r.UserID = ?
            `;
            db.query(recipesSql, [userId], (err, recipeResults) => {
                if (err) {
                    console.error("Database error while fetching recipes:", err);
                    return res.status(500).send('Database error while fetching recipes');
                }

                const recipesWithDetails = recipeResults.map(recipe => {
                    return new Promise((resolve, reject) => {
                        const ingredientsSql = `
                            SELECT i.IngredientName 
                            FROM tbl_ingredient i 
                            WHERE i.RecipeID = ?
                        `;
                        db.query(ingredientsSql, [recipe.RecipeID], (err, ingredientResults) => {
                            if (err) return reject(err);

                            const instructionsSql = `
                                SELECT ins.InstructionText 
                                FROM tbl_instruction ins 
                                WHERE ins.RecipeID = ?
                                ORDER BY ins.StepNumber
                            `;
                            db.query(instructionsSql, [recipe.RecipeID], (err, instructionResults) => {
                                if (err) return reject(err);

                                recipe.ingredients = ingredientResults.map(ing => ing.IngredientName);
                                recipe.instructions = instructionResults.map(ins => ins.InstructionText);
                                resolve(recipe);
                            });
                        });
                    });
                });

                Promise.all(recipesWithDetails).then(fullRecipeResults => {
                    res.json({
                        ...userResults[0],
                        recipes: fullRecipeResults
                    });
                }).catch(err => {
                    console.error("Error fetching recipe details:", err);
                    res.status(500).send('Error fetching recipe details');
                });
            });
        });
    } catch (error) {
        console.error("JWT verification error:", error);
        res.status(400).send('Invalid token.');
    }
});

/**
 * @swagger
 * /api/user/users:
 *   get:
 *     summary: List all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   UserID:
 *                     type: integer
 *                   FirstName:
 *                     type: string
 *                   LastName:
 *                     type: string
 *                   Email:
 *                     type: string
 *                   Gender:
 *                     type: string
 *                   IsApiUser:
 *                     type: boolean
 *                   Created_at:
 *                     type: string
 *       500:
 *         description: Error fetching users
 */
// List all users
router.get('/users', verifyApiUser, (req, res) => {
    const sql = 'SELECT UserID, FirstName, LastName, Email, Gender, IsApiUser, Created_at FROM tbl_user';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).send('Error fetching users.');
        res.json(results);
    });
});

/**
 * @swagger
 * /api/user/users/{identifier}:
 *   get:
 *     summary: Get a user by email or ID
 *     security:
 *       - bearerAuth: []
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID or email
 *     responses:
 *       200:
 *         description: The user's information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 UserID:
 *                   type: integer
 *                 FirstName:
 *                   type: string
 *                 LastName:
 *                   type: string
 *                 Email:
 *                   type: string
 *                 Gender:
 *                   type: string
 *                 IsApiUser:
 *                   type: boolean
 *                 Created_at:
 *                   type: string
 *       404:
 *         description: User not found
 *       500:
 *         description: Error fetching user
 */
// Get user by email or ID
router.get('/users/:identifier', verifyApiUser, (req, res) => {
    const { identifier } = req.params;
    const sql = isNaN(identifier)
        ? 'SELECT UserID, FirstName, LastName, Email, Gender, IsApiUser, Created_at FROM tbl_user WHERE Email = ?'
        : 'SELECT UserID, FirstName, LastName, Email, Gender, IsApiUser, Created_at FROM tbl_user WHERE UserID = ?';

    db.query(sql, [identifier], (err, results) => {
        if (err || results.length === 0) return res.status(404).send('User not found.');
        res.json(results[0]);
    });
});

/**
 * @swagger
 * /api/user/users/gender/{gender}:
 *   get:
 *     summary: Get users by gender
 *     security:
 *       - bearerAuth: []
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: gender
 *         required: true
 *         schema:
 *           type: string
 *         description: Gender to filter users by (e.g., 'Male', 'Female')
 *     responses:
 *       200:
 *         description: A list of users filtered by gender
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   UserID:
 *                     type: integer
 *                   FirstName:
 *                     type: string
 *                   LastName:
 *                     type: string
 *                   Email:
 *                     type: string
 *                   Gender:
 *                     type: string
 *                   IsApiUser:
 *                     type: boolean
 *                   Created_at:
 *                     type: string
 *       500:
 *         description: Error fetching users by gender
 */
// Get users by gender
router.get('/users/gender/:gender', verifyApiUser, (req, res) => {
    const { gender } = req.params;
    const sql = 'SELECT UserID, FirstName, LastName, Email, Gender, IsApiUser, Created_at FROM tbl_user WHERE Gender = ?';
    db.query(sql, [gender], (err, results) => {
        if (err) return res.status(500).send('Error fetching users.');
        res.json(results);
    });
});

module.exports = router;
