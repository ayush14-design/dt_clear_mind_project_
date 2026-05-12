const canvas = document.getElementById('starfield');
const ctx = canvas.getContext('2d');

let width, height;
let stars = [];

function initCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    initStars();
}

function initStars() {
    stars = [];
    const numStars = Math.floor((width * height) / 2000); // Dynamic star count based on screen size

    for (let i = 0; i < numStars; i++) {
        stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 1.5,
            opacity: Math.random(),
            speed: Math.random() * 0.05 + 0.01
        });
    }
}

let scrollY = 0;
let time = 0;

function drawStars() {
    time += 0.005;
    ctx.clearRect(0, 0, width, height);
    
    // Extraordinary radial gradient background
    const centerX = width / 2;
    const centerY = height / 2 + (scrollY * 0.2); // Parallax the center
    
    const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, Math.max(width, height)
    );
    
    // Pulsing core based on time and scroll
    const r = Math.floor(3 + Math.sin(time) * 2 + (scrollY / 1000) * 10);
    const g = Math.floor(15 + Math.cos(time) * 5 + (scrollY / 1000) * 20);
    const b = Math.floor(30 + Math.sin(time * 0.8) * 10 + (scrollY / 1000) * 30);
    
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
    gradient.addColorStop(0.5, `rgba(3, 5, 12, 1)`);
    gradient.addColorStop(1, `rgba(1, 2, 5, 1)`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        
        // Twinkle effect
        star.opacity += (Math.random() - 0.5) * 0.1;
        if(star.opacity < 0.1) star.opacity = 0.1;
        if(star.opacity > 1) star.opacity = 1;

        // Give some stars a teal tint for extraordinary UX
        if (star.radius > 1.2) {
            ctx.fillStyle = `rgba(0, 201, 167, ${star.opacity})`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(0, 201, 167, 0.8)';
        } else {
            ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
            ctx.shadowBlur = 0;
        }
        
        ctx.fill();

        // Move stars downwards naturally (Scroll down effect)
        // Adding extra speed based on scroll speed could be cool, but constant is smoother
        star.y += star.speed * 2; // Doubled speed for better feeling of movement
        
        // Wrap around
        if (star.y > height) {
            star.y = 0;
            star.x = Math.random() * width;
        }
    });

    requestAnimationFrame(drawStars);
}

// Handle Resize
window.addEventListener('resize', initCanvas);

// Handle Scroll
window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
});

// Initialization
initCanvas();
drawStars();
