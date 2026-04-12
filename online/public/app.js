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
  settingsCont: document.getElementById("lobby-settings"),
  presetBtns: document.querySelectorAll(".btn-preset"),
  presetDesc: document.getElementById("preset-description"),
  resultOverlay: document.getElementById("result-overlay"),
  resultTitle: document.getElementById("result-title"),
  resultScores: document.getElementById("result-scores"),
  btnReturnLobby: document.getElementById("btn-return-lobby"),
};

const state = {
  token: localStorage.getItem("tb_token") || null,
  user: null,
  socket: null,
  currentPhase: "WAITING",
  role: null, // DEFENDER | ATTACKER
  board: null, // array of 16 symbols
  values: null, // symbol -> value map
  selectedTiles: [],
  limit: (window.GAME_CONFIG && window.GAME_CONFIG.TILES_TO_PICK) || 5,
  round: 1,
  roomCode: null,
  settings: {
    boardSize: 16,
    tilesToPick: 5,
    maxRounds: 3
  }
};

const PRESETS = {
  classic: { boardSize: 16, tilesToPick: 5, maxRounds: 3, desc: "Standard 4x4 tactical match. 3 Rounds." },
  blitz: { boardSize: 16, tilesToPick: 3, maxRounds: 5, desc: "Fast-paced 4x4. Fewer tiles, more rounds." },
  pro: { boardSize: 36, tilesToPick: 7, maxRounds: 4, desc: "Advanced 6x6 strategic battle. 4 Rounds." }
};

function setStatus(text) {
  console.log("Setting status:", text);
  UI.info.innerText = text;
}

function initGrid() {
  UI.grid.innerHTML = "";
  const totalTiles = state.settings.boardSize;
  
  // Dynamic layout calculation
  const cols = Math.floor(Math.sqrt(totalTiles));
  UI.grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  for (let i = 0; i < totalTiles; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    const tileData = state.board?.[i];

    if (tileData) {
      // Fallback to symbol if value is missing, prevents "undefined"
      tile.innerText = tileData.value !== undefined ? tileData.value : tileData;
      if (tileData.rarity && tileData.rarity !== "common") tile.classList.add(`${tileData.rarity}-tile`);
    }

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

  state.socket.on("session:superseded", () => {
    alert("Logged out: You have logged in from another device or tab.");
    localStorage.removeItem("tb_token");
    window.location.href = "/auth";
  });

  document.getElementById("logout-link").onclick = (e) => {
    e.preventDefault();
    localStorage.removeItem("tb_token");
    window.location.href = "/";
  };

  state.socket.on("me", ({ user }) => {
    state.user = user;
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

  state.socket.on("room:state", ({ code, phase, round, players, settings, ownerId }) => {
    state.roomCode = code;
    state.round = round;
    state.currentPhase = phase;
    if (settings) state.settings = settings;

    UI.grid.style.display = "none";
    UI.roomCodeInput.value = "";
    
    UI.lobbySetup.style.display = "none";
    UI.lobbyRoom.style.display = "block";
    document.getElementById("display-room-code").innerText = `ROOM: ${code}`;

    // Toggle settings visibility based on ownership
    const isOwner = ownerId && state.user && String(state.user.id) === String(ownerId);
    if (UI.settingsCont) {
        UI.settingsCont.style.display = isOwner ? "block" : "none";

        // Highlight the active preset button
        UI.presetBtns.forEach(btn => {
            const pKey = btn.dataset.preset;
            const p = PRESETS[pKey];
            const isActive = p && 
                p.boardSize === state.settings.boardSize && 
                p.tilesToPick === state.settings.tilesToPick && 
                p.maxRounds === state.settings.maxRounds;
            
            btn.classList.toggle("active", isActive);
            btn.disabled = !isOwner; // Only owner can click
        });
    }

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
    state.limit = data.limit || state.settings.tilesToPick;
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
    const players = data?.players || [];
    const totals = data?.totals || {};
    const myId = state.socket.id;

    // Sort players by score to find winner
    const sorted = [...players].sort((a, b) => (totals[b.socketId] || 0) - (totals[a.socketId] || 0));
    const winner = sorted[0];
    const isTie = sorted.length === 2 && totals[sorted[0].socketId] === totals[sorted[1].socketId];

    UI.resultTitle.innerText = isTie ? "DRAW" : (winner.socketId === myId ? "VICTORY" : "DEFEAT");
    UI.resultTitle.style.color = isTie ? "#818384" : (winner.socketId === myId ? "#fff" : "#ff4d4d");
    
    UI.resultScores.innerHTML = sorted.map(p => `
      <div class="result-score-row">
        <span>${p.username.toUpperCase()}</span>
        <strong>${totals[p.socketId] || 0}</strong>
      </div>
    `).join('');

    UI.resultOverlay.style.display = "flex";
    showAction(false);
  });

  state.socket.on("opponentDisconnected", () => {
    UI.title.innerText = "TILE BATTLE";
    setStatus("Opponent disconnected.");
    showAction(false);
  });
}

UI.btnReturnLobby.onclick = () => {
  UI.resultOverlay.style.display = "none";
  UI.grid.style.display = "none";
  UI.lobby.style.display = "block";
  UI.title.innerText = "TILE BATTLE";
};

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

const applyPreset = (presetKey) => {
    if (!state.socket) return;
    const preset = PRESETS[presetKey];
    if (preset) {
        state.socket.emit("room:settings", preset);
    }
};

UI.presetBtns.forEach(btn => {
    btn.onclick = () => {
        applyPreset(btn.dataset.preset);
    };
    btn.onmouseenter = () => {
        const p = PRESETS[btn.dataset.preset];
        if (p && UI.presetDesc) UI.presetDesc.innerText = p.desc;
    };
    btn.onmouseleave = () => {
        if (UI.presetDesc) UI.presetDesc.innerText = "";
    };
});

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
