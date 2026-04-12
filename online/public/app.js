const UI = {
  title: document.getElementById("phase-title"),
  info: document.getElementById("info"),
  grid: document.getElementById("grid"),
  actionBtn: document.getElementById("action-btn"),
  lobby: document.getElementById("lobby"),
  roomStatus: document.getElementById("room-status"),
  lobbySetup: document.getElementById("lobby-setup"),
  lobbyRoom: document.getElementById("lobby-room"),
  playerList: document.getElementById("player-list"),
  roomCodeInput: document.getElementById("room-code"),
};

const state = {
  token: localStorage.getItem("tb_token") || null,
  socket: null,
  currentPhase: "WAITING",
  role: null, // DEFENDER | ATTACKER
  board: null, // array of 16 symbols
  values: null, // symbol -> value map
  selectedTiles: [],
  limit: (window.GAME_CONFIG && window.GAME_CONFIG.TILES_TO_PICK) || 5,
  round: 1,
  roomCode: null,
};

function setStatus(text) {
  console.log("Setting status:", text);
  UI.info.innerText = text;
}

function initGrid() {
  UI.grid.innerHTML = "";
  const totalTiles = (window.GAME_CONFIG && window.GAME_CONFIG.TOTAL_TILES) || 16;
  for (let i = 0; i < totalTiles; i++) {
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
  console.log("Attempting to connect Socket.IO...");
  if (!state.token || state.token === "null" || state.token === "undefined") {
    window.location.href = "/auth";
    return;
  }
  state.socket = window.io({
    auth: { token: state.token },
    transports: ["websocket", "polling"],
  });

  state.socket.on("connect", () => {
    console.log("Socket.IO connected successfully!");
    setStatus("Connected. Create or join a room.");
    console.log("Client Connected to Server!");
  });

  state.socket.on("connect_error", (err) => {
    console.error("Lobby Connection Error:", err.message);
    if (["invalid_token", "session_expired", "auth_failed"].includes(err.message)) {
        localStorage.removeItem("tb_token");
        window.location.href = "/auth";
    } else {
        setStatus(`Connection error: ${err.message}`);
    }
  });

  document.getElementById("logout-link").onclick = (e) => {
    e.preventDefault();
    localStorage.removeItem("tb_token");
    window.location.href = "/";
  };

  state.socket.on("me", ({ user }) => {
    UI.lobby.style.display = "block";
    UI.lobbySetup.style.display = "block";
    UI.lobbyRoom.style.display = "none";
    document.getElementById("user-profile").style.display = "block";
    document.getElementById("prof-username").innerText = user.username.toUpperCase();
    
    // Update Stats
    document.getElementById("stat-wins").innerText = user.wins || 0;
    document.getElementById("stat-losses").innerText = user.losses || 0;
    document.getElementById("stat-rank").innerText = `#${user.global_rank || '-'}`;
    
    if (user.created_at) {
        const date = new Date(user.created_at).toLocaleDateString();
        document.getElementById("prof-joined").innerText = `Member since: ${date}`;
    }

    UI.roomStatus.innerText = "Ready to battle";
  });

  state.socket.on("room:created", ({ code }) => {
    UI.roomStatus.innerText = `Room created: ${code}`;
    state.socket.emit("room:join", { code });
  });
  state.socket.on("room:error", ({ error }) => {
    UI.roomStatus.innerText = `Room error: ${error}`;
    document.getElementById("btn-create-room").disabled = false;
    document.getElementById("btn-join-room").disabled = false;
  });

  state.socket.on("room:state", ({ code, phase, round, players }) => {
    state.roomCode = code;
    state.round = round;
    state.currentPhase = phase;
    UI.grid.style.display = "none";
    UI.roomCodeInput.value = "";
    
    UI.lobbySetup.style.display = "none";
    UI.lobbyRoom.style.display = "block";
    document.getElementById("display-room-code").innerText = `ROOM: ${code}`;

    UI.playerList.innerHTML = "";
    players.forEach(p => {
      const pEl = document.createElement("div");
      pEl.className = `player-badge ${p.ready ? 'ready' : ''}`;
      pEl.innerHTML = `
        <span class="p-name">${p.username}</span>
        <span class="p-status">${p.ready ? 'READY' : 'WAITING...'}</span>
      `;
      UI.playerList.appendChild(pEl);

      if (p.socketId === state.socket.id) {
        document.getElementById("btn-ready").innerText = p.ready ? "UNREADY" : "READY UP";
        document.getElementById("btn-ready").classList.toggle("is-ready", p.ready);
      }
    });
  });

  state.socket.on("roundPhase", (data) => {
    state.currentPhase = data.phase; // DEFEND | ATTACK
    state.role = data.role; // DEFENDER | ATTACKER
    state.round = data.round;
    state.limit = data.limit;
    state.board = data.board;
    state.values = data.values;
    state.selectedTiles = [];
    UI.lobby.style.display = "none"; // Hide lobby when game starts
    document.getElementById("user-profile").style.display = "none"; // Hide profile panel during match
    UI.grid.style.display = "grid"; // Show grid when game starts
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
  if (state.selectedTiles.length !== state.limit) {
      setStatus(`⚠ Error: You must pick exactly ${state.limit} tiles.`);
      UI.info.style.color = "#ff4d4d";
      return;
  }
  UI.info.style.color = "#818384";
  const ev = state.currentPhase === "DEFEND" ? "submitDraw" : "submitGuess";
  state.socket.emit(ev, state.selectedTiles);
  state.currentPhase = "LOCKED";
  showAction(false);
  setStatus("Locked in. Waiting...");
};

document.getElementById("btn-ready").onclick = () => {
  if (!state.socket) return;
  state.socket.emit("room:ready");
};

document.getElementById("btn-copy-code").onclick = () => {
  if (!state.roomCode) return;
  navigator.clipboard.writeText(state.roomCode);
  const btn = document.getElementById("btn-copy-code");
  const original = btn.innerText;
  btn.innerText = "COPIED!";
  btn.classList.add("copied");
  setTimeout(() => {
    btn.innerText = original;
    btn.classList.remove("copied");
  }, 2000);
};

document.getElementById("btn-leave-room").onclick = () => {
  window.location.reload(); // Quickest way to reset socket state and UI
};

document.getElementById("btn-create-room").onclick = () => {
  if (!state.socket) return;
  document.getElementById("btn-create-room").disabled = true;
  document.getElementById("btn-join-room").disabled = true;
  state.socket.emit("room:create");
};

const handleJoin = () => {
  if (!state.socket) return;
  const code = UI.roomCodeInput.value.trim().toUpperCase();
  if (!code) return;
  document.getElementById("btn-create-room").disabled = true;
  document.getElementById("btn-join-room").disabled = true;
  state.socket.emit("room:join", { code });
};

UI.roomCodeInput.onkeypress = (e) => {
  if (e.key === "Enter") handleJoin();
};

document.getElementById("btn-join-room").onclick = handleJoin;

document.addEventListener('DOMContentLoaded', () => {
  initGrid();
  const hasValidToken = state.token && state.token !== "null" && state.token !== "undefined";
  console.log("App.js loaded. Token Valid:", hasValidToken);
  if (hasValidToken) { connectSocket(); }
  else { window.location.href = "/auth"; }
});
