/* ==========================================================
   ROMANTIC APOLOGY MOBILE WEB - INTERACTIVE SCRIPT
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const apologyView = document.getElementById('apology-view');
    const thankyouView = document.getElementById('thankyou-view');
    const btnYes = document.getElementById('btn-yes');
    const btnNo = document.getElementById('btn-no');
    const noText = document.getElementById('no-text');
    const btnReplay = document.getElementById('btn-replay');
    const musicToggle = document.getElementById('music-toggle');
    const musicIcon = document.getElementById('music-icon');
    
    /* ----------------------------------------------------------
       0. LOAD BASE64 EMBEDDED PHOTOS WITH HYBRID FALLBACK
       ---------------------------------------------------------- */
    const photoIds = ['photo1', 'photo2', 'photo3', 'photo4'];
    
    photoIds.forEach((pName, idx) => {
        const num = idx + 1;
        const mainImg = document.getElementById(`img-photo${num}`);
        const gridImg = document.getElementById(`grid-img-${num}`);

        let targetSrc = `image/photo${num}.jpg`;

        if (typeof PHOTO_DATA !== 'undefined' && PHOTO_DATA[pName]) {
            targetSrc = PHOTO_DATA[pName];
        }

        if (mainImg) mainImg.src = targetSrc;
        if (gridImg) gridImg.src = targetSrc;
    });

    // Photo Slideshow Elements
    const photos = document.querySelectorAll('.heart-photo');
    const dots = document.querySelectorAll('.dot');
    let currentPhotoIndex = 0;
    let photoInterval;

    // Runaway Button Texts
    const evasiveTexts = [
        "Eits ga bisa diklik 😜",
        "Masa ga dimaafin sih? 🥺",
        "Coba kejar kl bisa 🏃💨",
        "Yakin tega nih? 💔",
        "Pencet tombol merah aja 💖",
        "Hehehe kabuurr 🤪",
        "I love you, maafin dong! 🌹"
    ];
    let evasiveCount = 0;

    /* ----------------------------------------------------------
       1. HEART PHOTO SLIDESHOW LOGIC
       ---------------------------------------------------------- */
    function showPhoto(index) {
        photos.forEach((photo, i) => {
            photo.classList.toggle('active', i === index);
        });
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
        currentPhotoIndex = index;
    }

    function nextPhoto() {
        let nextIndex = (currentPhotoIndex + 1) % photos.length;
        showPhoto(nextIndex);
    }

    function startPhotoSlideshow() {
        photoInterval = setInterval(nextPhoto, 3000);
    }

    // Dot click listeners
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            clearInterval(photoInterval);
            showPhoto(index);
            startPhotoSlideshow();
        });
    });

    startPhotoSlideshow();

    /* ----------------------------------------------------------
       2. RUNAWAY "NGGAK / BELUM" BUTTON LOGIC
       ---------------------------------------------------------- */
    function moveNoButton(e) {
        if (e) e.preventDefault();

        // Get viewport and button dimensions
        const btnWidth = btnNo.offsetWidth || 130;
        const btnHeight = btnNo.offsetHeight || 44;
        
        const padding = 20;
        const maxX = window.innerWidth - btnWidth - padding;
        const maxY = window.innerHeight - btnHeight - padding;

        // Calculate random coordinates safely within visible viewport
        const randomX = Math.max(padding, Math.floor(Math.random() * maxX));
        const randomY = Math.max(padding, Math.floor(Math.random() * maxY));

        btnNo.classList.add('evading');
        btnNo.style.left = `${randomX}px`;
        btnNo.style.top = `${randomY}px`;

        // Update playful text
        evasiveCount = (evasiveCount + 1) % evasiveTexts.length;
        noText.textContent = evasiveTexts[evasiveCount];

        // Trigger light haptic vibration if supported
        if (navigator.vibrate) {
            navigator.vibrate(40);
        }
    }

    // Attach evasion event listeners for both mobile touch & desktop hover
    ['mouseenter', 'touchstart', 'pointerdown'].forEach(eventType => {
        btnNo.addEventListener(eventType, moveNoButton, { passive: false });
    });

    btnNo.addEventListener('click', moveNoButton);

    /* ----------------------------------------------------------
       3. "IYA, DIMAAFKAN" BUTTON & TRANSITION
       ---------------------------------------------------------- */
    btnYes.addEventListener('click', () => {
        // Trigger romantic music synthesis
        if (!audioContext) {
            initAudio();
        }
        playRomanticMelody();
        musicToggle.classList.add('playing');

        // Launch heart confetti fireworks
        triggerConfettiFireworks();

        // Smooth transition to Thank You screen
        apologyView.classList.remove('active');
        apologyView.classList.add('hidden');

        setTimeout(() => {
            thankyouView.classList.remove('hidden');
            thankyouView.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 300);
    });

    // Replay Button Action
    btnReplay.addEventListener('click', () => {
        thankyouView.classList.remove('active');
        thankyouView.classList.add('hidden');

        // Reset No button position
        btnNo.classList.remove('evading');
        btnNo.style.left = '';
        btnNo.style.top = '';
        noText.textContent = "Nggak / Belum 😜";

        setTimeout(() => {
            apologyView.classList.remove('hidden');
            apologyView.classList.add('active');
        }, 300);
    });

    /* ----------------------------------------------------------
       4. BACKGROUND FLOATING HEARTS CANVAS
       ---------------------------------------------------------- */
    const bgCanvas = document.getElementById('bg-canvas');
    const bgCtx = bgCanvas.getContext('2d');
    let hearts = [];

    function resizeCanvas() {
        bgCanvas.width = window.innerWidth;
        bgCanvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class HeartParticle {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * bgCanvas.width;
            this.y = bgCanvas.height + Math.random() * 50;
            this.size = Math.random() * 14 + 8;
            this.speedY = Math.random() * 1.2 + 0.6;
            this.speedX = Math.sin(Math.random() * Math.PI) * 0.8;
            this.opacity = Math.random() * 0.6 + 0.2;
            this.color = `hsla(${Math.random() * 40 + 330}, 100%, 70%, ${this.opacity})`;
            this.rotation = Math.random() * Math.PI * 2;
            this.rotSpeed = (Math.random() - 0.5) * 0.02;
        }

        update() {
            this.y -= this.speedY;
            this.x += Math.sin(this.y * 0.01) * 0.5;
            this.rotation += this.rotSpeed;

            if (this.y < -30) {
                this.reset();
            }
        }

        draw() {
            bgCtx.save();
            bgCtx.translate(this.x, this.y);
            bgCtx.rotate(this.rotation);
            bgCtx.fillStyle = this.color;
            
            // Draw Heart Shape
            bgCtx.beginPath();
            let topCurveHeight = this.size * 0.3;
            bgCtx.moveTo(0, topCurveHeight);
            bgCtx.bezierCurveTo(0, 0, -this.size / 2, 0, -this.size / 2, topCurveHeight);
            bgCtx.bezierCurveTo(-this.size / 2, (this.size + topCurveHeight) / 2, 0, this.size, 0, this.size);
            bgCtx.bezierCurveTo(0, this.size, this.size / 2, (this.size + topCurveHeight) / 2, this.size / 2, topCurveHeight);
            bgCtx.bezierCurveTo(this.size / 2, 0, 0, 0, 0, topCurveHeight);
            bgCtx.closePath();
            bgCtx.fill();

            bgCtx.restore();
        }
    }

    // Initialize 25 floating hearts
    for (let i = 0; i < 25; i++) {
        hearts.push(new HeartParticle());
    }

    function animateHearts() {
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        hearts.forEach(heart => {
            heart.update();
            heart.draw();
        });
        requestAnimationFrame(animateHearts);
    }

    animateHearts();

    /* ----------------------------------------------------------
       5. CONFETTI & FIREWORKS CANVAS LOGIC
       ---------------------------------------------------------- */
    const confettiCanvas = document.getElementById('confetti-canvas');
    const confettiCtx = confettiCanvas.getContext('2d');
    let confettiParticles = [];

    function resizeConfetti() {
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resizeConfetti);
    resizeConfetti();

    class Confetti {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.size = Math.random() * 12 + 6;
            this.speedX = (Math.random() - 0.5) * 12;
            this.speedY = (Math.random() - 0.7) * 14;
            this.gravity = 0.3;
            this.opacity = 1;
            this.color = `hsl(${Math.random() * 60 + 330}, 100%, 65%)`;
            this.rotation = Math.random() * Math.PI * 2;
        }

        update() {
            this.speedY += this.gravity;
            this.x += this.speedX;
            this.y += this.speedY;
            this.opacity -= 0.012;
        }

        draw() {
            if (this.opacity <= 0) return;
            confettiCtx.save();
            confettiCtx.translate(this.x, this.y);
            confettiCtx.rotate(this.rotation);
            confettiCtx.globalAlpha = Math.max(0, this.opacity);
            confettiCtx.fillStyle = this.color;

            // Draw Heart Confetti
            confettiCtx.beginPath();
            let h = this.size * 0.3;
            confettiCtx.moveTo(0, h);
            confettiCtx.bezierCurveTo(0, 0, -this.size / 2, 0, -this.size / 2, h);
            confettiCtx.bezierCurveTo(-this.size / 2, (this.size + h) / 2, 0, this.size, 0, this.size);
            confettiCtx.bezierCurveTo(0, this.size, this.size / 2, (this.size + h) / 2, this.size / 2, h);
            confettiCtx.bezierCurveTo(this.size / 2, 0, 0, 0, 0, h);
            confettiCtx.fill();
            confettiCtx.restore();
        }
    }

    function triggerConfettiFireworks() {
        confettiParticles = [];
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        for (let i = 0; i < 90; i++) {
            confettiParticles.push(new Confetti(centerX, centerY));
        }

        function animateConfetti() {
            confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
            let active = false;

            confettiParticles.forEach(p => {
                p.update();
                p.draw();
                if (p.opacity > 0) active = true;
            });

            if (active) {
                requestAnimationFrame(animateConfetti);
            }
        }

        animateConfetti();
    }

    /* ----------------------------------------------------------
       6. WEB AUDIO API SYNTHESIZER (ROMANTIC MELODY)
       ---------------------------------------------------------- */
    let audioContext = null;
    let isPlayingAudio = false;

    function initAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    function playNote(freq, duration, delay) {
        if (!audioContext) return;

        setTimeout(() => {
            try {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, audioContext.currentTime);

                gain.gain.setValueAtTime(0.001, audioContext.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.2, audioContext.currentTime + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

                osc.connect(gain);
                gain.connect(audioContext.destination);

                osc.start();
                osc.stop(audioContext.currentTime + duration);
            } catch (e) {
                console.log(e);
            }
        }, delay);
    }

    function playRomanticMelody() {
        initAudio();
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        isPlayingAudio = true;
        // Musical notes frequencies (C5, E5, G5, A5, B5, C6)
        const notes = [
            { f: 523.25, d: 0.6, t: 0 },    // C5
            { f: 659.25, d: 0.6, t: 400 },  // E5
            { f: 783.99, d: 0.8, t: 800 },  // G5
            { f: 880.00, d: 0.8, t: 1400 }, // A5
            { f: 987.77, d: 1.0, t: 2000 }, // B5
            { f: 1046.50, d: 1.4, t: 2600 } // C6
        ];

        notes.forEach(note => playNote(note.f, note.d, note.t));
    }

    musicToggle.addEventListener('click', () => {
        initAudio();
        if (isPlayingAudio) {
            isPlayingAudio = false;
            musicToggle.classList.remove('playing');
            musicIcon.textContent = "🔇";
        } else {
            playRomanticMelody();
            musicToggle.classList.add('playing');
            musicIcon.textContent = "🎵";
        }
    });
});
