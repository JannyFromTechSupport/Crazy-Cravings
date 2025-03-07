const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');

/**
 * @swagger
 * tags:
 *   name: Recipes
 *   description: Operations related to recipes
 */

/**
 * @swagger
 * /api/recipes:
 *   get:
 *     summary: Retrieve a list of all recipes
 *     tags: [Recipes]
 *     responses:
 *       200:
 *         description: A list of all recipes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   RecipeID:
 *                     type: integer
 *                   UserID:
 *                     type: integer
 *                   Title:
 *                     type: string
 *                   Description:
 *                     type: string
 *                   ImageURL:
 *                     type: string
 *                   Category:
 *                     type: string
 *                   Ingredients:
 *                     type: array
 *                     items:
 *                       type: string
 *                   Instructions:
 *                     type: array
 *                     items:
 *                       type: string
 *       500:
 *         description: Error fetching recipes
 */
router.get('/', (req, res) => {
    const sql = `
        SELECT r.RecipeID, r.UserID, r.Title, r.Description, r.ImageURL, r.Category,
               GROUP_CONCAT(DISTINCT i.IngredientName ORDER BY i.IngredientID) AS Ingredients,
               GROUP_CONCAT(DISTINCT CONCAT(s.StepNumber, ': ', s.InstructionText) ORDER BY s.StepNumber) AS Instructions
        FROM tbl_recipe r
        LEFT JOIN tbl_ingredient i ON r.RecipeID = i.RecipeID
        LEFT JOIN tbl_instruction s ON r.RecipeID = s.RecipeID
        GROUP BY r.RecipeID
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching recipes:', err);
            return res.status(500).send('Failed to fetch recipes.');
        }
        res.json(results.map(recipe => ({
            RecipeID: recipe.RecipeID,
            UserID: recipe.UserID,
            Title: recipe.Title,
            Description: recipe.Description,
            ImageURL: recipe.ImageURL,
            Category: recipe.Category,
            Ingredients: recipe.Ingredients ? recipe.Ingredients.split(',') : [],
            Instructions: recipe.Instructions ? recipe.Instructions.split(',').map(inst => inst.trim()) : []
        })));
    });
});

/**
 * @swagger
 * /api/recipes/search:
 *   get:
 *     summary: Search for recipes by title or recipe ID
 *     tags: [Recipes]
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Search term to match in recipe title or ID
 *     responses:
 *       200:
 *         description: A list of matching recipes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   RecipeID:
 *                     type: integer
 *                   UserID:
 *                     type: integer
 *                   Title:
 *                     type: string
 *                   Description:
 *                     type: string
 *                   ImageURL:
 *                     type: string
 *                   Category:
 *                     type: string
 *                   Ingredients:
 *                     type: array
 *                     items:
 *                       type: string
 *                   Instructions:
 *                     type: array
 *                     items:
 *                       type: string
 *       500:
 *         description: Database error
 */
router.get('/search', (req, res) => {
    const { query } = req.query;

    const sql = `
        SELECT r.RecipeID, r.UserID, r.Title, r.Description, r.ImageURL, r.Category,
               GROUP_CONCAT(DISTINCT i.IngredientName ORDER BY i.IngredientID) AS Ingredients,
               GROUP_CONCAT(DISTINCT CONCAT(s.StepNumber, ': ', s.InstructionText) ORDER BY s.StepNumber) AS Instructions
        FROM tbl_recipe r
        LEFT JOIN tbl_ingredient i ON r.RecipeID = i.RecipeID
        LEFT JOIN tbl_instruction s ON r.RecipeID = s.RecipeID
        WHERE r.Title LIKE ? OR r.RecipeID = ?
        GROUP BY r.RecipeID
    `;

    db.query(sql, [`%${query}%`, query], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Database error');
        }

        res.json(results.map(recipe => ({
            RecipeID: recipe.RecipeID,
            UserID: recipe.UserID,
            Title: recipe.Title,
            Description: recipe.Description,
            ImageURL: recipe.ImageURL,
            Category: recipe.Category,
            Ingredients: recipe.Ingredients ? recipe.Ingredients.split(',') : [],  
            Instructions: recipe.Instructions ? recipe.Instructions.split(',').map(inst => inst.trim()) : []
        })));
    });
});

/**
 * @swagger
 * /api/recipes:
 *   post:
 *     summary: Create a new recipe
 *     security:
 *       - bearerAuth: []
 *     tags: [Recipes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - imageUrl
 *               - category
 *               - ingredients
 *               - instructions
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *               category:
 *                 type: string
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: string
 *               instructions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Recipe created successfully
 *       400:
 *         description: Missing or invalid fields
 *       401:
 *         description: Unauthorized (No token provided)
 *       500:
 *         description: Failed to create recipe
 */
router.post('/', (req, res) => {
    const { title, description, imageUrl, category, ingredients, instructions } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).send('Access denied. No token provided.');
    }

    if (!title || !description || !imageUrl || !category || !Array.isArray(ingredients) || !Array.isArray(instructions)) {
        return res.status(400).send('Missing or invalid fields. Please provide a title, description, category, ingredients array, and instructions array.');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        if (!userId) {
            return res.status(400).send('Invalid token payload. No user ID found.');
        }

        const recipeSql = 'INSERT INTO tbl_recipe (UserID, Title, Description, ImageURL, Category) VALUES (?, ?, ?, ?, ?)';
        db.query(recipeSql, [userId, title, description, imageUrl, category], (err, result) => {
            if (err) {
                console.error('Error creating recipe:', err);
                return res.status(500).send('Failed to create recipe.');
            }

            const recipeId = result.insertId;

            const ingredientPromises = ingredients.map((ingredient) => {
                return new Promise((resolve, reject) => {
                    const ingredientSql = 'INSERT INTO tbl_ingredient (RecipeID, IngredientName) VALUES (?, ?)';
                    db.query(ingredientSql, [recipeId, ingredient], (err, result) => {
                        if (err) {
                            console.error(`Error inserting ingredient: ${ingredient}`, err);
                            reject(new Error(`Failed to insert ingredient: ${ingredient}`));
                        } else {
                            resolve(result);
                        }
                    });
                });
            });

            const instructionPromises = instructions.map((instruction, index) => {
                return new Promise((resolve, reject) => {
                    const instructionSql = 'INSERT INTO tbl_instruction (RecipeID, StepNumber, InstructionText) VALUES (?, ?, ?)';
                    db.query(instructionSql, [recipeId, index + 1, instruction], (err, result) => {
                        if (err) {
                            console.error(`Error inserting instruction at step ${index + 1}`, err);
                            reject(new Error(`Failed to insert instruction at step ${index + 1}`));
                        } else {
                            resolve(result);
                        }
                    });
                });
            });

            Promise.all([...ingredientPromises, ...instructionPromises])
                .then(() => res.status(201).send('Recipe created successfully!'))
                .catch((err) => {
                    console.error('Error while creating recipe details:', err);
                    res.status(500).send('Failed to create recipe details.');
                });
        });
    } catch (error) {
        console.error('JWT verification error:', error);
        res.status(400).send('Invalid token.');
    }
});

/**
 * @swagger
 * /api/recipes/{id}:
 *   delete:
 *     summary: Delete a recipe by ID
 *     security:
 *       - bearerAuth: []
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the recipe to delete
 *     responses:
 *       200:
 *         description: Recipe deleted successfully
 *       401:
 *         description: Unauthorized (No token provided)
 *       500:
 *         description: Failed to delete recipe
 */
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).send('Access denied. No token provided.');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        if (!userId) {
            return res.status(400).send('Invalid token payload. No user ID found.');
        }

        const deleteIngredientsSql = 'DELETE FROM tbl_ingredient WHERE RecipeID = ?';
        const deleteInstructionsSql = 'DELETE FROM tbl_instruction WHERE RecipeID = ?';
        const deleteRecipeSql = 'DELETE FROM tbl_recipe WHERE RecipeID = ? AND UserID = ?';

        db.query(deleteIngredientsSql, [id], (err) => {
            if (err) {
                console.error('Error deleting ingredients:', err);
                return res.status(500).send('Failed to delete ingredients.');
            }

            db.query(deleteInstructionsSql, [id], (err) => {
                if (err) {
                    console.error('Error deleting instructions:', err);
                    return res.status(500).send('Failed to delete instructions.');
                }

                db.query(deleteRecipeSql, [id, userId], (err, result) => {
                    if (err) {
                        console.error('Error deleting recipe:', err);
                        return res.status(500).send('Failed to delete recipe.');
                    }
                    res.status(200).send('Recipe deleted successfully!'); 
                });
            });
        });
    } catch (error) {
        console.error('JWT verification error:', error);
        res.status(400).send('Invalid token.');
    }
});

/**
 * @swagger
 * /api/recipes/{id}:
 *   put:
 *     summary: Update a recipe by ID
 *     security:
 *       - bearerAuth: []
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the recipe to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - imageUrl
 *               - category
 *               - ingredients
 *               - instructions
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *               category:
 *                 type: string
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: string
 *               instructions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Recipe updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized (No token provided)
 *       500:
 *         description: Failed to update recipe
 */
router.put('/:id', (req, res) => {
    const { id } = req.params; 
    const { title, description, imageUrl, category, ingredients, instructions } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).send('Access denied. No token provided.');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        const updateRecipeSql = 'UPDATE tbl_recipe SET Title = ?, Description = ?, ImageURL = ?, Category = ? WHERE RecipeID = ? AND UserID = ?';
        db.query(updateRecipeSql, [title, description, imageUrl, category, id, userId], (err, result) => {
            if (err) return res.status(500).send('Failed to update recipe.');

            const deleteIngredientsSql = 'DELETE FROM tbl_ingredient WHERE RecipeID = ?';
            db.query(deleteIngredientsSql, [id], (err) => {
                if (err) return res.status(500).send('Failed to delete ingredients.');

                const ingredientPromises = ingredients.map(ingredient => {
                    return new Promise((resolve, reject) => {
                        const ingredientSql = 'INSERT INTO tbl_ingredient (RecipeID, IngredientName) VALUES (?, ?)';
                        db.query(ingredientSql, [id, ingredient], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                });

                const deleteInstructionsSql = 'DELETE FROM tbl_instruction WHERE RecipeID = ?';
                db.query(deleteInstructionsSql, [id], (err) => {
                    if (err) return res.status(500).send('Failed to delete instructions.');

                    const instructionPromises = instructions.map((instruction, index) => {
                        return new Promise((resolve, reject) => {
                            const instructionSql = 'INSERT INTO tbl_instruction (RecipeID, StepNumber, InstructionText) VALUES (?, ?, ?)';
                            db.query(instructionSql, [id, index + 1, instruction], (err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        });
                    });

                    Promise.all([...ingredientPromises, ...instructionPromises])
                        .then(() => res.json({ success: true }))
                        .catch(err => res.status(500).send('Failed to update recipe details.'));
                });
            });
        });
    } catch (error) {
        res.status(400).send('Invalid token.');
    }
});

/**
 * @swagger
 * /api/recipes/recipes/category/{category}:
 *   get:
 *     summary: Get recipes by category
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *         description: The category of recipes to filter
 *     responses:
 *       200:
 *         description: A list of recipes for the specified category
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       500:
 *         description: Error fetching recipes by category
 */
// Get recipes by category
router.get('/recipes/category/:category', (req, res) => {
    const { category } = req.params;
    const sql = 'SELECT * FROM tbl_recipe WHERE Category = ?';
    db.query(sql, [category], (err, results) => {
        if (err) return res.status(500).send('Error fetching recipes.');
        res.json(results);
    });
});

module.exports = router;
