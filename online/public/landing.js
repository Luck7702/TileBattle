// Simple logic to show we are connected
try {
    const socket = io();
    socket.on('connect', () => {
        console.log('Landing page connected to track stats');
    });
} catch(e) { console.log("Socket not available locally"); }

// Particle Animation Logic
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

class Particle {
    constructor() {
        this.init();
    }
    init() {
        // Start mainly from bottom or left side
        if (Math.random() > 0.5) {
            this.x = Math.random() * canvas.width;
            this.y = canvas.height + 20;
        } else {
            this.x = -20;
            this.y = Math.random() * canvas.height;
        }
        this.size = Math.random() * 2 + 1;
        this.speedX = Math.random() * 1.5 + 0.5; // Move Right
        this.speedY = -(Math.random() * 1.5 + 0.5); // Move Up
        this.opacity = Math.random() * 0.5 + 0.1;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x > canvas.width + 20 || this.y < -20) {
            this.init();
        }
    }
    draw() {
        ctx.fillStyle = `rgba(83, 141, 78, ${this.opacity})`; // Using the TileBattle Green
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initParticles() {
    particles = [];
    for (let i = 0; i < 60; i++) {
        particles.push(new Particle());
    }
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
}

initParticles();
animate();