const UI = {
  title: document.getElementById("phase-title"),
  info: document.getElementById("info"),
  grid: document.getElementById("grid"),
  actionBtn: document.getElementById("action-btn"),
  auth: document.getElementById("auth"),
  lobby: document.getElementById("lobby"),
  roomStatus: document.getElementById("room-status"),
};

const state = {
  token: localStorage.getItem("tb_token") || null,
  socket: null,
  currentPhase: "WAITING",
  role: null, // DEFENDER | ATTACKER
  board: null, // array of 16 symbols
  values: null, // symbol -> value map
  selectedTiles: [],
  limit: window.GAME_CONFIG.TILES_TO_PICK,
  round: 1,
  roomCode: null,
};

function setStatus(text) {
  UI.info.innerText = text;
}

function initGrid() {
  UI.grid.innerHTML = "";
  for (let i = 0; i < window.GAME_CONFIG.TOTAL_TILES; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    const sym = state.board?.[i];
    tile.innerText = sym || "";
    tile.onclick = () => toggleTile(i, tile);
    UI.grid.appendChild(tile);
  }
}

function clearTileClasses() {
  document.querySelectorAll(".tile").forEach((t) => t.classList.remove("selected", "correct-location"));
}

function toggleTile(index, el) {
  const canSelect =
    (state.currentPhase === "DEFEND" && state.role === "DEFENDER") ||
    (state.currentPhase === "ATTACK" && state.role === "ATTACKER");
  if (!canSelect) return;

  if (state.selectedTiles.includes(index)) {
    state.selectedTiles = state.selectedTiles.filter((x) => x !== index);
    el.classList.remove("selected");
  } else if (state.selectedTiles.length < state.limit) {
    state.selectedTiles.push(index);
    el.classList.add("selected");
  }
  setStatus(`Selected: ${state.selectedTiles.length} / ${state.limit}`);
}

function showAction(show) {
  UI.actionBtn.style.display = show ? "block" : "none";
}

function connectSocket() {
  if (!state.token) return;
  state.socket = window.io({
    auth: { token: state.token },
    transports: ["websocket", "polling"],
  });

  state.socket.on("connect", () => {
    setStatus("Connected. Create or join a room.");
    console.log("Client Connected to Server!");
  });
  state.socket.on("connect_error", (err) => {
    setStatus(`Connection error: ${err?.message || err}`);
  });
  state.socket.on("me", ({ user }) => {
    UI.auth.style.display = "none";
    UI.lobby.style.display = "block";
    UI.roomStatus.innerText = `Logged in as ${user.username}`;
  });

  state.socket.on("room:created", ({ code }) => {
    UI.roomStatus.innerText = `Room created: ${code}`;
  });
  state.socket.on("room:error", ({ error }) => {
    UI.roomStatus.innerText = `Room error: ${error}`;
  });
  state.socket.on("room:state", ({ code, phase, round, players }) => {
    state.roomCode = code;
    state.round = round;
    state.currentPhase = phase;
    UI.roomStatus.innerText = `Room ${code} (${players.length}/2)`;
  });

  state.socket.on("roundPhase", (data) => {
    state.currentPhase = data.phase; // DEFEND | ATTACK
    state.role = data.role; // DEFENDER | ATTACKER
    state.round = data.round;
    state.limit = data.limit;
    state.board = data.board;
    state.values = data.values;
    state.selectedTiles = [];
    initGrid();
    clearTileClasses();

    if (data.phase === "DEFEND") {
      UI.title.innerText = `Round ${state.round}: DEFEND`;
      if (state.role === "DEFENDER") {
        setStatus(`Pick ${state.limit} tiles to defend.`);
        showAction(true);
      } else {
        setStatus("Opponent is defending. Get ready to attack.");
        showAction(false);
      }
    } else {
      UI.title.innerText = `Round ${state.round}: ATTACK`;
      if (state.role === "ATTACKER") {
        setStatus(`Guess ${state.limit} defended tiles.`);
        showAction(true);
      } else {
        setStatus("Opponent is attacking. Waiting...");
        showAction(false);
      }
    }
  });

  state.socket.on("roundResult", (data) => {
    state.currentPhase = "RESULT";
    const myId = state.socket.id;
    const myPoints = data?.roundPoints?.[myId] ?? 0;
    const myTotal = data?.totals?.[myId] ?? 0;
    UI.title.innerText = `Round Over! +${myPoints} points`;
    setStatus(`Total score: ${myTotal}`);
    showAction(false);

    // Reveal the defended tiles (same for both players)
    state.board = data?.board || state.board;
    initGrid();
    const defended = data?.defendedTiles ?? [];
    const tiles = document.querySelectorAll(".tile");
    defended.forEach((idx) => {
      if (Number.isInteger(idx) && idx >= 0 && idx < tiles.length) tiles[idx].classList.add("correct-location");
    });
  });

  state.socket.on("gameOver", (data) => {
    const myId = state.socket.id;
    const myTotal = data?.totals?.[myId] ?? 0;
    UI.title.innerText = "Game Over";
    setStatus(`Final score: ${myTotal}.`);
    showAction(false);
  });

  state.socket.on("opponentDisconnected", () => {
    UI.title.innerText = "TILE BATTLE";
    setStatus("Opponent disconnected.");
    showAction(false);
  });
}

UI.actionBtn.onclick = () => {
  if (!state.socket) return;
  if (state.selectedTiles.length !== state.limit) return alert(`Pick exactly ${state.limit}`);
  const ev = state.currentPhase === "DEFEND" ? "submitDraw" : "submitGuess";
  state.socket.emit(ev, state.selectedTiles);
  state.currentPhase = "LOCKED";
  showAction(false);
  setStatus("Locked in. Waiting...");
};

async function api(path, body) {
  const res = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "request_failed");
  return data;
}

document.getElementById("btn-register").onclick = async () => {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  try {
    const { token } = await api("register", { username, password });
    state.token = token;
    localStorage.setItem("tb_token", token);
    connectSocket();
  } catch (e) {
    setStatus(`Register failed: ${e.message}`);
  }
};

document.getElementById("btn-login").onclick = async () => {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  try {
    const { token } = await api("login", { username, password });
    state.token = token;
    localStorage.setItem("tb_token", token);
    connectSocket();
  } catch (e) {
    setStatus(`Login failed: ${e.message}`);
  }
};

document.getElementById("btn-create-room").onclick = () => {
  if (!state.socket) return;
  state.socket.emit("room:create");
};

document.getElementById("btn-join-room").onclick = () => {
  if (!state.socket) return;
  const code = document.getElementById("room-code").value;
  state.socket.emit("room:join", { code });
};

initGrid();
if (state.token) connectSocket();
else setStatus("Register or login to play.");

