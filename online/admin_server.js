require('dotenv').config();
const express = require('express');
const path = require('path');
const { getPool } = require('./db');
const { verifyToken, verifyPassword, signToken } = require('./auth');

const app = express();
const PORT = process.env.ADMIN_PORT || 3001;
const pool = getPool();

app.use(express.json());

// Redirect root to the admin login portal
app.get('/', (req, res) => {
    res.redirect('/admin/login');
});

app.use(express.static(path.join(__dirname, 'admin')));

function parseAuthHeader(req) {
    const header = req.headers.authorization || "";
    const m = header.match(/^Bearer\s+(.+)$/i);
    return m ? m[1] : null;
}

async function getAdminById(id) {
    const res = await pool.query("SELECT id, username FROM admins WHERE id = $1", [id]);
    return res.rows[0] || null;
}

async function adminOnly(req, res, next) {
    const token = parseAuthHeader(req);
    if (!token) return res.status(401).json({ error: "unauthorized" });
    try {
        const payload = verifyToken(token);
        const admin = await getAdminById(Number(payload.sub || payload.id));
        if (!admin) return res.status(403).json({ error: "forbidden" });
        req.admin = admin;
        next();
    } catch {
        res.status(401).json({ error: "invalid_token" });
    }
}

// Routes
// Note: adminOnly is removed here because browsers can't send headers on page navigation.
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'admin.html'));
});

app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'admin-login.html'));
});

// API
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    const result = await pool.query("SELECT id, username, password_hash FROM admins WHERE username = $1", [username]);
    const admin = result.rows[0];

    if (!admin || !(await verifyPassword(password, admin.password_hash))) {
        return res.status(401).json({ error: "invalid_credentials" });
    }

    const token = signToken({ id: admin.id, username: admin.username });
    res.json({ token, user: { id: admin.id, username: admin.username } });
});

app.get('/api/admin/users', adminOnly, async (req, res) => {
    const result = await pool.query("SELECT id, username, wins, losses, rank_points FROM users ORDER BY id ASC");
    res.json(result.rows);
});

app.delete('/api/admin/users/:id', adminOnly, async (req, res) => {
    const targetId = Number(req.params.id);
    // We can't delete ourselves because admins are in a different table, 
    // but we should prevent deleting high-priority IDs if necessary.
    await pool.query("DELETE FROM users WHERE id = $1", [targetId]);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`--- TileBattle ADMIN Panel Live ---`);
    console.log(`Port: ${PORT}`);
    console.log(`Isolation Level: Detached Process`);
});