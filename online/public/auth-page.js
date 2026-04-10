const UI = {
    title: document.getElementById("auth-title"),
    btn: document.getElementById("auth-btn"),
    toggle: document.getElementById("toggle-mode"),
    info: document.getElementById("auth-info"),
    userIn: document.getElementById("username"),
    passIn: document.getElementById("password")
};

let isLogin = true;

UI.toggle.onclick = () => {
    isLogin = !isLogin;
    UI.title.innerText = isLogin ? "LOGIN" : "REGISTER";
    UI.btn.innerText = isLogin ? "LOGIN" : "REGISTER";
    UI.toggle.innerText = isLogin ? "Don't have an account? Register" : "Already have an account? Login";
};

async function handleSubmit() {
    const username = UI.userIn.value.trim();
    const password = UI.passIn.value;

    if (!username || !password) return alert("Please fill in all fields.");

    UI.btn.disabled = true;
    UI.info.innerText = "Processing...";

    try {
        const path = isLogin ? "login" : "register";
        const res = await fetch(`/api/${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Request failed");

        localStorage.setItem("tb_token", data.token);
        window.location.href = "game.html";
    } catch (e) {
        UI.info.innerText = `Error: ${e.message}`;
        UI.info.style.color = "#ff4d4d";
        UI.btn.disabled = false;
    }
}

UI.btn.onclick = handleSubmit;

// Allow Enter key to submit
[UI.userIn, UI.passIn].forEach(input => {
    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleSubmit();
    });
});

if (localStorage.getItem("tb_token")) window.location.href = "game.html";