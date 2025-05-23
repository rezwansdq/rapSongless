import { showScreen, updateStageCounter, updateTimer, updateProgressBar, displayAutocompleteSuggestions, clearAutocompleteSuggestions, updatePlayButton, showSuccessScreen, showFailureScreen, updateMuteButtonText, addHistoryItem, clearHistory /*, displayAlbumArt */ } from './ui.js';
import * as api from './api.js';
import { playSnippet, playFullPreview, stopAudio, toggleMute, getMuteState } from './audio.js';
import { checkGuess } from './search.js'; // Only checkGuess is needed from search.js now

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
let debounceTimer = null; // For debouncing autocomplete API calls

const snippetDurations = [0.1, 0.5, 2, 4, 8, 15]; // Seconds
const MAX_STAGES = snippetDurations.length;

// --- Initialization ---
async function initializeApp() {
    showScreen('landing-screen');
    /*try { // Old logic for pre-fetching all songs
        allSongs = await api.getAllSongs();
        initializeSearchIndex(allSongs);
    } catch (error) {
        console.error("Failed to load initial song data:", error);
        // Handle error, maybe show a message to the user
    }*/
    setupEventListeners();
    updateMuteButtonText(getMuteState());
}

function setupEventListeners() {
    if (startButton) startButton.addEventListener('click', startGame);
    if (playPauseButton) playPauseButton.addEventListener('click', playCurrentSnippet);
    if (submitButton) submitButton.addEventListener('click', handleGuess);
    if (skipButton) {
        skipButton.addEventListener('click', () => {
            console.log("Skip button clicked"); // Debug log
            handleSkip();
        });
    }
    if (muteToggleButton) muteToggleButton.addEventListener('click', handleMuteToggle);

    if (guessInput) {
        guessInput.addEventListener('input', () => {
            clearTimeout(debounceTimer); // Clear previous timer
            const query = guessInput.value;

            if (query.length >= 2) {
                debounceTimer = setTimeout(async () => {
                    console.log(`MAIN: Debounced search for: "${query}"`);
                    const suggestions = await api.fetchSearchSuggestions(query);
                    // Pass the original query for cases where suggestions might not perfectly match input start
                    displayAutocompleteSuggestions(suggestions, (selectedValue) => {
                        guessInput.value = selectedValue;
                        clearAutocompleteSuggestions();
                        handleGuess(); // Optionally auto-submit on selection
                    });
                }, 300); // 300ms debounce
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

    try {
        currentSong = await api.getRandomSong();
        if (!currentSong) { // Simplified check, as getRandomSong now tries hard to return something
            console.error("CRITICAL: Failed to fetch any song from API.");
            alert("Error: Could not load a song. Please try again later.");
            showScreen('landing-screen');
            return;
        }
        console.log("Current song for the game:", currentSong);
        /*if (currentSong.albumArt) {
            displayAlbumArt(currentSong.albumArt); // Display album art if available
        } else {
            displayAlbumArt(null); // Clear album art if not available
        }*/
        updatePlayButton(true, !!currentSong.previewUrl); // Update button based on preview availability
        startStage();
    } catch (error) {
        console.error("Error starting game:", error);
        alert("Error starting the game. Please check console and try again.");
        showScreen('landing-screen');
    }
}

function resetGameState() {
    currentSong = null;
    currentStage = 0;
    stopAudio(); // Stop any previous audio & clears its own timer interval
    updateStageCounter(1, MAX_STAGES);
    updateTimer(0); // Reset timer display to 0:00
    updateProgressBar(0);
    if(guessInput) guessInput.value = '';
    clearAutocompleteSuggestions();
    clearHistory(); // Clear history when resetting game
    // displayAlbumArt(null); // Clear album art on reset
}

function startStage() {
    console.log(`Starting stage ${currentStage + 1}. Current song title: ${currentSong ? currentSong.title : 'N/A'}`);
    if (!currentSong || currentStage >= MAX_STAGES) {
        handleFailure("Max stages reached or no song.");
        return;
    }
    updateStageCounter(currentStage + 1, MAX_STAGES);
    updateProgressBar(((currentStage + 1) / MAX_STAGES) * 100);
    updatePlayButton(true, !!(currentSong && currentSong.previewUrl)); 
    updateTimer(0); // Reset timer to 0:00 at the start of a stage, before snippet plays
}

function playCurrentSnippet() {
    if (!currentSong) {
        console.error("No song loaded to play snippet.");
        return;
    }
    if (currentSong.previewUrl) {
        const duration = snippetDurations[currentStage];
        playSnippet(
            currentSong.previewUrl, 
            duration,
            (currentTime) => updateTimer(Math.round(currentTime)), // onTimeUpdate callback
            () => updatePlayButton(true, true) // onSnippetEnd callback to re-enable play button
        );
        updatePlayButton(false, true); // Indicate playing
        // Re-enable play button after snippet duration (or a bit more) allowing replay
        // setTimeout(() => updatePlayButton(true, true), (duration * 1000) + 500); // Old method, now handled by onSnippetEnd
    } else {
        // No preview URL - this click could reveal a text hint in the future
        console.log("Play Snippet clicked, but no previewUrl. Stage:", currentStage + 1);
        // For now, we can just add a history item or a small visual cue
        addHistoryItem('hint_attempt', `Hint for Stage ${currentStage + 1}`); 
        // We might want to disable the button temporarily or change text after "hint"
        updatePlayButton(true, false); // Keep enabled, text reflects no audio
    }
}

// --- User Actions ---
function handleGuess() {
    if (!currentSong) return;
    const userGuess = guessInput.value.trim();
    if (!userGuess) return;
    
    console.log(`Guess: ${userGuess}, Stage: ${currentStage + 1}, Track: ${currentSong.id}`);

    const isCorrect = checkGuess(userGuess, currentSong.title, currentSong.artist);

    if (isCorrect) {
        handleSuccess();
    } else {
        // Add wrong guess to history
        addHistoryItem('wrong', userGuess);
        advanceStageOrEndGame("Wrong guess");
    }
    guessInput.value = ''; // Clear input after guess
    clearAutocompleteSuggestions();
}

function handleSkip() {
    if (!currentSong) {
        console.log("No current song to skip");
        return;
    }
    console.log(`Skip: Stage: ${currentStage + 1}, Track: ${currentSong.id}`);
    
    // Add skip to history
    addHistoryItem('skipped');
    stopAudio(); // Stop current audio if playing
    advanceStageOrEndGame("Skipped");
}

function advanceStageOrEndGame(outcome) {
    console.log(`Advancing stage. Current stage: ${currentStage}, Outcome: ${outcome}`);
    currentStage++;
    
    if (currentStage < MAX_STAGES) {
        console.log(`Moving to stage ${currentStage + 1}`);
        startStage();
    } else {
        console.log("No more stages, ending game");
        handleFailure(outcome + " - All stages used.");
    }
}

// --- Game End ---
function handleSuccess() {
    stopAudio(); 
    console.log("Correct! Congratulations!", { trackId: currentSong.id, stage: currentStage + 1, outcome: "Correct" });
    if (currentSong.previewUrl) {
        playFullPreview(currentSong.previewUrl, 
            (currentTime) => updateTimer(Math.round(currentTime)), // onTimeUpdate
            () => updateTimer(0) // onPreviewEnd, reset timer to 0 or show full duration
        );
    }
    showSuccessScreen(currentSong.title, currentSong.artist, startGame);
}

function handleFailure(reason = "No more attempts") {
    debugger;
    stopAudio();
    console.log(`MAIN: handleFailure called. Reason: ${reason}`, { trackId: currentSong ? currentSong.id : 'N/A', stage: currentStage + 1, outcome: "Failure" });
    if (currentSong && currentSong.previewUrl) {
        playFullPreview(currentSong.previewUrl, 
            (currentTime) => updateTimer(Math.round(currentTime)), // onTimeUpdate
            () => updateTimer(0) // onPreviewEnd, reset timer to 0 or show full duration
        );
    }
    const songTitle = currentSong ? currentSong.title : "Unknown Title";
    const songArtist = currentSong ? currentSong.artist : "Unknown Artist";
    showFailureScreen(songTitle, songArtist, startGame);
}

function handleMuteToggle() {
    const isMuted = toggleMute();
    updateMuteButtonText(isMuted);
}


// --- Start Application ---
initializeApp(); 