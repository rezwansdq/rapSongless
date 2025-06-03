import { showScreen, updateStageCounter, updateTimer, updateProgressBar, displayAutocompleteSuggestions, clearAutocompleteSuggestions, updatePlayButton, showSuccessScreen, showFailureScreen, addGuessResult, resetGuessBoxes, setCurrentSnippetDuration /*, displayAlbumArt */, showLoadingOverlay, hideLoadingOverlay } from './ui.js';
import * as api from './api.js';
import { playSnippet, playFullPreview, stopAudio, isAudioPlaying, setVolume, currentAudio } from './audio.js';
import { checkGuess } from './search.js'; // Only checkGuess is needed from search.js now

// DOM Elements
// const startButton = document.getElementById('start-button'); // REMOVED
const playPauseButton = document.getElementById('play-pause-button');
const guessInput = document.getElementById('guess-input');
const submitButton = document.getElementById('submit-button');
const skipButton = document.getElementById('skip-button');
const volumeSlider = document.getElementById('volume-slider-modal'); // Updated ID
const settingsButton = document.getElementById('settings-button'); // New
const settingsModal = document.getElementById('settings-modal'); // New
const closeSettingsButton = document.getElementById('close-settings-button'); // New
// const volumePercentage = document.getElementById('volume-percentage'); // Removed
// Play Next and Try Again buttons will be handled by UI module or dynamically added

// Game State
let currentSong = null;
let currentStage = 0; // 0-indexed for snippetDurations array
let score = 0; // Could be used for future enhancements
let debounceTimer = null; // For debouncing autocomplete API calls
let audioPlaybackState = false; // Track if audio is currently playing
let playedTrackIds = new Set(); // To keep track of played song IDs
let activeGameParameterForPlayedIds = null; // Stores the playlist/artist for the current playedTrackIds set
let pausedTime = 0; // To keep track of paused time
const snippetDurations = [0.2, 0.7, 2.5, 5, 9, 15]; // Seconds
const MAX_STAGES = snippetDurations.length;

// --- Initialization ---
async function initializeApp() {
    // showScreen('landing-screen'); // REMOVED - index.html is now directly the game page
    setupEventListeners();
    // Set initial volume based on slider default
    if (volumeSlider) {
        setVolume(parseInt(volumeSlider.value) / 100);
        // if(volumePercentage) volumePercentage.textContent = `${volumeSlider.value}%`; // Removed
    }
    startGame(); // ADDED: Start the game automatically when index.html (game page) loads
}

function setupEventListeners() {
    // if (startButton) startButton.addEventListener('click', startGame); // REMOVED
    if (playPauseButton) playPauseButton.addEventListener('click', togglePlayPause);
    if (submitButton) submitButton.addEventListener('click', handleGuess);
    if (skipButton) {
        skipButton.addEventListener('click', () => {
            console.log("Skip button clicked"); // Debug log
            handleSkip();
        });
    }

    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            showSettingsModal();
        });
    }

    if (closeSettingsButton) {
        closeSettingsButton.addEventListener('click', () => {
            hideSettingsModal();
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
        guessInput.addEventListener('blur', () => { // Added blur event listener
            // Adding a small delay to allow click on suggestion to register
            setTimeout(() => {
                clearAutocompleteSuggestions();
            }, 100); 
        });
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('input', (event) => {
            const newVolume = parseInt(event.target.value) / 100;
            setVolume(newVolume);
            // if (volumePercentage) { // Removed
            //     volumePercentage.textContent = `${event.target.value}%`; // Removed
            // }
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
        pausedTime = currentAudio ? currentAudio.currentTime : 0; // Record the current time when pausing
        stopAudio();
        audioPlaybackState = false;
        updatePlayButton(true, true, false); // Enable button, has preview, not playing
    } else {
        // If audio is not playing, play it
        if (currentAudio)
            if (currentAudio.currentTime != 0) pausedTime = currentAudio ? currentAudio.currentTime : 0; // Reset paused time if snippet has ended
        playCurrentSnippet();
        audioPlaybackState = true;
        updatePlayButton(false, true, true); // Disable button while starting, playing
    }
}

// --- Game Flow ---
async function startGame() {
    console.log("Game Starting...");
    showLoadingOverlay(); // Show loading screen immediately
    
    const userInputMode = localStorage.getItem('userInputMode');
    const userPlaylistId = localStorage.getItem('userPlaylistId');
    const userArtistName = localStorage.getItem('userArtistName');
    const userGenreName = localStorage.getItem('userGenreName'); // New

    let gameParameter = null;
    let mode = null;

    if (userInputMode === 'playlist' && userPlaylistId) {
        console.log(`MAIN: Starting game with playlist ID: ${userPlaylistId}`);
        gameParameter = userPlaylistId;
        mode = 'playlist';
    } else if (userInputMode === 'artist' && userArtistName) {
        console.log(`MAIN: Starting game with artist name: ${userArtistName}`);
        gameParameter = userArtistName;
        mode = 'artist';
    } else if (userInputMode === 'genre' && userPlaylistId && userGenreName) { // Use userPlaylistId for genre too
        console.log(`MAIN: Starting game with genre: ${userGenreName} (Playlist ID: ${userPlaylistId})`);
        gameParameter = userPlaylistId; // The playlist ID associated with the genre
        mode = 'playlist'; // Still fetching from a playlist, just pre-selected
    } else {
        console.warn("MAIN: No valid user input (playlist ID, artist name, or genre) found in localStorage. Redirecting to home.");
        hideLoadingOverlay();
        alert("No playlist, artist, or genre selected! Please go to the homepage and set one up first.");
        window.location.href = '/home.html';
        return;
    }

    // Check if the game parameter has changed. If so, reset playedTrackIds.
    // For genre mode, activeGameParameterForPlayedIds will store the playlist ID.
    if (activeGameParameterForPlayedIds !== gameParameter) {
        console.log(`MAIN: Game parameter changed from '${activeGameParameterForPlayedIds}' to '${gameParameter}'. Clearing playedTrackIds.`);
        playedTrackIds.clear();
        activeGameParameterForPlayedIds = gameParameter;
    } else {
        console.log(`MAIN: Continuing with game parameter '${gameParameter}'. Played IDs count: ${playedTrackIds.size}`);
    }

    resetGameState();

    try {
        // Pass the mode to getRandomSong for clarity, though the backend will infer from param name
        // Also pass the playedTrackIds set
        currentSong = await api.getRandomSong(gameParameter, mode, playedTrackIds); 
        hideLoadingOverlay(); // Hide loading screen after song is fetched

        if (!currentSong || !currentSong.previewUrl) { // Check for previewUrl as well now
            console.error("CRITICAL: Failed to fetch a complete song with previewUrl from API.");
            let alertMessage = "Error: Could not load a new song.";
            if (mode === 'artist') {
                alertMessage += ` For artist: '${gameParameter}'. All unique songs may have been played, or no suitable tracks were found. Try a different artist or playlist, or reset.`;
            } else {
                alertMessage += " All unique songs from this playlist may have been played, or no suitable tracks were found. Please try again later, use a different playlist, or reset.";
            }
            alert(alertMessage);
            window.location.href = '/home.html'; // New: Redirect to actual home page
            return;
        }
        
        // Add the current song's ID to the set of played tracks
        if (currentSong && currentSong.id) {
            playedTrackIds.add(currentSong.id);
            console.log(`MAIN: Added ${currentSong.id} to playedTrackIds. Current set size: ${playedTrackIds.size}`);
        }

        showScreen('game-screen'); // Now show the game screen as song is ready
        console.log("Current song for the game:", currentSong);
        /*if (currentSong.albumArt) {
            displayAlbumArt(currentSong.albumArt); // Display album art if available
        } else {
            displayAlbumArt(null); // Clear album art if not available
        }*/
        updatePlayButton(true, !!currentSong.previewUrl, false); // Update button based on preview availability
        startStage();
    } catch (error) {
        hideLoadingOverlay(); // Ensure loading screen is hidden on error too
        console.error("Error starting game:", error);
        alert("Error starting the game. Please check console and try again.");
        // showScreen('landing-screen'); // Old
        window.location.href = '/home.html'; // New: Redirect to actual home page
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
    pausedTime = 0; // Reset paused time for a new game
    // displayAlbumArt(null); // Clear album art on reset
    // DO NOT Clear playedTrackIds here anymore. It's managed at the start of startGame.
    // console.log("MAIN: playedTrackIds cleared during resetGameState.");
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
    pausedTime = 0; // Reset paused time for a new stage
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
        
        playSnippet(pausedTime,
            currentSong.previewUrl, 
            duration,
            (currentTime) => updateTimer(currentTime), // onTimeUpdate callback - passing raw time now
            () => {
                audioPlaybackState = false;
                updatePlayButton(true, true, false);
                pausedTime = 0; // Reset pausedTime after snippet finishes or is played through
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
                pausedTime = 0; // Reset pausedTime after full preview
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
                pausedTime = 0; // Reset pausedTime after full preview
            }
        );
        audioPlaybackState = true;
    }
    
    const songTitle = currentSong ? currentSong.title : "Unknown Title";
    const songArtist = currentSong ? currentSong.artist : "Unknown Artist";
    showFailureScreen(songTitle, songArtist, startGame);
}

// New functions for settings modal
function showSettingsModal() {
    if (settingsModal) {
        settingsModal.classList.add('active');
        // Add blur to game screen content
        document.classList.add('blurred');
    }
}

function hideSettingsModal() {
    if (settingsModal) {
        settingsModal.classList.remove('active');
        // Remove blur from game screen content
        document.classList.remove('blurred');
    }
}

// --- Start Application ---
initializeApp(); 