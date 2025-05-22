import { showScreen, updateStageCounter, updateTimer, updateProgressBar, displayAutocompleteSuggestions, clearAutocompleteSuggestions, updatePlayButton, showSuccessScreen, showFailureScreen, updateMuteButtonText } from './ui.js';
import * as api from './api.js';
import { playSnippet, playFullPreview, stopAudio, toggleMute, getMuteState } from './audio.js';
import { initializeSearchIndex, getAutocompleteSuggestions, checkGuess } from './search.js';

// DOM Elements
const startButton = document.getElementById('start-button');
const playPauseButton = document.getElementById('play-pause-button');
const guessInput = document.getElementById('guess-input');
const submitButton = document.getElementById('submit-button');
const skipButton = document.getElementById('skip-button');
const muteToggleButton = document.getElementById('mute-toggle');
// Play Next and Try Again buttons will be handled by UI module or dynamically added

// Game State
let currentSong = null;
let currentStage = 0; // 0-indexed for snippetDurations array
let score = 0; // Could be used for future enhancements
let timerInterval = null;
let elapsedTime = 0;
let allSongs = []; // For autocomplete

const snippetDurations = [0.1, 0.5, 2, 4, 8, 15]; // Seconds
const MAX_STAGES = snippetDurations.length;

// --- Initialization ---
async function initializeApp() {
    showScreen('landing-screen');
    try {
        allSongs = await api.getAllSongs();
        initializeSearchIndex(allSongs);
    } catch (error) {
        console.error("Failed to load initial song data:", error);
        // Handle error, maybe show a message to the user
    }
    setupEventListeners();
    updateMuteButtonText(getMuteState());
}

function setupEventListeners() {
    if (startButton) startButton.addEventListener('click', startGame);
    if (playPauseButton) playPauseButton.addEventListener('click', playCurrentSnippet);
    if (submitButton) submitButton.addEventListener('click', handleGuess);
    if (skipButton) skipButton.addEventListener('click', handleSkip);
    if (muteToggleButton) muteToggleButton.addEventListener('click', handleMuteToggle);

    if (guessInput) {
        guessInput.addEventListener('input', () => {
            const query = guessInput.value;
            if (query.length >= 2) {
                const suggestions = getAutocompleteSuggestions(query);
                displayAutocompleteSuggestions(suggestions, (selectedValue) => {
                    guessInput.value = selectedValue;
                    clearAutocompleteSuggestions();
                    handleGuess(); // Optionally auto-submit on selection
                });
            } else {
                clearAutocompleteSuggestions();
            }
        });
        guessInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                handleGuess();
            }
        });
    }
}

// --- Game Flow ---
async function startGame() {
    console.log("Game Starting...");
    resetGameState();
    showScreen('game-screen');
    updatePlayButton(true); // Set to "Play Snippet"

    try {
        currentSong = await api.getRandomSong();
        if (!currentSong || !currentSong.previewUrl) {
            console.error("Failed to fetch a playable song.", currentSong);
            alert("Error: Could not load a song. Please try again.");
            showScreen('landing-screen');
            return;
        }
        console.log("Current song for the game:", currentSong);
        startStage();
    } catch (error) {
        console.error("Error starting game:", error);
        alert("Error starting the game. Please check console and try again.");
        showScreen('landing-screen');
    }
}

function resetGameState() {
    currentStage = 0;
    elapsedTime = 0;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    stopAudio(); // Stop any previous audio
    updateStageCounter(1, MAX_STAGES);
    updateTimer(elapsedTime);
    updateProgressBar(0);
    if(guessInput) guessInput.value = '';
    clearAutocompleteSuggestions();
}

function startStage() {
    if (!currentSong || currentStage >= MAX_STAGES) {
        handleFailure("Max stages reached or no song.");
        return;
    }
    updateStageCounter(currentStage + 1, MAX_STAGES);
    updateProgressBar(((currentStage + 1) / MAX_STAGES) * 100);
    // Don't auto-play, wait for user to click "Play Snippet"
    // playCurrentSnippet(); 
    startTimer();
}

function playCurrentSnippet() {
    if (!currentSong || !currentSong.previewUrl) {
        console.error("No song loaded to play snippet.");
        return;
    }
    const duration = snippetDurations[currentStage];
    playSnippet(currentSong.previewUrl, duration);
    // Optional: Change button text to "Replay Snippet" or disable during play
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    elapsedTime = 0; // Reset timer for each stage or continue? Let's reset per game.
    updateTimer(elapsedTime);
    timerInterval = setInterval(() => {
        elapsedTime++;
        updateTimer(elapsedTime);
    }, 1000);
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
}

// --- User Actions ---
function handleGuess() {
    if (!currentSong) return;
    const userGuess = guessInput.value.trim();
    if (!userGuess) return; //
    
    console.log(`Guess: ${userGuess}, Stage: ${currentStage + 1}, Track: ${currentSong.id}`);

    const isCorrect = checkGuess(userGuess, currentSong.title, currentSong.artist);

    if (isCorrect) {
        handleSuccess();
    } else {
        advanceStageOrEndGame("Wrong guess");
    }
    guessInput.value = ''; // Clear input after guess
    clearAutocompleteSuggestions();
}

function handleSkip() {
    if (!currentSong) return;
    console.log(`Skip: Stage: ${currentStage + 1}, Track: ${currentSong.id}`);
    advanceStageOrEndGame("Skipped");
}

function advanceStageOrEndGame(outcome) {
    currentStage++;
    if (currentStage < MAX_STAGES) {
        startStage();
    } else {
        handleFailure(outcome + " - All stages used.");
    }
}

// --- Game End ---
function handleSuccess() {
    stopTimer();
    stopAudio(); // Stop snippet if playing
    console.log("Correct! Congratulations!", { trackId: currentSong.id, stage: currentStage + 1, outcome: "Correct" });
    playFullPreview(currentSong.previewUrl);
    showSuccessScreen(currentSong.title, currentSong.artist, startGame); // Pass startGame for "Play Next"
}

function handleFailure(reason = "No more attempts") {
    stopTimer();
    stopAudio(); // Stop snippet if playing
    console.log(`Failed: ${reason}`, { trackId: currentSong ? currentSong.id : 'N/A', stage: currentStage + 1, outcome: "Failure" });
    if(currentSong && currentSong.previewUrl) playFullPreview(currentSong.previewUrl);
    showFailureScreen(currentSong ? currentSong.title : "Unknown Title", currentSong ? currentSong.artist : "Unknown Artist", startGame); // Pass startGame for "Try Again"
}

function handleMuteToggle() {
    const isMuted = toggleMute();
    updateMuteButtonText(isMuted);
}


// --- Start Application ---
initializeApp(); 