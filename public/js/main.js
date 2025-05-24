import { showScreen, updateStageCounter, updateTimer, updateProgressBar, displayAutocompleteSuggestions, clearAutocompleteSuggestions, updatePlayButton, showSuccessScreen, showFailureScreen, addGuessResult, resetGuessBoxes, setCurrentSnippetDuration /*, displayAlbumArt */ } from './ui.js';
import * as api from './api.js';
import { playSnippet, playFullPreview, stopAudio, isAudioPlaying, setVolume } from './audio.js';
import { checkGuess } from './search.js'; // Only checkGuess is needed from search.js now

// DOM Elements
const startButton = document.getElementById('start-button');
const playPauseButton = document.getElementById('play-pause-button');
const guessInput = document.getElementById('guess-input');
const submitButton = document.getElementById('submit-button');
const skipButton = document.getElementById('skip-button');
const volumeSlider = document.getElementById('volume-slider');
const volumePercentage = document.getElementById('volume-percentage');
// Play Next and Try Again buttons will be handled by UI module or dynamically added

// Game State
let currentSong = null;
let currentStage = 0; // 0-indexed for snippetDurations array
let score = 0; // Could be used for future enhancements
let debounceTimer = null; // For debouncing autocomplete API calls
let audioPlaybackState = false; // Track if audio is currently playing

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
    // Set initial volume based on slider default
    if (volumeSlider) {
        setVolume(parseInt(volumeSlider.value) / 100);
        if(volumePercentage) volumePercentage.textContent = `${volumeSlider.value}%`;
    }
}

function setupEventListeners() {
    if (startButton) startButton.addEventListener('click', startGame);
    if (playPauseButton) playPauseButton.addEventListener('click', togglePlayPause);
    if (submitButton) submitButton.addEventListener('click', handleGuess);
    if (skipButton) {
        skipButton.addEventListener('click', () => {
            console.log("Skip button clicked"); // Debug log
            handleSkip();
        });
    }

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

    if (volumeSlider) {
        volumeSlider.addEventListener('input', (event) => {
            const newVolume = parseInt(event.target.value) / 100;
            setVolume(newVolume);
            if (volumePercentage) {
                volumePercentage.textContent = `${event.target.value}%`;
            }
        });
    }
}

// Toggle play/pause functionality
function togglePlayPause() {
    if (!currentSong) {
        console.error("No song loaded to play/pause.");
        return;
    }
    
    // Check the actual audio playing state from the audio module
    const currentlyPlaying = isAudioPlaying();
    console.log(`Toggle play/pause called. Currently playing: ${currentlyPlaying}, audioPlaybackState: ${audioPlaybackState}`);
    
    if (currentlyPlaying) {
        // If audio is playing, stop it
        stopAudio();
        audioPlaybackState = false;
        updatePlayButton(true, true, false); // Enable button, has preview, not playing
    } else {
        // If audio is not playing, play it
        playCurrentSnippet();
        audioPlaybackState = true;
        updatePlayButton(false, true, true); // Disable button while starting, playing
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
        updatePlayButton(true, !!currentSong.previewUrl, false); // Update button based on preview availability
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
    audioPlaybackState = false;
    stopAudio(); // Stop any previous audio & clears its own timer interval
    updateStageCounter(1, MAX_STAGES);
    updateTimer(0); // Reset timer display to 0:00
    updateProgressBar(0);
    setCurrentSnippetDuration(0); // Reset the snippet duration
    if(guessInput) guessInput.value = '';
    clearAutocompleteSuggestions();
    resetGuessBoxes(); // Reset all guess boxes to empty
    // displayAlbumArt(null); // Clear album art on reset
}

function startStage() {
    console.log(`Starting stage ${currentStage + 1}. Current song title: ${currentSong ? currentSong.title : 'N/A'}`);
    if (!currentSong || currentStage >= MAX_STAGES) {
        handleFailure("Max stages reached or no song.");
        return;
    }
    updateStageCounter(currentStage + 1, MAX_STAGES);
    updateProgressBar(0); // Reset progress bar at the start of each stage
    setCurrentSnippetDuration(0); // Reset snippet duration
    updatePlayButton(true, !!(currentSong && currentSong.previewUrl), false); 
    updateTimer(0); // Reset timer to 0:00 at the start of a stage, before snippet plays
}

function playCurrentSnippet() {
    if (!currentSong) {
        console.error("No song loaded to play snippet.");
        return;
    }
    if (currentSong.previewUrl) {
        const duration = snippetDurations[currentStage];
        // Set the current snippet duration for progress bar calculation
        setCurrentSnippetDuration(duration);
        
        playSnippet(
            currentSong.previewUrl, 
            duration,
            (currentTime) => updateTimer(currentTime), // onTimeUpdate callback - passing raw time now
            () => {
                audioPlaybackState = false;
                updatePlayButton(true, true, false); // Re-enable play button, not playing
            }
        );
        audioPlaybackState = true;
    } else {
        // No preview URL - this click could reveal a text hint in the future
        console.log("Play Snippet clicked, but no previewUrl. Stage:", currentStage + 1);
        updatePlayButton(true, false, false); // Keep enabled, no preview available
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
        // Add wrong guess to current box
        addGuessResult('wrong', userGuess, currentStage + 1);
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
    
    // Add skip to current box
    addGuessResult('skipped', '', currentStage + 1);
    
    // Stop audio if playing
    if (audioPlaybackState) {
        stopAudio();
        audioPlaybackState = false;
    }
    
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
    // Stop audio if playing
    if (audioPlaybackState) {
        stopAudio();
        audioPlaybackState = false;
    }
    
    console.log("Correct! Congratulations!", { trackId: currentSong.id, stage: currentStage + 1, outcome: "Correct" });
    
    if (currentSong.previewUrl) {
        // For full preview, set a longer duration (30 seconds is typical for previews)
        setCurrentSnippetDuration(30);
        
        playFullPreview(currentSong.previewUrl, 
            (currentTime) => updateTimer(currentTime), // onTimeUpdate - passing raw time now
            () => {
                audioPlaybackState = false;
                updateTimer(0); // Reset timer to 0 when preview ends
            }
        );
        audioPlaybackState = true;
    }
    
    showSuccessScreen(currentSong.title, currentSong.artist, startGame);
}

function handleFailure(reason = "No more attempts") {
    // Stop audio if playing
    if (audioPlaybackState) {
        stopAudio();
        audioPlaybackState = false;
    }
    
    console.log(`MAIN: handleFailure called. Reason: ${reason}`, { trackId: currentSong ? currentSong.id : 'N/A', stage: currentStage + 1, outcome: "Failure" });
    
    if (currentSong && currentSong.previewUrl) {
        // For full preview, set a longer duration (30 seconds is typical for previews)
        setCurrentSnippetDuration(30);
        
        playFullPreview(currentSong.previewUrl, 
            (currentTime) => updateTimer(currentTime), // onTimeUpdate - passing raw time now
            () => {
                audioPlaybackState = false;
                updateTimer(0); // Reset timer to 0 when preview ends
            }
        );
        audioPlaybackState = true;
    }
    
    const songTitle = currentSong ? currentSong.title : "Unknown Title";
    const songArtist = currentSong ? currentSong.artist : "Unknown Artist";
    showFailureScreen(songTitle, songArtist, startGame);
}

// --- Start Application ---
initializeApp(); 