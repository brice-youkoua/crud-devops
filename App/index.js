const express = require('express');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const logDir = process.env.LOG_DIR || "/var/logs/crud";
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}
const appLog = path.join(logDir, 'app.log');

function log(level, message, context = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...context
    };
    fs.appendFile(appLog, JSON.stringify(entry) + '\n', (err) => {
        if (level === 'error') console.error(entry);
        else console.log(entry);
    });
}

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'crud_app'
};

// Pool de connexions
let pool;

// Initialisation de la base de données
async function initDatabase() {
    try {
        pool = mysql.createPool(dbConfig);

        // Création de la table users si elle n'existe pas
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        uuid VARCHAR(36) PRIMARY KEY,
        fullname VARCHAR(255) NOT NULL,
        study_level VARCHAR(255) NOT NULL,
        age INT NOT NULL
      )
    `);

        console.log('Base de données initialisée');
    } catch (error) {
        console.error('Erreur initialisation DB:', error);
    }
}

// Validation des données utilisateur 
function validateUser(userData) {
    if (!userData) return false;
    const { fullname, study_level, age } = userData;
    if (!fullname || typeof fullname !== 'string') return false;
    if (!study_level || typeof study_level !== 'string') return false;
    if (!age || isNaN(age)) return false;
    return true;
}

// Routes API

// GET /api/users
app.get('/api/users', async(req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM users');
        log('info', 'Listes des utilisateurs récupérée', { endpoint: 'GET /api/users', count: rows.length });
        res.json(rows);
    } catch (error) {
        log('error', 'Erreur lors de la récupération des utilisateurs GET /api/users', { error });
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// GET /api/users/:uuid
app.get('/api/users/:uuid', async(req, res) => {
    try {
        const { uuid } = req.params;
        const [rows] = await pool.execute('SELECT * FROM users WHERE uuid = ?', [uuid]);

        if (rows.length === 0) {
            return res.status(404).json({ endpoint: `GET /api/users/${uuid}`, error: 'Utilisateur non trouvé' });
        }
        log('info', 'Utilisateur récupéré', { endpoint: `GET /api/users/${uuid}`, uuid });
        res.json(rows[0]);
    } catch (error) {
        log('error', 'Erreur lors de la récupération de l\'utilisateur GET /api/users/:uuid', { endpoint: `GET /api/users/${uuid}`, error });
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// POST /api/users
app.post('/api/users', async(req, res) => {
    try {
        const { fullname, study_level, age } = req.body;
        if (!validateUser(req.body)) {
            log('warn', 'Validation échouée pour la création d\'utilisateur', { endpoint: `POST /api/users`, data: req.body });
            return res.status(400).json({ error: 'Données utilisateur invalides' });
        }
        const uuid = uuidv4();

        await pool.execute(
            'INSERT INTO users (uuid, fullname, study_level, age) VALUES (?, ?, ?, ?)', [uuid, fullname, study_level, age]
        );
        const newUser = { uuid, fullname, study_level, age: Number(age) };
        log('info', 'Utilisateur créé', { endpoint: `POST /api/users`, uuid });
        res.status(201).json(newUser);

    } catch (error) {
        log('error', 'Erreur lors de la création de l\'utilisateur POST /api/users', { endpoint: `POST /api/users`, error });
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// PUT /api/users/:uuid
app.put('/api/users/:uuid', async(req, res) => {
    try {
        const { uuid } = req.params;
        const { fullname, study_level, age } = req.body;
        if (!validateUser(req.body)) {
            log('warn', 'Validation échouée pour la mise à jour d\'utilisateur', { endpoint: `PUT /api/users/${uuid}`, data: req.body });
            return res.status(400).json({ error: 'Données utilisateur invalides' });
        }
        const result = await pool.execute(
            'UPDATE users SET fullname = ?, study_level = ?, age = ? WHERE uuid = ?', [fullname, study_level, age, uuid]
        );
        log('info', 'Utilisateur mis à jour', { uuid });
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        const updatedUser = { uuid, fullname, study_level, age };
        res.json(updatedUser);

    } catch (error) {
        log('error', 'Erreur lors de la mise à jour de l\'utilisateur PUT /api/users/:uuid', { endpoint: `PUT /api/users/${uuid}`, error });
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// DELETE /api/users/:uuid
app.delete('/api/users/:uuid', async(req, res) => {
    try {
        const { uuid } = req.params;

        const result = await pool.execute('DELETE FROM users WHERE uuid = ?', [uuid]);
        log('info', 'Utilisateur supprimé', { endpoint: `DELETE /api/users/${uuid}` });
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        res.json({ message: 'Utilisateur supprimé' });

    } catch (error) {
        log('error', 'Erreur lors de la suppression de l\'utilisateur DELETE /api/users/:uuid', { endpoint: `DELETE /api/users/${uuid}`, error });
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// GET /health
app.get('/health', async(req, res) => {
    try {
        await pool.execute('SELECT 1');
        log('info', 'Health check réussi', { endpoint: '/health' });
        res.json({ status: 'OK', database: 'connected' });
    } catch (error) {
        log('error', 'Health check échoué', { endpoint: '/health', error });
        res.status(500).json({ status: 'ERROR', database: 'disconnected' });
    }
});

// Point d'entrée de l'application
app.listen(PORT, async() => {
    await initDatabase();
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API Users: http://localhost:${PORT}/api/users`);
});