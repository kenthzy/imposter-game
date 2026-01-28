// Data Lists
const categories = {
    movies: [
        "Titanic", "Avatar", "The Matrix", "Inception", "Frozen", "The Godfather", "Star Wars", "Jurassic Park", "Lion King", "Avengers",
        "Harry Potter", "Shrek", "Home Alone", "Spider-Man", "Frozen", "Forrest Gump", "Gladiator", "Interstellar", "Joker", "Coco"
    ],
    objects: [
        "Chair", "Laptop", "Umbrella", "Toothbrush", "Bicycle", "Headphones", "Clock", "Mirror", "Wallet", "Backpack",
        "Camera", "Guitar", "Spoon", "Pillow", "Key", "Shoe", "Book", "Candle", "Remote", "Glasses"
    ],
    places: [
        "Paris", "School", "Hospital", "Beach", "Library", "Space Station", "Zoo", "Museum", "Cinema", "Gym",
        "Airport", "Restaurant", "Park", "Supermarket", "Hotel", "Bank", "Farm", "Stadium", "Castle", "Subway"
    ],
    animals: [
        "Dog", "Cat", "Elephant", "Lion", "Penguin", "Giraffe", "Shark", "Eagle", "Monkey", "Kangaroo",
        "Tiger", "Bear", "Zebra", "Dolphin", "Panda", "Owl", "Snake", "Wolf", "Rabbit", "Crocodile"
    ],
    food: [
        "Pizza", "Sushi", "Burger", "Ice Cream", "Pasta", "Taco", "Salad", "Chocolate", "Apple", "Bread",
        "Steak", "Fries", "Soup", "Cake", "Cheese", "Popcorn", "Sandwich", "Rice", "Cookie", "Egg"
    ]
};

// State
let state = {
    players: 4,
    impostorCount: 1,
    spyCount: 0,
    timerDuration: 3 * 60, // seconds
    category: 'mixed',
    impostorIndices: [],
    spyIndices: [],
    currentTurn: 0,
    secretWord: '',
    timerInterval: null
};

// Sound Effects
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const Sound = {
    playTone: (freq, type, duration, delay = 0) => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        const now = audioCtx.currentTime + delay;
        osc.start(now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.00001, now + duration);
        osc.stop(now + duration);
    },
    
    reveal: () => {
        Sound.playTone(600, 'sine', 0.1);
        Sound.playTone(800, 'sine', 0.3, 0.1);
    },
    
    impostorReveal: () => {
        Sound.playTone(150, 'sawtooth', 0.8);
        Sound.playTone(100, 'sawtooth', 0.8, 0.2);
    },

    pass: () => {
        Sound.playTone(400, 'triangle', 0.1);
    },
    
    tick: () => {
        Sound.playTone(800, 'square', 0.05);
    },
    
    timeUp: () => {
        Sound.playTone(200, 'sawtooth', 0.5);
        Sound.playTone(150, 'sawtooth', 0.5, 0.4);
        Sound.playTone(100, 'sawtooth', 1.0, 0.8);
    }
};

// DOM Elements
const views = {
    setup: document.getElementById('setup-view'),
    pass: document.getElementById('pass-view'),
    reveal: document.getElementById('reveal-view'),
    discussion: document.getElementById('discussion-view'),
    gameOver: document.getElementById('game-over-view')
};

const inputs = {
    playerCount: document.getElementById('player-count'),
    playerCountDisplay: document.getElementById('player-count-display'),
    impostorCount: document.getElementById('impostor-count'),
    impostorCountDisplay: document.getElementById('impostor-count-display'),
    spyCount: document.getElementById('spy-count'),
    spyCountDisplay: document.getElementById('spy-count-display'),
    timerLength: document.getElementById('timer-length'),
    timerDisplay: document.getElementById('timer-display'),
    categoryBtns: document.querySelectorAll('.category-btn')
};

// Inputs Event Listeners
inputs.playerCount.addEventListener('input', (e) => {
    state.players = parseInt(e.target.value);
    inputs.playerCountDisplay.textContent = state.players;
    validateRoleCounts();
});

inputs.impostorCount.addEventListener('input', (e) => {
    state.impostorCount = parseInt(e.target.value);
    validateRoleCounts();
});

inputs.spyCount.addEventListener('input', (e) => {
    state.spyCount = parseInt(e.target.value);
    validateRoleCounts();
});

function validateRoleCounts() {
    const maxSpecial = Math.floor(state.players - 1); // At least one normal player
    
    // Adjust Impostors if too high
    if (state.impostorCount >= state.players) { // Simple guard
         state.impostorCount = Math.max(1, Math.floor(state.players / 3));
    }
    
    // Adjust Spy if total special roles exceed limit
    if (state.impostorCount + state.spyCount > maxSpecial) {
        state.spyCount = Math.max(0, maxSpecial - state.impostorCount);
    }

    // Update UI
    inputs.impostorCount.value = state.impostorCount;
    inputs.impostorCountDisplay.textContent = state.impostorCount;
    
    inputs.spyCount.value = state.spyCount;
    inputs.spyCountDisplay.textContent = state.spyCount;
    
    inputs.impostorCount.max = Math.max(1, state.players - 1);
    inputs.spyCount.max = Math.max(0, state.players - 1);
}

inputs.timerLength.addEventListener('input', (e) => {
    const mins = parseInt(e.target.value);
    state.timerDuration = mins * 60;
    inputs.timerDisplay.textContent = `${mins} min`;
});

inputs.categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        inputs.categoryBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.category = btn.dataset.cat;
    });
});

// View Navigation
function switchView(viewName) {
    Object.values(views).forEach(el => el.classList.remove('active'));
    views[viewName].classList.add('active');
}

// Game Logic
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('reveal-btn').addEventListener('click', showRole);
document.getElementById('next-player-btn').addEventListener('click', finishTurn);
document.getElementById('restart-btn').addEventListener('click', resetGame);
document.getElementById('end-timer-early-btn').addEventListener('click', () => {
    clearInterval(state.timerInterval);
    endGame();
});


function startGame() {
    // 1. Pick Impostors
    state.impostorIndices = [];
    while (state.impostorIndices.length < state.impostorCount) {
        const r = Math.floor(Math.random() * state.players);
        if (!state.impostorIndices.includes(r)) {
            state.impostorIndices.push(r);
        }
    }

    // 2. Pick Spies
    state.spyIndices = [];
    while (state.spyIndices.length < state.spyCount) {
        const r = Math.floor(Math.random() * state.players);
        if (!state.impostorIndices.includes(r) && !state.spyIndices.includes(r)) {
            state.spyIndices.push(r);
        }
    }
    
    // 3. Pick Word
    let wordList = [];
    if (state.category === 'mixed') {
        Object.values(categories).forEach(arr => wordList.push(...arr));
    } else {
        wordList = categories[state.category];
    }
    state.secretWord = wordList[Math.floor(Math.random() * wordList.length)];

    // 3. Reset Turn
    state.currentTurn = 0;

    // 4. Update UI
    updatePassScreen();
    switchView('pass');
}

function updatePassScreen() {
    const playerNum = state.currentTurn + 1;
    document.getElementById('pass-player-text').textContent = `Pass phone to Player ${playerNum}`;
}

function showRole() {
    const isImpostor = state.impostorIndices.includes(state.currentTurn);
    const isSpy = state.spyIndices.includes(state.currentTurn);
    
    const roleTitle = document.getElementById('role-title');
    const secretWordEl = document.getElementById('secret-word');
    const roleDesc = document.getElementById('role-description');
    const roleIcon = document.getElementById('role-icon-display');

    // Reset Classes
    secretWordEl.className = '';
    roleIcon.className = 'fas'; // keep base
    
    // Play generic sound for everyone to prevent role leaking
    Sound.reveal();

    if (isImpostor) {
        roleTitle.textContent = "SECRET ROLE";
        secretWordEl.textContent = "IMPOSTOR";
        secretWordEl.classList.add('impostor-text');
        roleIcon.classList.add('fa-user-secret', 'impostor-icon');
        roleDesc.textContent = "Blend in. Don't let them know you don't know the word.";
    } else if (isSpy) {
        roleTitle.textContent = "SECRET ROLE";
        secretWordEl.textContent = "SPY";
        secretWordEl.classList.add('spy-text');
        roleIcon.classList.add('fa-user-ninja', 'spy-icon');
        roleDesc.textContent = `You are the Spy! Category: ${formatCategory(state.category)}. You don't know the word.`;
    } else {
        roleTitle.textContent = "SECRET WORD";
        secretWordEl.textContent = state.secretWord;
        roleIcon.classList.add('fa-key');
        roleDesc.textContent = `Topic: ${formatCategory(state.category)}`;
    }

    switchView('reveal');
}

function finishTurn() {
    Sound.pass();
    state.currentTurn++;

    if (state.currentTurn >= state.players) {
        startDiscussion();
    } else {
        updatePassScreen();
        switchView('pass');
    }
}

function startDiscussion() {
    switchView('discussion');
    let timeLeft = state.timerDuration;
    const countdownEl = document.getElementById('countdown');
    const timerCircle = document.querySelector('.timer-circle');
    
    timerCircle.classList.add('timer-running');
    updateTimerDisplay(timeLeft, countdownEl);

    if (timeLeft <= 10) Sound.tick();

    state.timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(timeLeft, countdownEl);

        if (timeLeft <= 10 && timeLeft > 0) {
            Sound.tick();
        }

        if (timeLeft <= 0) {
            clearInterval(state.timerInterval);
            timerCircle.classList.remove('timer-running');
            endGame();
        }
    }, 1000);
}

function updateTimerDisplay(seconds, element) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    element.textContent = `${m}:${s}`;
}

function endGame() {
    const timerCircle = document.querySelector('.timer-circle');
    if (timerCircle) timerCircle.classList.remove('timer-running');
    
    // Play Buzzer
    Sound.timeUp();

    // Impostors
    const impostorNames = state.impostorIndices
        .map(i => `Player ${i + 1}`)
        .join(', ');
    document.getElementById('reveal-impostor-player').textContent = impostorNames;

    // Spies
    const spySection = document.getElementById('spy-result-section');
    if (state.spyIndices.length > 0) {
        spySection.style.display = 'block';
        const spyNames = state.spyIndices
             .map(i => `Player ${i + 1}`)
             .join(', ');
        document.getElementById('reveal-spy-player').textContent = spyNames;
    } else {
        spySection.style.display = 'none';
    }
        
    document.getElementById('reveal-word').textContent = state.secretWord;
    
    // Play sound or vibration could go here
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

    switchView('gameOver');
}

function resetGame() {
    clearInterval(state.timerInterval);
    switchView('setup');
}

function formatCategory(cat) {
    return cat.charAt(0).toUpperCase() + cat.slice(1);
}
