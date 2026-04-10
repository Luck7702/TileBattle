/**
 * TileBattle Landing Page Controller
 * Handles visual effects, feature card initialization, and informational modals.
 */

/* --- Modal Configuration & Logic --- */
const modalInfo = {
    "How To Play": {
        desc: "Tactical 1v1 Combat",
        body: "In TileBattle, players alternate between the roles of Defender and Attacker over 3 rounds. The Defender secretly places 5 tiles on a 4x4 grid. Each tile contains a hidden value (1-4). The Attacker then attempts to find these hidden tiles. If an Attacker hits a tile, they claim its points; if they miss, the Defender keeps the points for themselves."
    },
    "Support": {
        desc: "Need Assistance?",
        body: "If you're experiencing issues or have suggestions, please reach out to us at support@tilebattle.com or check our community forums."
    },
    "Donate": {
        desc: "Support Development",
        body: "TileBattle is a passion project. Your donations help keep the servers running and the game ad-free. Thank you for your support!"
    }
};

const ModalController = {
    overlay: null,

    init() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';
        this.overlay.innerHTML = `
            <div class="modal-content">
                <span class="modal-close">&times;</span>
                <h2 id="modal-title" style="margin-bottom: 15px;"></h2>
                <h4 id="modal-desc" style="color: #818384; margin-bottom: 20px;"></h4>
                <p id="modal-body" style="line-height: 1.6;"></p>
            </div>
        `;
        document.body.appendChild(this.overlay);

        this.overlay.querySelector('.modal-close').onclick = () => this.hide();
        this.overlay.onclick = (e) => { if (e.target === this.overlay) this.hide(); };
        
        // Global close on Escape key
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.hide(); });
    },

    show(type) {
        const data = modalInfo[type];
        if (!data) return;
        document.getElementById('modal-title').innerText = type;
        document.getElementById('modal-desc').innerText = data.desc;
        document.getElementById('modal-body').innerText = data.body;
        this.overlay.style.display = 'flex';
    },

    hide() {
        if (this.overlay) this.overlay.style.display = 'none';
    }
};

/* --- Particle System --- */
const Particles = {
    canvas: null,
    ctx: null,
    list: [],
    count: 60,

    init() {
        this.canvas = document.getElementById('particle-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        window.addEventListener('resize', () => this.resize());
        this.resize();

        for (let i = 0; i < this.count; i++) {
            this.list.push(this.createParticle());
        }
        this.animate();
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    createParticle() {
        return {
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            size: Math.random() * 2 + 1,
            speedX: Math.random() * 1.5 + 0.5,
            speedY: -(Math.random() * 1.5 + 0.5),
            opacity: Math.random() * 0.5 + 0.1,
            reset() {
                if (Math.random() > 0.5) { this.x = Math.random() * window.innerWidth; this.y = window.innerHeight + 20; }
                else { this.x = -20; this.y = Math.random() * window.innerHeight; }
            }
        };
    },

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.list.forEach(p => {
            p.x += p.speedX; p.y += p.speedY;
            if (p.x > this.canvas.width + 20 || p.y < -20) p.reset();
            this.ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        requestAnimationFrame(() => this.animate());
    }
};

/* --- Auth State Handling --- */
async function checkAuthState() {
    const token = localStorage.getItem("tb_token");
    const loginBtn = document.querySelector('.nav-item[href="auth.html"]') || document.getElementById('login-link');
    const playBtn = document.querySelector('.btn-large');

    if (token) {
        try {
            const res = await fetch('/api/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                // Update Login button to Username
                if (loginBtn) {
                    loginBtn.innerText = data.user.username.toUpperCase();
                    loginBtn.href = "#"; // Could link to a profile later
                }
                // Set Play button to go straight to the game
                if (playBtn) {
                    playBtn.onclick = (e) => {
                        e.preventDefault();
                        window.location.href = 'game.html';
                    };
                }
                return;
            }
        } catch (e) { console.error("Auth check failed", e); }
    }

    // Default behavior for guest
    if (playBtn) {
        playBtn.onclick = (e) => {
            e.preventDefault();
            window.location.href = 'auth.html';
        };
    }
}

/* --- Initialization --- */
document.addEventListener('DOMContentLoaded', () => {
    Particles.init();
    ModalController.init();
    checkAuthState();

    const cards = document.querySelectorAll('.feature-card');
    const types = ["How To Play", "Support", "Donate"];
    const labels = ["Learn the rules and mechanics.", "Get help or report bugs.", "Support the creator."];
    
    cards.forEach((card, i) => {
        if (!types[i]) return;
        if (card.querySelector('h3')) card.querySelector('h3').innerText = types[i];
        if (card.querySelector('p')) card.querySelector('p').innerText = labels[i];
        card.onclick = () => ModalController.show(types[i]);
    });
});