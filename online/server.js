require('dotenv').config(); 
const path = require("path");
const http = require("http");
const crypto = require("crypto");

const express = require("express");
const { Server } = require("socket.io");

const { getPool, migrate } = require("./db");
const { hashPassword, signToken, verifyPassword, verifyToken } = require("./auth");

const PORT = Number(process.env.PORT || 3000);
const GAME_LIMIT = Number(process.env.GAME_LIMIT || 5);
const MAX_ROUNDS = Number(process.env.MAX_ROUNDS || 3);

const SYMBOLS = ["1", "2", "3", "4"];
const SYMBOL_VALUES = { "1": 1, "2": 2, "3": 3, "4": 4 };
  
const app = express();
app.use(express.json());

// Serve the browser client
app.use(express.static(path.join(__dirname, "public")));

// DB
const pool = getPool();

function makeRoomCode() {
  // 6 chars, URL/voice friendly enough for a first pass.
  return crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
}

function parseAuthHeader(req) {
  const header = req.headers.authorization || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}
//
async function getUserByUsername(username) {
  const res = await pool.query("select id, username, password_hash from users where username=$1", [
    username,
  ]);
  return res.rows[0] || null;
}

async function getUserById(id) {
  const res = await pool.query("select id, username from users where id=$1", [id]);
  return res.rows[0] || null;
}

app.post("/api/register", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (username.length < 3) return res.status(400).json({ error: "username_too_short" });
  if (password.length < 6) return res.status(400).json({ error: "password_too_short" });

  const passwordHash = await hashPassword(password);
  try {
    const created = await pool.query(
      "insert into users (username, password_hash) values ($1,$2) returning id, username",
      [username, passwordHash],
    );
    const user = created.rows[0];
    const token = signToken(user);
    return res.json({ token, user });
  } catch (e) {
    if (String(e?.code) === "23505") return res.status(409).json({ error: "username_taken" });
    console.error(e);
    return res.status(500).json({ error: "server_error" });
  }
});

app.post("/api/login", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  const user = await getUserByUsername(username);
  if (!user) return res.status(401).json({ error: "invalid_credentials" });

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  const token = signToken({ id: user.id, username: user.username });
  return res.json({ token, user: { id: user.id, username: user.username } });
});

app.get("/api/me", async (req, res) => {
  const token = parseAuthHeader(req);
  if (!token) return res.status(401).json({ error: "missing_token" });

  try {
    const payload = verifyToken(token);
    const user = await getUserById(Number(payload.sub));
    if (!user) return res.status(401).json({ error: "invalid_token" });
    return res.json({ user });
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
});


io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("missing_token"));
    const payload = verifyToken(token);
    const user = await getUserById(Number(payload.sub));
    if (!user) return next(new Error("invalid_token"));
    socket.data.user = user;
    return next();
  } catch (e) {
    return next(new Error("invalid_token"));
  }
});

// In-memory room match state (DB is for accounts + room ownership only)
const roomMatches = new Map(); // code -> matchState

function getOrCreateMatch(code) {
  if (roomMatches.has(code)) return roomMatches.get(code);
  const match = {
    code,
    round: 1,
    phase: "WAITING", // WAITING -> DEFEND -> ATTACK -> RESULT -> (next round or GAME_OVER)
    players: [], // socket.id
    data: {}, // socket.id -> { defends, attacks, score }
    board: null, // array of 16 symbols
    defenderId: null,
    attackerId: null,
  };
  roomMatches.set(code, match);
  return match;
}

function roomEmit(code, event, payload) {
  io.to(code).emit(event, payload);
}

function emitTo(socketId, event, payload) {
  io.to(socketId).emit(event, payload);
}

function newBoard() {
  return Array.from({ length: 16 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
}

function startNewRound(match) {
  if (match.round > MAX_ROUNDS) return;
  const [p1, p2] = match.players;
  match.board = newBoard();

  // Swap roles each round.
  match.defenderId = match.round % 2 === 1 ? p1 : p2;
  match.attackerId = match.defenderId === p1 ? p2 : p1;

  match.phase = "DEFEND";

  emitTo(match.defenderId, "roundPhase", {
    phase: "DEFEND",
    role: "DEFENDER",
    round: match.round,
    limit: GAME_LIMIT,
    board: match.board,
    values: SYMBOL_VALUES,
  });
  emitTo(match.attackerId, "roundPhase", {
    phase: "DEFEND",
    role: "ATTACKER",
    round: match.round,
    limit: GAME_LIMIT,
    board: match.board,
    values: SYMBOL_VALUES,
  });
}

function calculateScores(match) {
  const defenderId = match.defenderId;
  const attackerId = match.attackerId;

  const defended = match.data[defenderId].defends;
  const attacked = match.data[attackerId].attacks;

  const hitSet = new Set(attacked.filter((i) => defended.includes(i)));
  const missSet = new Set(defended.filter((i) => !hitSet.has(i)));

  const valueAt = (tileIdx) => {
    const sym = match.board?.[tileIdx];
    return SYMBOL_VALUES[sym] || 0;
  };

  const attackerRoundPoints = Array.from(hitSet).reduce((sum, i) => sum + valueAt(i), 0);
  const defenderRoundPoints = Array.from(missSet).reduce((sum, i) => sum + valueAt(i), 0);

  match.data[attackerId].score += attackerRoundPoints;
  match.data[defenderId].score += defenderRoundPoints;

match.phase = "RESULT";
  
  roomEmit(match.code, "roundResult", {
    roundPoints: { [attackerId]: attackerRoundPoints, [defenderId]: defenderRoundPoints },
    totals: { [attackerId]: match.data[attackerId].score, [defenderId]: match.data[defenderId].score },
    // Reveal: to each player, show the tiles the defender protected (same as “actualTiles” before)
    defendedTiles: defended,
    board: match.board,
    values: SYMBOL_VALUES,
    roles: { defenderId, attackerId },
  });

  const isLastRound = match.round >= MAX_ROUNDS;
  match.players.forEach((id) => {
    match.data[id].defends = [];
    match.data[id].attacks = [];
  });

  if (isLastRound) {
    match.phase = "GAME_OVER";
    roomEmit(match.code, "gameOver", {
      rounds: MAX_ROUNDS,
      totals: { [match.players[0]]: match.data[match.players[0]].score, [match.players[1]]: match.data[match.players[1]].score },
    });
    return;
  }

  match.round++;
  setTimeout(() => startNewRound(match), 3000);
}

function checkPhaseComplete(match, phase) {
  if (phase === "DEFEND") {
    const defenderReady = match.data[match.defenderId].defends.length === GAME_LIMIT;
    if (!defenderReady) return;

    match.phase = "ATTACK";
    emitTo(match.defenderId, "roundPhase", {
      phase: "ATTACK",
      role: "DEFENDER",
      round: match.round,
      limit: GAME_LIMIT,
      board: match.board,
      values: SYMBOL_VALUES,
    });
    emitTo(match.attackerId, "roundPhase", {
      phase: "ATTACK",
      role: "ATTACKER",
      round: match.round,
      limit: GAME_LIMIT,
      board: match.board,
      values: SYMBOL_VALUES,
    });
    return;
  }

  if (phase === "ATTACK") {
    const attackerReady = match.data[match.attackerId].attacks.length === GAME_LIMIT;
    if (!attackerReady) return;
    calculateScores(match);
  }
}

io.on("connection", (socket) => {
  socket.emit("me", { user: socket.data.user });

  socket.on("room:create", async () => {
    const code = makeRoomCode();
    try {
      await pool.query("insert into rooms (code, owner_user_id) values ($1,$2)", [
        code,
        socket.data.user.id,
      ]);
    } catch (e) {
      console.error(e);
      return socket.emit("room:error", { error: "room_create_failed" });
    }
    socket.emit("room:created", { code });
  });

  socket.on("room:join", async ({ code }) => {
    const roomCode = String(code || "").trim().toUpperCase();
    if (!roomCode) return socket.emit("room:error", { error: "missing_code" });

    const exists = await pool.query("select id from rooms where code=$1", [roomCode]);
    if (!exists.rows[0]) return socket.emit("room:error", { error: "room_not_found" });

    const match = getOrCreateMatch(roomCode);

    // Leave previous room if any
    if (socket.data.roomCode) socket.leave(socket.data.roomCode);

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    if (!match.players.includes(socket.id)) {
      if (match.players.length >= 2) return socket.emit("room:error", { error: "room_full" });
      match.players.push(socket.id);
      match.data[socket.id] = { defends: [], attacks: [], score: 0 };
    }

    roomEmit(roomCode, "room:state", {
      code: roomCode,
      players: match.players.map((id) => ({ socketId: id })),
      phase: match.phase,
      round: match.round,
    });

    if (match.players.length === 2 && match.phase === "WAITING") {
      startNewRound(match);
    }
  });

  socket.on("submitDraw", (tiles) => {
    const code = socket.data.roomCode;
    if (!code) return;
    const match = getOrCreateMatch(code);
    if (!match.data[socket.id]) return;
    if (socket.id !== match.defenderId) return;
    match.data[socket.id].defends = Array.isArray(tiles) ? tiles : [];
    checkPhaseComplete(match, "DEFEND");
  });

  socket.on("submitGuess", (tiles) => {
    const code = socket.data.roomCode;
    if (!code) return;
    const match = getOrCreateMatch(code);
    if (!match.data[socket.id]) return;
    if (socket.id !== match.attackerId) return;
    match.data[socket.id].attacks = Array.isArray(tiles) ? tiles : [];
    checkPhaseComplete(match, "ATTACK");
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const match = roomMatches.get(code);
    if (!match) return;
    match.players = match.players.filter((id) => id !== socket.id);
    delete match.data[socket.id];
    socket.to(code).emit("opponentDisconnected");
    if (match.players.length === 0) roomMatches.delete(code);
    if (match.players.length === 1) match.phase = "WAITING";
  });
});

async function start() {
  await migrate(pool);
  server.listen(PORT, () => {
    console.log(`--- TileBattle Backend Live ---`);
    console.log(`Port: ${PORT}`);
    console.log(`Game Settings: ${GAME_LIMIT} tiles, ${MAX_ROUNDS} rounds max.`);
  });
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
