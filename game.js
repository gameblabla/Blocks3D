import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

const supportsXR = 'xr' in window.navigator;

// Initialize variables
let scene, camera, renderer;
let wellSize = {
    x: 6,
    y: 12,
    z: 6
}; // Smaller square playfield
let well = []; // 3D array representing the well
let currentPiece, shadowPiece, nextPiece;
let blockSize = 1;
let baseFallingSpeed = 0.005; // Slower initial falling speed
let fallingSpeed = baseFallingSpeed;
let gameOver = false;
let score = 0;
let layersCleared = 0;
let level = 1;
let isFastDropping = false;
let rotationQueue = [];
let isRotating = false; // New variable to track rotation state
let rotationCooldown = 0;
let piecesPlaced = 0; // Counter for pieces placed
let highScore = 0;

let totalResources = 0;
let resourcesLoaded = 0;

let backgroundMesh, backgroundGeometry, backgroundMaterial;
let clock;

// Game state variables
let gameState = 'title'; // 'title', 'menu', 'game', 'gameover', 'story'

// Game mode variables
let gameMode = 'arcade'; // 'arcade' or 'story'

// Define game actions
const gameActions = [
    'Left',
    'Right',
    'Forward',
    'Backward',
    'Rotate X Positive',
    'Rotate X Negative',
    'Rotate Y Positive',
    'Rotate Y Negative',
    'Rotate Z Positive',
    'Rotate Z Negative',
    'Fast Drop',
    'Drop Piece',
    'Confirm',
    'Cancel'
];

// Default key bindings
const defaultKeyBindings = {
    'Left': 'ArrowLeft',
    'Right': 'ArrowRight',
    'Forward': 'ArrowUp',
    'Backward': 'ArrowDown',
    'Rotate Y Negative': 'KeyQ', // Rotate left around Y-axis
    'Rotate Y Positive': 'KeyE', // Rotate right around Y-axis
    'Rotate X Negative': 'KeyA', // Rotate left around X-axis
    'Rotate X Positive': 'KeyD', // Rotate right around X-axis
    'Rotate Z Negative': 'KeyW', // Rotate left around Z-axis
    'Rotate Z Positive': 'KeyS', // Rotate right around Z-axis
    'Fast Drop': 'KeyF',
    'Drop Piece': 'Space',
    'Confirm': 'Enter',
    'Cancel': 'Escape'
};

let keyBindings = {}; // To store current key bindings
let keyToActionMap = {}; // Reverse map for quick lookup

let keyConfigOptions = gameActions; // Use the game actions defined earlier
let selectedKeyConfigOption = 0;
let waitingForKeyBinding = false;

// Story mode variables
let storySegments = [{
        text: [
            "Hey! I bet I can beat you at this puzzle game today!",
            "Don't worry, I'll share a few tricks along the way.\nJust know I'm not going easy on you."
        ],
        background: "images/background1.png",
        character1: "images/character1.png",
        character2: "images/player.png",
        opponentHP: 25,
        timeLimit: 90,
        storyMusic: 'story1',
        gameMusic: 'game1'
    },
    {
        text: [
            "Well, well! Ready to get schooled? I may not be the best, but I’m no beginner either.",
            "Bring on the next round!"
        ],
        background: "images/background2.png",
        character1: "images/character2.png",
        character2: "images/player.png",
        opponentHP: 50,
        timeLimit: 140,
        storyMusic: 'story2',
        gameMusic: 'game2'
    },
    {
        text: [
            "I’ve heard of you, Boy. But reputation means nothing here.",
            "Understand this ——I don’t play for fun, and I certainly don’t lose.",
            "Only one of us leaves this game victorious, and I have no intention of it being you."
        ],
        background: "images/background3.png",
        character1: "images/character3.png",
        character2: "images/player.png",
        opponentHP: 75,
        timeLimit: 200,
        storyMusic: 'story3',
        gameMusic: 'game3'
    },
    {
        text: ["Congratulations!", "You've completed your journey!"],
        background: "images/background3.png",
        character1: "images/character3.png",
        character2: "images/player.png",
        opponentHP: 0,
        timeLimit: 0
    }
];

let currentStorySegment = 0;
let opponentHP = 100;
let timeRemaining = 120;
let initialTimeLimit = 120;

// Typewriter effect variables
let currentLine = 0;
let currentCharIndex = 0;
let isTyping = false;
let typewriterInterval;

// Mouse controls
let isMouseDown = false;
let prevMouse = {
    x: 0,
    y: 0
};
let rotationSpeed = 0.005;
let verticalAngle = Math.PI / 4; // Initial vertical angle
let minVerticalAngle = 0.1; // Can't look below horizontal
let maxVerticalAngle = Math.PI / 2 - 0.1; // Can't look directly down
let horizontalAngle = 0; // Initial horizontal angle

// Smooth rotation variables
let targetRotation = {
    x: 0,
    y: 0,
    z: 0
};
let rotationStep = Math.PI / 20; // Controls the smoothness of rotation

// Screen shake variables
let shakeDuration = 0;
let shakeIntensity = 0;

// Font for 3D text
let font;

// Label group
let labelGroup;

// Menu variables
let menuOptions = ['Story Mode', 'Arcade Mode', 'Reconfigure Keys'];
let selectedOption = 0;

// Audio variables
let bgm; // Background music
let sfx; // Sound effects
let voiceOver; // Voice overs
let introMusic; // Intro music
let allResourcesLoadedCalled = false;

init();
//animate();
renderer.setAnimationLoop(animate);


function init() {
    // Show the loading screen
    document.getElementById('loading-screen').style.display = 'flex';

    // Initialize audio
    initAudio();

    // Count the total number of resources to load
    countTotalResources();

    // Load font
    loadFont();

    // Preload images
    preloadImages();

    // Preload videos
    preloadVideos();

    clock = new THREE.Clock();

    // Add event listeners
    addEventListeners();

    loadKeyBindings();
    
    // Create VR button only if WebXR Is poss
    if (supportsXR)
	{
		document.body.appendChild( VRButton.createButton( renderer ) );
	}

    // Set up the scene
    scene = new THREE.Scene();

    // Set up the camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Improved default viewpoint
    let centerX = (wellSize.x * blockSize) / 2 - blockSize / 2;
    let centerY = (wellSize.y * blockSize) / 2 - blockSize / 2;
    let centerZ = (wellSize.z * blockSize) / 2 - blockSize / 2;

    let radius = 20; // Distance from the center
    updateCameraPosition();

    // Set up the renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    
    document.body.appendChild( getFullscreenButton( renderer ) );
    
    if (supportsXR)
    {
		renderer.xr.enabled = true;
	}
	else
	{
		// Reference to the fullscreen button
		const fullscreenButton = document.getElementById('fullscreen-button');

		// Function to hide the fullscreen button with transition
		function hideFullscreenButton() {
			fullscreenButton.classList.add('hidden');
			fullscreenButton.classList.remove('visible');
		}

		// Function to show the fullscreen button with transition
		function showFullscreenButton() {
			fullscreenButton.classList.add('visible');
			fullscreenButton.classList.remove('hidden');
		}

		// Initialize the button as visible
		fullscreenButton.classList.add('visible');

		// Listen for fullscreen change events
		document.addEventListener('fullscreenchange', () => {
			if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
				hideFullscreenButton();
			} else {
				showFullscreenButton();
			}
		});
	}
}


function getFullscreenButton(renderer) {
    var button = document.createElement('button');
    button.id = 'fullscreen-button'; // Assign an ID for easy reference
    button.style.position = 'absolute';
    button.style.right = '20px';
    button.style.bottom = '20px';
    button.style.width = '100px';
    button.style.border = '0';
    button.style.padding = '8px';
    button.style.cursor = 'pointer';
    button.style.backgroundColor = '#000';
    button.style.color = '#fff';
    button.style.fontFamily = 'sans-serif';
    button.style.fontSize = '13px';
    button.style.fontStyle = 'normal';
    button.style.textAlign = 'center';
    button.style.zIndex = '999';
    button.textContent = 'FULLSCREEN';
    
    button.onclick = function() {
        let fullscreenElement = document.getElementById('main-container');
        if (!document.fullscreenElement) {
            if (fullscreenElement.requestFullscreen) {
                fullscreenElement.requestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    return button;
}




function loadKeyBindings() {
    let storedBindings = localStorage.getItem('keyBindings');
    if (storedBindings) {
        keyBindings = JSON.parse(storedBindings);
    } else {
        keyBindings = {
            ...defaultKeyBindings
        };
    }
    buildKeyToActionMap();
}

function saveKeyBindings() {
    localStorage.setItem('keyBindings', JSON.stringify(keyBindings));
}

function buildKeyToActionMap() {
    keyToActionMap = {};
    for (let action in keyBindings) {
        keyToActionMap[keyBindings[action]] = action;
    }
}


function addEventListeners() {
    // Add event listeners
    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('keydown', onDocumentKeyDown, false);
    document.addEventListener('keyup', onDocumentKeyUp, false);
    document.addEventListener('mousedown', onDocumentMouseDown, false);
    document.addEventListener('mousemove', onDocumentMouseMove, false);
    document.addEventListener('mouseup', onDocumentMouseUp, false);
}

function loadFont() {
    let fontLoader = new FontLoader();
    fontLoader.load(
        'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
        function(loadedFont) {
            font = loadedFont;
            resourceLoaded(); // Call when font is loaded
        },
        undefined,
        function(err) {
            console.error('An error happened while loading the font.');
        }
    );
}


function preloadImages() {
    storySegments.forEach(segment => {
        if (segment.background) {
            let img = new Image();
            img.src = segment.background;
            img.onload = resourceLoaded;
        }
        if (segment.character1) {
            let img = new Image();
            img.src = segment.character1;
            img.onload = resourceLoaded;
        }
        if (segment.character2) {
            let img = new Image();
            img.src = segment.character2;
            img.onload = resourceLoaded;
        }
    });
}


function preloadVideos() {
    const introVideo = document.getElementById('intro-video');
    introVideo.addEventListener('loadeddata', resourceLoaded, {
        once: true
    });

    const cutsceneVideo = document.getElementById('cutscene-video');
    cutsceneVideo.addEventListener('loadeddata', resourceLoaded, {
        once: true
    });
}



function resourceLoaded() {
    resourcesLoaded++;
    console.log(`Resource Loaded: ${resourcesLoaded}/${totalResources}`);
    updateLoadingBar();

    if (resourcesLoaded >= totalResources && !allResourcesLoadedCalled) {
        allResourcesLoadedCalled = true;
        console.log('All resources loaded. Calling onAllResourcesLoaded()');
        onAllResourcesLoaded();
    }
}

function updateLoadingBar() {
    let percentage = Math.round((resourcesLoaded / totalResources) * 100);
    let loadingBar = document.getElementById('loading-bar');
    loadingBar.style.width = percentage + '%';
}


function onAllResourcesLoaded() {
    // Hide the loading screen
    document.getElementById('loading-screen').style.display = 'none';

    // Proceed to play the intro
    playIntro();
}


function countTotalResources() {
    totalResources = 0; // Initialize to zero

    // Count fonts
    totalResources += 1;

    // Count audio files
    for (let key in bgm) {
        if (Array.isArray(bgm[key])) {
            totalResources += bgm[key].length;
        } else if (bgm[key] instanceof Howl) {
            totalResources += 1;
        } else if (typeof bgm[key] === 'object') {
            for (let subKey in bgm[key]) {
                if (bgm[key][subKey] instanceof Howl) {
                    totalResources += 1;
                }
            }
        }
    }

    for (let segment in voiceOver) {
        totalResources += voiceOver[segment].length;
    }

    // Count images in story segments
    storySegments.forEach(segment => {
        if (segment.background) totalResources += 1;
        if (segment.character1) totalResources += 1;
        if (segment.character2) totalResources += 1;
    });


    console.log(`Total Resources to Load: ${totalResources}`);
}



function initAudio() {
    // Background music
    bgm = {
        title: new Howl({
            src: ['audio/title.mp3'],
            loop: true,
            onload: resourceLoaded
        }),
        menu: new Howl({
            src: ['audio/menu.mp3'],
            loop: true,
            onload: resourceLoaded
        }),
        story: new Howl({
            src: ['audio/default_story.mp3'],
            loop: true,
            onload: resourceLoaded
        }),
        game: [
            new Howl({
                src: ['audio/default_game1.mp3'],
                loop: true,
                onload: resourceLoaded
            }),
            new Howl({
                src: ['audio/default_game2.mp3'],
                loop: true,
                onload: resourceLoaded
            })
        ],
        win: new Howl({
            src: ['audio/win.mp3'],
            loop: false,
            volume: 0.7,
            onload: resourceLoaded
        }),

        // New properties for specific tracks
        storyTracks: {
            story1: new Howl({
                src: ['audio/story1_music.mp3'],
                loop: true,
                volume: 0.25,
                onload: resourceLoaded
            }),
            story2: new Howl({
                src: ['audio/story2_music.mp3'],
                loop: true,
                volume: 0.25,
                onload: resourceLoaded
            }),
            story3: new Howl({
                src: ['audio/story3_music.mp3'],
                loop: true,
                volume: 0.25,
                onload: resourceLoaded
            }),
            // Add more story tracks as needed
        },
        gameTracks: {
            game1: new Howl({
                src: ['audio/game1.mp3'],
                loop: true,
                onload: resourceLoaded
            }),
            game2: new Howl({
                src: ['audio/game2.mp3'],
                loop: true,
                onload: resourceLoaded
            }),
            game3: new Howl({
                src: ['audio/game3.mp3'],
                loop: true,
                onload: resourceLoaded
            }),
        }
    };

    // Sound effects (no changes needed here)
    sfx = {
        clearLine: new Howl({
            src: ['audio/clearline.mp3'],
            onload: resourceLoaded
        }),
        rotate: new Howl({
            src: ['audio/rotate.mp3'],
            onload: resourceLoaded
        }),
        move: new Howl({
            src: ['audio/move.mp3'],
            onload: resourceLoaded
        }),
        drop: new Howl({
            src: ['audio/drop.mp3'],
            onload: resourceLoaded
        }),
        explosion: new Howl({
            src: ['audio/explosion.mp3'],
            onload: resourceLoaded
        })
    };

    // Voice overs
    voiceOver = {
        segment0: [
            new Howl({
                src: ['audio/story1_v1.mp3'],
                onload: resourceLoaded
            }),
            new Howl({
                src: ['audio/story1_v2.mp3'],
                onload: resourceLoaded
            })
        ],
        segment1: [
            new Howl({
                src: ['audio/story2_v1.mp3'],
                onload: resourceLoaded
            }),
            new Howl({
                src: ['audio/story2_v2.mp3'],
                onload: resourceLoaded
            })
        ],
        segment2: [
            new Howl({
                src: ['audio/story3_v1.mp3'],
                onload: resourceLoaded
            }),
            new Howl({
                src: ['audio/story3_v2.mp3'],
                onload: resourceLoaded
            }),
            new Howl({
                src: ['audio/story3_v3.mp3'],
                onload: resourceLoaded
            })
        ],
        // Add more segments as needed
    };

    // Winning music
    bgm.win = new Howl({
        src: ['audio/win.mp3'],
        loop: false,
        volume: 0.7,
        onload: resourceLoaded
    });

    // Intro music
    introMusic = new Howl({
        src: ['audio/intromusic.mp3'],
        loop: true,
        volume: 0.5,
        onload: resourceLoaded
    });
}

let introMusicPlayed = false;

function playIntro() {
    console.log('playIntro() called');

    if (!introMusicPlayed) {
        introMusicPlayed = true;
        introMusic.play();
    } else {
        console.log('introMusic.play() was already called');
    }

    // Set 'overlay' to title screen content
    let overlay = document.getElementById('overlay');
    overlay.innerHTML = `
				<img src="images/title.png" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;z-index:-1;">
				<p id="press-start" class="blinking" style="font-size: 48px; color: #ffffff; text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000;">Press Any Key to Start</p>
			`;
    overlay.classList.remove('hidden'); // Ensure overlay is visible


    let introVideo = document.getElementById('intro-video');
    introVideo.classList.remove('hidden'); // Ensure it's visible
    introVideo.style.opacity = 1; // Reset opacity in case it's been changed before
    introVideo.play();

    // Flag to ensure fade-out starts only once
    let hasFadedOut = false;

    // Define the onTimeUpdate handler
    function onTimeUpdate() {
        if (!hasFadedOut && (introVideo.duration - introVideo.currentTime) <= 2) {
            hasFadedOut = true;
            introVideo.style.opacity = 0; // Start fade-out
        }
    }

    // Define the onTransitionEnd handler
    function onTransitionEnd() {
        if (hasFadedOut) {
            introVideo.classList.add('hidden'); // Hide video after fade-out
            introVideo.style.opacity = 1; // Reset opacity for future plays
            introVideo.removeEventListener('timeupdate', onTimeUpdate);
            introVideo.removeEventListener('transitionend', onTransitionEnd);
            // Now the title screen is visible behind the faded-out video
            // Allow user to press any key to start
            setupTitleScreenKeyListener();
        }
    }

    // Attach event listeners
    introVideo.addEventListener('timeupdate', onTimeUpdate);
    introVideo.addEventListener('transitionend', onTransitionEnd);
}

function setupTitleScreenKeyListener() {
    let overlay = document.getElementById('overlay');
    let pressStart = document.getElementById('press-start');

    // Ensure blinking effect is active
    pressStart.classList.add('blinking');

    // Start game on key press
    function onStartKey(event) {
        // Only respond to key presses if in title state
        if (gameState === 'title') {
            document.removeEventListener('keydown', onStartKey);
            pressStart.style.visibility = 'visible'; // Ensure it's visible
            showMainMenu();
        }
    }
    document.addEventListener('keydown', onStartKey);
}

function playBGM(type, trackName) {
    // Stop all music
    stopAllBGM();

    if (type === 'game') {
        if (trackName && bgm.gameTracks && bgm.gameTracks[trackName]) {
            bgm.gameTracks[trackName].play();
        } else {
            // Randomly select a game music track
            let randomIndex = Math.floor(Math.random() * bgm.game.length);
            bgm.game[randomIndex].play();
        }
    } else if (type === 'story') {
        if (trackName && bgm.storyTracks && bgm.storyTracks[trackName]) {
            bgm.storyTracks[trackName].play();
        } else {
            bgm[type].play();
        }
    } else {
        if (bgm[type]) {
            bgm[type].play();
        }
    }
}


function stopAllBGM() {
    introMusic.stop();

    for (let key in bgm) {
        if (Array.isArray(bgm[key])) {
            bgm[key].forEach(track => track.stop());
        } else if (bgm[key] instanceof Howl) {
            bgm[key].stop();
        } else if (typeof bgm[key] === 'object') {
            // For 'storyTracks' and 'gameTracks'
            for (let subKey in bgm[key]) {
                if (bgm[key][subKey] instanceof Howl) {
                    bgm[key][subKey].stop();
                }
            }
        }
    }
}

function playSFX(effect) {
    if (sfx[effect]) {
        sfx[effect].play();
    }
}

function playVoiceOver(segmentIndex, lineIndex) {
    let segmentKey = 'segment' + segmentIndex;
    if (voiceOver[segmentKey] && voiceOver[segmentKey][lineIndex]) {
        if (lineIndex > 0) {
            voiceOver[segmentKey][lineIndex - 1].stop();
        }
        voiceOver[segmentKey][lineIndex].play();
    }
}

function showTitleScreen() {
    // Clear the scene
    clearScene();

    // Set game state
    gameState = 'title';

    // Play title screen music
    //playBGM('title');

    // Add a background image
    let overlay = document.getElementById('overlay');
    overlay.innerHTML = '<img src="images/title.png" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;z-index:-1;">' +
        '<p id="press-start" style="font-size: 48px; color: #ffffff; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;">Press Any Key to Start</p>';
    overlay.classList.remove('hidden');

    // Blinking text effect
    let pressStart = document.getElementById('press-start');
    let blinkInterval = setInterval(() => {
        if (pressStart) {
            pressStart.style.visibility = (pressStart.style.visibility === 'hidden') ? 'visible' : 'hidden';
        }
    }, 500);

    // Start game on key press
    function onStartKey() {
        document.removeEventListener('keydown', onStartKey);
        clearInterval(blinkInterval);
        showMainMenu();
    }
    document.addEventListener('keydown', onStartKey);
}

function showMainMenu() {
    // Clear the scene
    clearScene();

    // Set game state
    gameState = 'menu';

    // Play menu music
    playBGM('menu');

    // Overlay menu options
    let overlay = document.getElementById('overlay');
    overlay.innerHTML = '<h1>Main Menu</h1><ul id="menu-options"></ul>';
    overlay.classList.remove('hidden');

    let menuOptionsList = document.getElementById('menu-options');
    menuOptionsList.style.listStyleType = 'none';
    menuOptionsList.style.padding = 0;

    for (let i = 0; i < menuOptions.length; i++) {
        let option = document.createElement('li');
        option.innerText = menuOptions[i];
        option.style.fontSize = '32px';
        option.style.margin = '10px 0';
        option.style.cursor = 'pointer';
        if (i === selectedOption) {
            option.style.color = '#FFD700'; // Highlight selected option
        }
        menuOptionsList.appendChild(option);
    }

    updateMenuSelection();
}


function updateMenuSelection() {
    let menuOptionsList = document.getElementById('menu-options');
    for (let i = 0; i < menuOptionsList.children.length; i++) {
        let option = menuOptionsList.children[i];
        if (i === selectedOption) {
            option.style.color = '#FFD700';
        } else {
            option.style.color = '#FFFFFF';
        }
    }
}

function startArcadeMode() {
    // Start the game
    initGame('arcade');
}

function startStoryMode() {
    // Initialize variables
    currentStorySegment = 0;
    showStorySegment();
}

function stopAllSFX() {
    if (sfx && typeof sfx === 'object') {
        for (let key in sfx) {
            if (sfx.hasOwnProperty(key) && typeof sfx[key].stop === 'function') {
                sfx[key].stop();
            }
        }
    }
}

function stopAllVoiceOver() {
    for (let segment in voiceOver) {
        voiceOver[segment].forEach(sound => {
            sound.stop();
        });
    }
}

function animateCharactersIn(callback) {
    let character1 = document.getElementById('character1');
    let character2 = document.getElementById('character2');
    let startTime = null;
    let duration = 1000; // Animation duration in milliseconds

    function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        let elapsed = timestamp - startTime;
        let progress = Math.min(elapsed / duration, 1);

        // Update positions using delta time
        character1.style.left = (-30 + 30 * progress) + '%';
        character2.style.right = (-30 + 30 * progress) + '%';

        if (elapsed < duration) {
            requestAnimationFrame(animate);
        } else {
            // Animation finished
            // Show the semi-transparent background behind the text
            let storyTextBackground = document.getElementById('story-text-background');
            storyTextBackground.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';

            if (callback) callback();
        }
    }

    requestAnimationFrame(animate);
}

function showStorySegment() {
    // Clear the scene
    clearScene();

    // Set game state
    gameState = 'story';

    // Declare 'segment' before using it
    let segment = storySegments[currentStorySegment];

    // Now you can safely use 'segment'
    if (segment.storyMusic) {
        playBGM('story', segment.storyMusic);
    } else {
        playBGM('story'); // Play default story music
    }

    // Hide or remove the story text background
    let storyTextBackground = document.getElementById('story-text-background');
    if (storyTextBackground) {
        storyTextBackground.style.display = 'block'; // Show the text box
    }

    // Display the current story segment
    let overlay = document.getElementById('overlay');

    // Initialize text variables
    currentLine = 0;
    currentCharIndex = 0;
    isTyping = false;

    // Create HTML content with characters starting offscreen
    overlay.innerHTML = `
        <div id="story-content" style="position: relative; width: 100%; height: 100%;">
            <img id="background" src="${segment.background || 'default-background.jpg'}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;z-index:-1;">
            <img id="character1" src="${segment.character1}" style="width: 30%; position: absolute; left: -30%; bottom: 0;">
            <img id="character2" src="${segment.character2}" style="width: 30%; position: absolute; right: -30%; bottom: 0;">
            <div id="story-text">
                <div id="story-text-background">
                    <!-- Text will be inserted here -->
                </div>
            </div>
        </div>
    `;

    overlay.classList.remove('hidden');

    // Animate characters in
    animateCharactersIn(function() {
        // After characters have finished appearing onscreen, start typing the first line
        typeNextLine();
    });

    // Proceed to next line or gameplay on key press
    function onStoryKey(event) {
        if (event.keyCode === 13 || event.keyCode === 32) { // Enter or Space
            if (isTyping) {
                // Finish current line instantly
                finishTypingCurrentLine();
            } else {
                currentLine++;
                if (currentLine < segment.text.length) {
                    typeNextLine();
                } else {
                    stopAllSFX();
                    stopAllVoiceOver();

                    // All lines done, proceed
                    document.removeEventListener('keydown', onStoryKey);
                    overlay.classList.add('hidden');
                    if (currentStorySegment === 2) { // After the third story segment
                        playCutsceneVideo(() => {
                            startStoryGameplay(); // Start the next game round after the cutscene
                        });
                    } else {
                        startStoryGameplay(); // Start the next game round immediately
                    }
                }
            }
        }
    }
    document.addEventListener('keydown', onStoryKey);
}

function typeNextLine() {
    let segment = storySegments[currentStorySegment];
    let text = segment.text[currentLine];
    currentCharIndex = 0;
    isTyping = true;
    let storyTextDiv = document.getElementById('story-text-background');
    // Remove the line that clears the previous text
    // storyTextDiv.innerHTML = ''; // Comment out or remove this line

    // Play voice-over if available
    playVoiceOver(currentStorySegment, currentLine);

    // Start typewriter effect
    typewriterInterval = setInterval(() => {
        // Overwrite the text content with the new text up to currentCharIndex
        storyTextDiv.innerText = text.substring(0, currentCharIndex + 1);
        currentCharIndex++;
        if (currentCharIndex >= text.length) {
            clearInterval(typewriterInterval);
            isTyping = false;
        }
    }, 16); // Approximately one character per frame at 60fps
}

function finishTypingCurrentLine() {
    let segment = storySegments[currentStorySegment];
    let text = segment.text[currentLine];
    clearInterval(typewriterInterval);
    let storyTextDiv = document.getElementById('story-text-background');
    storyTextDiv.innerText = text;
    isTyping = false;
}

function startStoryGameplay() {

    // Initialize opponent HP and time limit from current story segment
    let segment = storySegments[currentStorySegment];
    opponentHP = segment.opponentHP;
    timeRemaining = segment.timeLimit;

    // Start the game
    initGame('story');

    // Hide or remove the story text background
    let storyTextBackground = document.getElementById('story-text-background');
    if (storyTextBackground) {
        storyTextBackground.style.display = 'none'; // Hide the text box
    }
}

function showStoryConclusion() {
    // Display the final story segment
    let segment = storySegments[currentStorySegment];

    let overlay = document.getElementById('overlay');

    // Initialize text variables
    currentLine = 0;
    currentCharIndex = 0;
    isTyping = false;

    // Create HTML content
    overlay.innerHTML = `
				<div id="story-content" style="position: relative; width: 100%; height: 100%;">
					<img src="${segment.background || 'default-background.jpg'}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;z-index:-1;">
					<img src="${segment.character1}" style="width: 30%; position: absolute; left: 0; bottom: 0;">
					<img src="${segment.character2}" style="width: 30%; position: absolute; right: 0; bottom: 0;">
					<div id="story-text" style="position: absolute; bottom: 10%; width: 80%; left:10%; text-align: center; color: #fff; font-size: 24px;">
					</div>
				</div>
			`;

    overlay.classList.remove('hidden');

    // Start typing the first line
    typeNextLine();

    // Proceed to winning screen on key press
    function onStoryEndKey(event) {
        if (event.keyCode === 13 || event.keyCode === 32) { // Enter or Space
            if (isTyping) {
                // Finish current line instantly
                finishTypingCurrentLine();
            } else {
                currentLine++;
                if (currentLine < segment.text.length) {
                    typeNextLine();
                } else {
                    // All lines done, proceed to winning screen
                    document.removeEventListener('keydown', onStoryEndKey);
                    overlay.classList.add('hidden');
                    showWinningScreen(); // Invoke the winning screen
                }
            }
        }
    }
    document.addEventListener('keydown', onStoryEndKey);
}

function initGame(mode) {
    // Clear the scene
    clearScene();

    // Set game state
    gameState = 'game';

    // Set game mode
    gameMode = mode;

    // Play game music
    if (gameMode === 'story') {
        let segment = storySegments[currentStorySegment];
        if (segment.gameMusic) {
            playBGM('game', segment.gameMusic);
        } else {
            playBGM('game'); // Play default game music
        }
    } else {
        playBGM('game'); // Play default game music
    }

    // Hide overlay
    let overlay = document.getElementById('overlay');
    overlay.classList.add('hidden');

    // Show score and next piece
    document.getElementById('score').style.display = 'block';
    document.getElementById('next-piece').style.display = 'block';

    if (gameMode === 'story') {
        // Show opponent HP and time remaining
        document.getElementById('opponent-hp').style.display = 'block';
        document.getElementById('time-remaining').style.display = 'block';
    } else {
        document.getElementById('opponent-hp').style.display = 'none';
        document.getElementById('time-remaining').style.display = 'none';
    }

    // Add skybox/dynamic background
    addDynamicBackground();

    // Set up lighting
    let light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 20, 10).normalize();
    scene.add(light);

    // Initialize the well
    for (let x = 0; x < wellSize.x; x++) {
        well[x] = [];
        for (let y = 0; y < wellSize.y; y++) {
            well[x][y] = [];
            for (let z = 0; z < wellSize.z; z++) {
                well[x][y][z] = null;
            }
        }
    }

    // Add the well walls (playfield)
    let centerX = (wellSize.x * blockSize) / 2 - blockSize / 2;
    let centerY = (wellSize.y * blockSize) / 2 - blockSize / 2;
    let centerZ = (wellSize.z * blockSize) / 2 - blockSize / 2;
    addPlayfield(centerX, centerY, centerZ);

    // Add grid overlay
    addGridOverlay();

    // Reset game variables
    currentPiece = null;
    shadowPiece = null;
    nextPiece = null;
    gameOver = false;
    score = 0;
    layersCleared = 0;
    level = 1;
    isFastDropping = false;
    rotationQueue = [];
    isRotating = false;
    rotationCooldown = 0;
    piecesPlaced = 0;
    updateScore();

    // Start the game after showing "READY?"
    showReadyMessage(() => {
        generateNextPiece();
        spawnPiece();
        updateScore();
    });
}

function showReadyMessage(callback) {
    let overlay = document.getElementById('overlay');
    overlay.innerHTML = '<h1>READY?</h1>';
    overlay.classList.remove('hidden');
    setTimeout(() => {
        overlay.classList.add('hidden');
        callback();
    }, 2000);
}

function showGameOverScreen() {
    // Clear the scene
    //clearScene();

    // Set game state
    gameState = 'gameover';

    // Stop game music
    stopAllBGM();

    // Hide score and next piece
    document.getElementById('score').style.display = 'none';
    document.getElementById('next-piece').style.display = 'none';
    document.getElementById('opponent-hp').style.display = 'none';
    document.getElementById('time-remaining').style.display = 'none';

    // Update high score
    let storedHighScore = localStorage.getItem('highScore') || 0;
    if (score > storedHighScore) {
        localStorage.setItem('highScore', score);
        highScore = score;
    } else {
        highScore = storedHighScore;
    }

    // Overlay game over message
    let overlay = document.getElementById('overlay');
    if (gameMode === 'story') {
        overlay.innerHTML = `<h1 style="color:red;">GAME OVER</h1><p>Press Any Key to Return to Menu</p>`;
    } else {
        overlay.innerHTML = `<h1 style="color:red;">GAME OVER</h1><p>Your Score: ${score}</p><p>High Score: ${highScore}</p><p>Press Any Key to Return to Menu</p>`;
    }
    overlay.classList.remove('hidden');

    // Return to menu on key press
    function onReturnKey() {
        document.removeEventListener('keydown', onReturnKey);
        showMainMenu();
    }
    document.addEventListener('keydown', onReturnKey);
}

function clearScene() {
    // Remove all objects from the scene
    while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }

    // Hide UI elements
    document.getElementById('next-piece').style.display = 'none';
    document.getElementById('score').style.display = 'none';
    document.getElementById('opponent-hp').style.display = 'none';
    document.getElementById('time-remaining').style.display = 'none';

    // Clear overlay
    let overlay = document.getElementById('overlay');
    overlay.innerHTML = '';
}

function addDynamicBackground() {
    const worldWidth = 128,
        worldDepth = 128;
    backgroundGeometry = new THREE.PlaneGeometry(20000, 20000, worldWidth - 1, worldDepth - 1);
    backgroundGeometry.rotateX(-Math.PI / 2);

    const position = backgroundGeometry.attributes.position;
    position.usage = THREE.DynamicDrawUsage;

    // Initialize y values
    for (let i = 0; i < position.count; i++) {
        const y = 35 * Math.sin(i / 2);
        position.setY(i, y);
    }

    // Optionally load a texture (ensure the path is correct or comment this section if not using a texture)
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('images/water.jpg');
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 5);

    backgroundMaterial = new THREE.MeshBasicMaterial({
        color: 0x0044ff,
        map: texture, // Uncomment if using a texture
    });

    backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    backgroundMesh.position.y = -100; // Position it below your game field if necessary
    backgroundMesh.renderOrder = -1; // Ensure it's rendered behind other objects
    scene.add(backgroundMesh);

    /* Blue cyan gradient */
    const geometry = new THREE.SphereGeometry(500, 32, 32);
    const material = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {},
        vertexShader: `
					varying vec3 vWorldPosition;
					void main() {
						vec4 worldPosition = modelMatrix * vec4(position, 1.0);
						vWorldPosition = worldPosition.xyz;
						gl_Position = projectionMatrix * viewMatrix * worldPosition;
					}
				`,
        fragmentShader: `
					varying vec3 vWorldPosition;
					void main() {
						float h = normalize(vWorldPosition).y;
						gl_FragColor = vec4(mix(vec3(0.0, 1.0, 1.0), vec3(0.0, 0.0, 1.0), h * 0.5 + 0.5), 1.0);
					}
				`
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
}


function addPlayfield(centerX, centerY, centerZ) {
    // Create the walls
    let wallGeometry = new THREE.BoxGeometry(wellSize.x, wellSize.y, wellSize.z);
    let wallMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.1
    });
    let walls = new THREE.Mesh(wallGeometry, wallMaterial);
    walls.position.set(centerX, centerY, centerZ);
    scene.add(walls);

    // Create the edges (contours)
    let edgesGeometry = new THREE.EdgesGeometry(wallGeometry);
    let edgesMaterial = new THREE.LineBasicMaterial({
        color: 0x006400
    }); // Dark green
    let edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    edges.position.set(centerX, centerY, centerZ);
    scene.add(edges);
}

function addGridOverlay() {
    let gridHelper = new THREE.GridHelper(wellSize.x * blockSize, wellSize.x, 0x444444, 0x444444);
    gridHelper.position.y = -0.5;
    gridHelper.position.x = (wellSize.x * blockSize) / 2 - blockSize / 2;
    gridHelper.position.z = (wellSize.z * blockSize) / 2 - blockSize / 2;
    scene.add(gridHelper);
}

function generateNextPiece() {
    let pieceTypes = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

    // After 8 pieces have been placed, include the bomb with a 50% chance
    if (piecesPlaced >= 8) {
        if (Math.random() < 0.5) {
            pieceTypes.push('Bomb');
        }
    }

    let type = pieceTypes[Math.floor(Math.random() * pieceTypes.length)];
    nextPiece = createPiece(type);
    displayNextPiece();
}

function spawnPiece() {
    currentPiece = nextPiece.clone();
    currentPiece.position.set(
        Math.floor(wellSize.x / 2) * blockSize,
        (wellSize.y - 2) * blockSize, // Spawn lower for immediate control
        Math.floor(wellSize.z / 2) * blockSize
    );
    currentPiece.rotation.set(0, 0, 0);
    scene.add(currentPiece);

    // Add labels
    addDirectionalLabels();

    // Check if the new piece collides immediately
    if (checkMovementCollision()) {
        gameOver = true;
        showGameOverScreen();
        return;
    }

    createShadowPiece();
    updateShadowPiece();

    generateNextPiece();
}

function displayNextPiece() {
    let nextPieceScene = new THREE.Scene();
    let light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 20, 10).normalize();
    nextPieceScene.add(light);

    let camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);

    nextPiece.position.set(0, 0, 0);
    nextPiece.rotation.set(0, 0, 0);
    nextPieceScene.add(nextPiece);

    let renderer = new THREE.WebGLRenderer({
        alpha: true
    });
    renderer.setSize(150, 150);
    let container = document.getElementById('next-piece');
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    renderer.render(nextPieceScene, camera);
}

function createPiece(type) {
    if (type === 'Bomb') {
        let geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
        let material = new THREE.MeshLambertMaterial({
            color: 0xff0000
        });
        let cube = new THREE.Mesh(geometry, material);
        cube.name = 'Bomb';
        return cube;
    }

    let group = new THREE.Group();
    let material = new THREE.MeshLambertMaterial({
        color: Math.random() * 0xffffff
    });

    let offsets = [];
    switch (type) {
        case 'I':
            offsets = [
                [-1.5, 0, 0],
                [-0.5, 0, 0],
                [0.5, 0, 0],
                [1.5, 0, 0]
            ];
            break;
        case 'J':
            offsets = [
                [-1, 0, 0],
                [0, 0, 0],
                [1, 0, 0],
                [1, 0, -1]
            ];
            break;
        case 'L':
            offsets = [
                [-1, 0, 0],
                [0, 0, 0],
                [1, 0, 0],
                [-1, 0, -1]
            ];
            break;
        case 'O':
            offsets = [
                [0, 0, 0],
                [1, 0, 0],
                [0, 0, -1],
                [1, 0, -1]
            ];
            break;
        case 'S':
            offsets = [
                [-1, 0, 0],
                [0, 0, 0],
                [0, 0, -1],
                [1, 0, -1]
            ];
            break;
        case 'T':
            offsets = [
                [-1, 0, 0],
                [0, 0, 0],
                [1, 0, 0],
                [0, 0, -1]
            ];
            break;
        case 'Z':
            offsets = [
                [-1, 0, -1],
                [0, 0, -1],
                [0, 0, 0],
                [1, 0, 0]
            ];
            break;
    }

    for (let i = 0; i < offsets.length; i++) {
        let geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
        let cube = new THREE.Mesh(geometry, material);
        cube.position.set(offsets[i][0] * blockSize, 0, offsets[i][2] * blockSize);
        group.add(cube);
    }

    return group;
}

function addDirectionalLabels() {
    // Remove previous labels
    if (labelGroup) {
        scene.remove(labelGroup);
    }

    labelGroup = new THREE.Group();

    let labels = ['N', 'S', 'E', 'W'];
    let positions = [
        new THREE.Vector3(0, 0, -blockSize * 2),
        new THREE.Vector3(0, 0, blockSize * 2),
        new THREE.Vector3(blockSize * 2, 0, 0),
        new THREE.Vector3(-blockSize * 2, 0, 0)
    ];

    for (let i = 0; i < labels.length; i++) {
        let textGeo = new TextGeometry(labels[i], {
            font: font,
            size: 0.5,
            height: 0.05,
            curveSegments: 12
        });

        // Create materials
        let textMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff
        });
        let outlineMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            side: THREE.BackSide
        });

        // Create text mesh
        let textMesh = new THREE.Mesh(textGeo, textMaterial);

        // Create outline mesh
        let outlineMesh = new THREE.Mesh(textGeo, outlineMaterial);
        outlineMesh.scale.multiplyScalar(1.05);

        // Combine meshes
        let combined = new THREE.Group();
        combined.add(outlineMesh);
        combined.add(textMesh);

        combined.position.copy(positions[i]);
        combined.position.y += 0.5; // Slightly above the piece
        combined.name = 'Label'; // Mark as label

        labelGroup.add(combined);
    }

    scene.add(labelGroup);
}

function createShadowPiece() {
    if (currentPiece.name === 'Bomb') {
        shadowPiece = currentPiece.clone();
        shadowPiece.traverse(function(child) {
            if (child.isMesh) {
                child.material = new THREE.MeshLambertMaterial({
                    color: 0xff0000,
                    opacity: 0.3,
                    transparent: true
                });
            }
        });
    } else {
        shadowPiece = new THREE.Group();
        currentPiece.traverse(function(child) {
            if (child.isMesh && child.geometry.type === 'BoxGeometry') {
                let clone = child.clone();
                clone.material = new THREE.MeshLambertMaterial({
                    color: 0x000000,
                    opacity: 0.3,
                    transparent: true
                });
                shadowPiece.add(clone);
            }
        });
    }
    scene.add(shadowPiece);
}

function updateShadowPiece() {
    if (!shadowPiece) return;

    // Copy position and rotation
    shadowPiece.position.copy(currentPiece.position);
    shadowPiece.rotation.copy(currentPiece.rotation);

    // Move shadow down until it collides
    while (!detectShadowCollision()) {
        shadowPiece.position.y -= blockSize;
    }
    shadowPiece.position.y += blockSize; // Adjust back one block
}

function detectShadowCollision() {
    let positions = getPiecePositions(shadowPiece);

    for (let pos of positions) {
        let x = pos.x;
        let y = pos.y - 1; // Check the position below
        let z = pos.z;

        if (y < 0 || isOccupied(x, y, z)) {
            return true;
        }
    }
    return false;
}

function animate() {

    // Update background
    if (backgroundGeometry) {
        const delta = clock.getDelta();
        const time = clock.getElapsedTime() * 10;

        const position = backgroundGeometry.attributes.position;

        for (let i = 0; i < position.count; i++) {
            const y = 35 * Math.sin(i / 5 + (time + i) / 7);
            position.setY(i, y);
        }

        position.needsUpdate = true;
    }


    if (gameState === 'game' && !gameOver) {
        if (rotationCooldown > 0) {
            rotationCooldown--;
        } else if (!isRotating) {
            updatePiece();
        }
        applySmoothRotation();
        applyScreenShake();
        updateLabels();
        renderer.render(scene, camera);

        if (gameMode === 'story') {
            updateTime();
            checkOpponentHP();
        }
    } else {
        renderer.render(scene, camera);
    }
}

function updatePiece() {
    if (!currentPiece) return; // Exit if currentPiece is null

    let dropSpeed = isFastDropping ? fallingSpeed * 10 : fallingSpeed;
    currentPiece.position.y -= dropSpeed;

    if (detectCollision()) {
        if (currentPiece.name === 'Bomb') {
            explodeBomb();
        } else {
            placePiece();
            clearLayers();
        }
        if (!gameOver) {
            spawnPiece();
        }
    } else {
        updateShadowPiece();
    }
}

function updateLabels() {
    if (!labelGroup || !currentPiece) return;

    // Position labels relative to the current piece
    labelGroup.position.copy(currentPiece.position);

    // Keep labels from rotating with the piece
    labelGroup.rotation.set(0, 0, 0);

    // Make labels face the camera
    labelGroup.children.forEach(function(label) {
        label.quaternion.copy(camera.quaternion);
    });
}

function detectCollision() {
    let positions = getPiecePositions(currentPiece);

    for (let pos of positions) {
        let x = pos.x;
        let y = pos.y - 1; // Check the position below
        let z = pos.z;

        if (y < 0 || isOccupied(x, y, z)) {
            return true;
        }
    }
    return false;
}

function placePiece() {
    let positions = getPiecePositions(currentPiece);

    for (let pos of positions) {
        let x = pos.x;
        let y = pos.y;
        let z = pos.z;

        // Check if the position is outside the well or already occupied
        if (y >= wellSize.y || well[x][y][z] != null) {
            gameOver = true;
            showGameOverScreen();
            return;
        }

        well[x][y][z] = new THREE.Mesh(
            new THREE.BoxGeometry(blockSize, blockSize, blockSize),
            currentPiece.children[0].material.clone()
        );
        well[x][y][z].position.set(x * blockSize, y * blockSize, z * blockSize);
        scene.add(well[x][y][z]);
    }
    scene.remove(currentPiece);
    scene.remove(shadowPiece);
    scene.remove(labelGroup);
    labelGroup = null;

    piecesPlaced++; // Increment the pieces placed counter

    // Play drop sound effect
    playSFX('drop');
}

function explodeBomb() {
    let positions = getPiecePositions(currentPiece);
    let bombPos = positions[0]; // Since bomb is a single cube

    // Play explosion sound effect
    playSFX('explosion');

    // Visual explosion effect
    let explosionParticles = [];
    let particleGeometry = new THREE.BoxGeometry(blockSize / 4, blockSize / 4, blockSize / 4);
    let particleMaterial = new THREE.MeshLambertMaterial({
        color: 0xff4500
    });

    for (let i = 0; i < 50; i++) {
        let particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.set(
            bombPos.x * blockSize,
            bombPos.y * blockSize,
            bombPos.z * blockSize
        );
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random() * 2,
            (Math.random() - 0.5) * 2
        );
        scene.add(particle);
        explosionParticles.push(particle);
    }

    // Screen shake
    shakeDuration = 20;
    shakeIntensity = 0.1;

    // Remove blocks within the explosion range
    let range = 2; // 4x4 area (from -2 to +1 relative positions)
    for (let x = bombPos.x - range + 1; x <= bombPos.x + range - 1; x++) {
        for (let y = bombPos.y - range + 1; y <= bombPos.y + range - 1; y++) {
            for (let z = bombPos.z - range + 1; z <= bombPos.z + range - 1; z++) {
                if (x >= 0 && x < wellSize.x && y >= 0 && y < wellSize.y && z >= 0 && z < wellSize.z) {
                    if (well[x][y][z] != null) {
                        scene.remove(well[x][y][z]);
                        well[x][y][z] = null;
                    }
                }
            }
        }
    }

    scene.remove(currentPiece);
    scene.remove(shadowPiece);
    scene.remove(labelGroup);
    labelGroup = null;

    // Animate explosion particles
    let explosionAnimation = setInterval(() => {
        explosionParticles.forEach(particle => {
            particle.position.add(particle.velocity);
            particle.velocity.multiplyScalar(0.9); // Dampen velocity
            particle.material.opacity -= 0.05;
            if (particle.material.opacity <= 0) {
                scene.remove(particle);
                explosionParticles.splice(explosionParticles.indexOf(particle), 1);
            }
        });
        if (explosionParticles.length === 0) {
            clearInterval(explosionAnimation);
        }
    }, 50);
}

function clearLayers() {
    let layersClearedThisTurn = 0;
    for (let y = 0; y < wellSize.y; y++) {
        let layerFull = true;
        for (let x = 0; x < wellSize.x; x++) {
            for (let z = 0; z < wellSize.z; z++) {
                if (well[x][y][z] == null) {
                    layerFull = false;
                    break;
                }
            }
            if (!layerFull) break;
        }
        if (layerFull) {
            // Remove blocks in this layer
            for (let x = 0; x < wellSize.x; x++) {
                for (let z = 0; z < wellSize.z; z++) {
                    scene.remove(well[x][y][z]);
                    well[x][y][z] = null;
                }
            }
            // Move blocks above down
            for (let yy = y + 1; yy < wellSize.y; yy++) {
                for (let x = 0; x < wellSize.x; x++) {
                    for (let z = 0; z < wellSize.z; z++) {
                        if (well[x][yy][z] != null) {
                            well[x][yy - 1][z] = well[x][yy][z];
                            well[x][yy][z] = null;
                            well[x][yy - 1][z].position.y -= blockSize;
                        }
                    }
                }
            }
            score += 100;
            updateScore();
            layersCleared++;
            layersClearedThisTurn++;
            y--; // Re-check the same layer after moving blocks down

            // Play clear line sound effect
            playSFX('clearLine');

            if (gameMode === 'story') {
                // Decrease opponent HP based on their total HP
                let segment = storySegments[currentStorySegment];
                let damagePerLayer = segment.opponentHP / (segment.opponentHP / 25);
                opponentHP -= damagePerLayer; // Decrease HP per layer cleared
                if (opponentHP < 0) opponentHP = 0;
                document.getElementById('opponent-hp').innerText = 'Opponent HP: ' + opponentHP;
            }
        }
    }

    // Increase level every 5 layers cleared
    if (layersClearedThisTurn > 0 && layersCleared % 5 === 0) {
        level++;
        fallingSpeed += 0.002; // Gradual increase in falling speed
    }
}

function getPiecePositions(piece) {
    let positions = [];
    if (!piece) {
        //console.error("getPiecePositions called with null piece");
        return [];
    }

    if (piece.name === 'Bomb') {
        let worldPosition = new THREE.Vector3();
        piece.getWorldPosition(worldPosition);
        let x = Math.round(worldPosition.x / blockSize);
        let y = Math.round(worldPosition.y / blockSize);
        let z = Math.round(worldPosition.z / blockSize);
        positions.push({
            x: x,
            y: y,
            z: z
        });
    } else {
        let tempMatrix = new THREE.Matrix4();
        piece.updateMatrixWorld();
        piece.traverse(function(child) {
            if (child.isMesh && child.geometry.type === 'BoxGeometry') {
                tempMatrix.copy(child.matrixWorld);
                let pos = new THREE.Vector3();
                pos.setFromMatrixPosition(tempMatrix);
                let x = Math.round(pos.x / blockSize);
                let y = Math.round(pos.y / blockSize);
                let z = Math.round(pos.z / blockSize);
                positions.push({
                    x: x,
                    y: y,
                    z: z
                });
            }
        });
    }
    return positions;
}

function isOccupied(x, y, z) {
    if (x < 0 || x >= wellSize.x || y < 0 || y >= wellSize.y || z < 0 || z >= wellSize.z) {
        return true;
    }
    return well[x][y][z] != null;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function showKeyConfigMenu() {
    gameState = 'reconfigureKeys';
    let overlay = document.getElementById('overlay');
    overlay.innerHTML = `
        <h1 style="text-align: center;">Reconfigure Keys</h1>
        <div id="key-config-options" style="display: flex; flex-direction: column; align-items: center;"></div>
        <p style="text-align: center;">Use Arrow Keys to navigate, Enter to rebind, Esc to return</p>
    `;
    overlay.classList.remove('hidden');

    updateKeyConfigMenu();
}

function updateKeyConfigMenu() {
    let optionsContainer = document.getElementById('key-config-options');
    optionsContainer.innerHTML = '';
    for (let i = 0; i < keyConfigOptions.length; i++) {
        let action = keyConfigOptions[i];
        let option = document.createElement('div');
        option.innerText = `${action}: ${getKeyName(keyBindings[action])}`;
        option.style.fontSize = '24px';
        option.style.margin = '5px 0';
        if (i === selectedKeyConfigOption) {
            option.style.color = '#FFD700'; // Highlight selected option
        } else {
            option.style.color = '#FFFFFF';
        }
        optionsContainer.appendChild(option);
    }
}



function rebindKey(newKey) {
    let action = keyConfigOptions[selectedKeyConfigOption];

    // Allow unbinding by pressing 'Delete' or 'Backspace'
    if (newKey === 'Delete' || newKey === 'Backspace') {
        keyBindings[action] = null; // Unbind the action
        saveKeyBindings();
        buildKeyToActionMap();
        waitingForKeyBinding = false;
        updateKeyConfigMenu();
        return;
    }

    // Prevent rebinding menu navigation keys
    if (['ArrowUp', 'ArrowDown', 'Enter'].includes(newKey)) {
        alert('This key is reserved for menu navigation. Choose another key.');
        waitingForKeyBinding = false;
        updateKeyConfigMenu();
        return;
    }

    // Check for duplicate keys
    for (let otherAction in keyBindings) {
        if (keyBindings[otherAction] === newKey) {
            alert(`Key already bound to ${otherAction}. Choose another key.`);
            waitingForKeyBinding = false;
            updateKeyConfigMenu();
            return;
        }
    }

    // Update key binding
    keyBindings[action] = newKey;
    saveKeyBindings();
    buildKeyToActionMap();
    waitingForKeyBinding = false;
    updateKeyConfigMenu();
}




function promptForNewKey() {
    let optionsList = document.getElementById('key-config-options');
    let option = optionsList.children[selectedKeyConfigOption];
    option.innerText = `${keyConfigOptions[selectedKeyConfigOption]}: [Press any key]`;
}

function getKeyName(keyCode) {
    if (!keyCode) {
        return 'None';
    }
    return keyCode;
}

function onDocumentKeyDown(event) {
    let key = event.code;

    if (gameState === 'reconfigureKeys') {
        if (waitingForKeyBinding) {
            rebindKey(key);
            return;
        }

        if (key === 'ArrowUp') {
            selectedKeyConfigOption = (selectedKeyConfigOption - 1 + keyConfigOptions.length) % keyConfigOptions.length;
            updateKeyConfigMenu();
        } else if (key === 'ArrowDown') {
            selectedKeyConfigOption = (selectedKeyConfigOption + 1) % keyConfigOptions.length;
            updateKeyConfigMenu();
        } else if (key === 'Enter') {
            waitingForKeyBinding = true;
            promptForNewKey();
        } else if (key === 'Escape') {
            showMainMenu();
        }
        return;
    }

    if (gameState === 'menu') {
        // Handle menu navigation
        if (key === 'ArrowUp') {
            selectedOption = (selectedOption - 1 + menuOptions.length) % menuOptions.length;
            updateMenuSelection();
        } else if (key === 'ArrowDown') {
            selectedOption = (selectedOption + 1) % menuOptions.length;
            updateMenuSelection();
        } else if (key === 'Enter') {
            if (selectedOption === 0) {
                startStoryMode();
            } else if (selectedOption === 1) {
                startArcadeMode();
            } else if (selectedOption === 2) {
                showKeyConfigMenu();
            }
        }
        return;
    }

    if (gameState !== 'game') return;

    let action = keyToActionMap[key];
    if (!action) return;

    if (!currentPiece) {
        console.warn("Key press detected but currentPiece is null");
        return;
    }

    let deltaPosition = new THREE.Vector3();

    switch (action) {
        case 'Left':
            deltaPosition.x = -blockSize;
            playSFX('move');
            break;
        case 'Right':
            deltaPosition.x = blockSize;
            playSFX('move');
            break;
        case 'Forward':
            deltaPosition.z = -blockSize;
            playSFX('move');
            break;
        case 'Backward':
            deltaPosition.z = blockSize;
            playSFX('move');
            break;
        case 'Fast Drop':
            isFastDropping ^= 1;
            break;
        case 'Rotate Y Negative':
            handleRotation({
                x: 0,
                y: -Math.PI / 2,
                z: 0
            });
            break;
        case 'Rotate Y Positive':
            handleRotation({
                x: 0,
                y: Math.PI / 2,
                z: 0
            });
            break;
        case 'Rotate X Negative':
            handleRotation({
                x: -Math.PI / 2,
                y: 0,
                z: 0
            });
            break;
        case 'Rotate X Positive':
            handleRotation({
                x: Math.PI / 2,
                y: 0,
                z: 0
            });
            break;
        case 'Rotate Z Negative':
            handleRotation({
                x: 0,
                y: 0,
                z: -Math.PI / 2
            });
            break;
        case 'Rotate Z Positive':
            handleRotation({
                x: 0,
                y: 0,
                z: Math.PI / 2
            });
            break;
        case 'Drop Piece':
            dropPieceToBottom();
            return; // Early return to avoid applying deltaPosition
            // Add other actions as needed
    }

    // Apply movement
    currentPiece.position.add(deltaPosition);

    // Check collision after movement
    if (checkMovementCollision()) {
        // Revert movement if collision detected
        currentPiece.position.sub(deltaPosition);
    } else {
        updateShadowPiece();
    }
}


function onDocumentKeyUp(event) {
    let key = event.code;

    let action = keyToActionMap[key];
    if (!action) return;

    if (action === 'FastDrop') {
        isFastDropping = false;
    }
}

function handleRotation(rotation) {
    if (!isRotating) {
        if (canRotate(rotation)) {
            isRotating = true;
            rotationCooldown = 60; // Adjust as needed
            rotationQueue.push(rotation);
            playSFX('rotate');
        }
    }
}

function dropPieceToBottom() {
    while (!detectCollision()) {
        currentPiece.position.y -= blockSize;
    }
    if (currentPiece.name === 'Bomb') {
        explodeBomb();
    } else {
        placePiece();
        clearLayers();
    }
    if (!gameOver) {
        spawnPiece();
    }
}


function canRotate(rotation) {
    // Clone the current piece
    let testPiece = new THREE.Group();
    currentPiece.traverse(function(child) {
        if (child.isMesh && child.geometry.type === 'BoxGeometry') {
            let clone = child.clone();
            testPiece.add(clone);
        }
    });
    testPiece.position.copy(currentPiece.position);
    testPiece.rotation.copy(currentPiece.rotation);

    // Apply rotation
    testPiece.rotation.x += rotation.x;
    testPiece.rotation.y += rotation.y;
    testPiece.rotation.z += rotation.z;

    // Check for collision
    let positions = getPiecePositions(testPiece);
    for (let pos of positions) {
        let x = pos.x;
        let y = pos.y;
        let z = pos.z;

        if (x < 0 || x >= wellSize.x || y < 0 || y >= wellSize.y || z < 0 || z >= wellSize.z || isOccupied(x, y, z)) {
            return false;
        }
    }
    return true;
}

function checkMovementCollision() {
    let positions = getPiecePositions(currentPiece);

    for (let pos of positions) {
        let x = pos.x;
        let y = pos.y;
        let z = pos.z;

        if (x < 0 || x >= wellSize.x || y < 0 || y >= wellSize.y || z < 0 || z >= wellSize.z || isOccupied(x, y, z)) {
            return true;
        }
    }
    return false;
}

function applySmoothRotation() {
    if (rotationQueue.length > 0) {
        let rotation = rotationQueue[0];

        // Incremental rotation
        let deltaRotation = {
            x: rotation.x !== 0 ? rotationStep * Math.sign(rotation.x) : 0,
            y: rotation.y !== 0 ? rotationStep * Math.sign(rotation.y) : 0,
            z: rotation.z !== 0 ? rotationStep * Math.sign(rotation.z) : 0
        };

        currentPiece.rotation.x += deltaRotation.x;
        currentPiece.rotation.y += deltaRotation.y;
        currentPiece.rotation.z += deltaRotation.z;

        rotation.x -= deltaRotation.x;
        rotation.y -= deltaRotation.y;
        rotation.z -= deltaRotation.z;

        // Check if rotation is complete
        if (Math.abs(rotation.x) < 0.01 && Math.abs(rotation.y) < 0.01 && Math.abs(rotation.z) < 0.01) {
            // Snap to final rotation
            currentPiece.rotation.x = Math.round(currentPiece.rotation.x / (Math.PI / 2)) * (Math.PI / 2);
            currentPiece.rotation.y = Math.round(currentPiece.rotation.y / (Math.PI / 2)) * (Math.PI / 2);
            currentPiece.rotation.z = Math.round(currentPiece.rotation.z / (Math.PI / 2)) * (Math.PI / 2);

            updateShadowPiece();

            rotationQueue.shift();
            isRotating = false;
        }
    }
}

function applyScreenShake() {
    if (shakeDuration > 0) {
        let shakeX = (Math.random() - 0.5) * shakeIntensity;
        let shakeY = (Math.random() - 0.5) * shakeIntensity;
        let shakeZ = (Math.random() - 0.5) * shakeIntensity;
        camera.position.x += shakeX;
        camera.position.y += shakeY;
        camera.position.z += shakeZ;
        shakeDuration--;
        if (shakeDuration <= 0) {
            updateCameraPosition();
        }
    }
}

// Mouse control functions
function onDocumentMouseDown(event) {
    isMouseDown = true;
    prevMouse.x = event.clientX;
    prevMouse.y = event.clientY;
}

function onDocumentMouseMove(event) {
    if (isMouseDown) {
        let deltaX = event.clientX - prevMouse.x;
        let deltaY = event.clientY - prevMouse.y;

        // Update horizontal rotation
        horizontalAngle -= deltaX * rotationSpeed;

        // Update vertical rotation
        verticalAngle += deltaY * rotationSpeed;
        verticalAngle = Math.max(minVerticalAngle, Math.min(maxVerticalAngle, verticalAngle));

        updateCameraPosition();

        prevMouse.x = event.clientX;
        prevMouse.y = event.clientY;
    }
}

function onDocumentMouseUp(event) {
    isMouseDown = false;
}

function updateCameraPosition() {
    let centerX = (wellSize.x * blockSize) / 2 - blockSize / 2;
    let centerY = (wellSize.y * blockSize) / 2 - blockSize / 2;
    let centerZ = (wellSize.z * blockSize) / 2 - blockSize / 2;

    let radius = 20; // Distance from the center
    let phi = verticalAngle;
    let theta = horizontalAngle;

    // Calculate new camera position
    let x = centerX + radius * Math.sin(phi) * Math.cos(theta);
    let y = centerY + radius * Math.cos(phi);
    let z = centerZ + radius * Math.sin(phi) * Math.sin(theta);

    camera.position.set(x, y, z);
    camera.lookAt(new THREE.Vector3(centerX, centerY, centerZ));
}

function updateTime() {
    timeRemaining -= 1 / 60; // Assuming 60fps
    if (timeRemaining <= 0) {
        timeRemaining = 0;
        gameOver = true;
        showGameOverScreen();
    }
    document.getElementById('time-remaining').innerText = '🕑 ' + Math.ceil(timeRemaining);
}

function checkOpponentHP() {
    if (opponentHP <= 0) {
        // Proceed to win
        showWinningScreen();
        gameOver = true; // End current gameplay session
    }
}

function updateScore() {
    document.getElementById('score').innerText = 'Score: ' + score;
    if (gameMode === 'story') {
        document.getElementById('opponent-hp').innerText = 'Opponent HP: ' + opponentHP;
        document.getElementById('time-remaining').innerText = '🕑 ' + Math.ceil(timeRemaining);
    }
}

function showWinningScreen() {
    console.log("Showing Winning Screen");

    // Set game state
    gameState = 'win';

    // Stop all background music
    stopAllBGM();

    // Play winning music
    bgm.win.play();

    // Clear the scene
    //clearScene();

    // Overlay winning message
    let overlay = document.getElementById('overlay');
    overlay.innerHTML = `
				<div style="position: relative; width: 100%; height: 100%;">
					<h1 style="color: #FFD700; text-align: center; margin-top: 20%;">You win!</h1>
					<p style="color: #FFFFFF; text-align: center; font-size: 24px;">You've defeated your opponent!</p>
					<p id="press-to-return" style="color: #FFFFFF; text-align: center; font-size: 20px; margin-top: 20px;">Press Any Key to Continue</p>
				</div>
			`;
    overlay.classList.remove('hidden');

    // Blinking text effect for "Press Any Key to Continue"
    let pressToReturn = document.getElementById('press-to-return');
    setInterval(() => {
        if (pressToReturn.style.visibility === 'hidden') {
            pressToReturn.style.visibility = 'visible';
        } else {
            pressToReturn.style.visibility = 'hidden';
        }
    }, 500);

    // Return to menu or next story segment on key press
    function onWinKey(event) {
        console.log("Win key pressed");
        document.removeEventListener('keydown', onWinKey);
        bgm.win.stop(); // Stop winning music
        if (gameMode === 'story') {
            proceedToNextStorySegment();
        } else {
            showMainMenu();
        }
    }
    document.addEventListener('keydown', onWinKey);
}

function playCutsceneVideo(callback) {
    const video = document.getElementById('cutscene-video');
    video.currentTime = 0; // Reset video to start
    video.classList.remove('hidden'); // Make the video visible
    video.style.display = 'block'; // Ensure the video is displayed
    video.style.opacity = 1; // Reset opacity in case it's been changed before
    video.play(); // Start playing the video

    // Disable user interactions during the cutscene
    document.body.style.pointerEvents = 'none';

    // Event listener to detect when the video ends
    function onVideoEnd() {
        video.pause(); // Ensure the video is paused
        video.style.opacity = 0; // Reset opacity for future plays
        video.classList.add('hidden'); // Hide the video after playback
        video.removeEventListener('ended', onVideoEnd); // Clean up the event listener
        document.body.style.pointerEvents = 'auto'; // Re-enable user interactions
        if (callback) callback(); // Proceed to the next step
    }

    video.addEventListener('ended', onVideoEnd);
}


function proceedToNextStorySegment() {
    if (currentStorySegment < storySegments.length - 1) {
        currentStorySegment++;
        showStorySegment();
    } else {
        // All story segments completed
        showFinalStoryConclusion();
    }
}

// Ensure that the final story conclusion handles the end of all segments
function showFinalStoryConclusion() {
    console.log("Final Story Conclusion reached");

    let segment = storySegments[currentStorySegment];
    let overlay = document.getElementById('overlay');

    // Initialize text variables
    currentLine = 0;
    currentCharIndex = 0;
    isTyping = false;

    // Create HTML content
    overlay.innerHTML = `
				<div id="story-content" style="position: relative; width: 100%; height: 100%;">
					<img src="${segment.background || 'images/default-background.jpg'}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;z-index:-1;">
					<img src="${segment.character1}" style="width: 30%; position: absolute; left: 0; bottom: 0;">
					<img src="${segment.character2}" style="width: 30%; position: absolute; right: 0; bottom: 0;">
					<div id="story-text" style="position: absolute; bottom: 10%; width: 80%; left:10%; text-align: center; color: #fff; font-size: 24px;">
					</div>
				</div>
			`;
    overlay.classList.remove('hidden');

    // Start typing the first line
    typeNextLine();

    // Proceed to winning screen on key press
    function onFinalStoryEndKey(event) {
        if (event.keyCode === 13 || event.keyCode === 32) { // Enter or Space
            if (isTyping) {
                // Finish current line instantly
                finishTypingCurrentLine();
            } else {
                currentLine++;
                if (currentLine < segment.text.length) {
                    typeNextLine();
                } else {
                    // All lines done, proceed to winning screen
                    document.removeEventListener('keydown', onFinalStoryEndKey);
                    overlay.classList.add('hidden');
                    showWinningScreen(); // Invoke the winning screen
                }
            }
        }
    }
    document.addEventListener('keydown', onFinalStoryEndKey);
}