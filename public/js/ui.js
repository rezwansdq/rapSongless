const screens = document.querySelectorAll('.screen');
// Store the current snippet duration for progress bar calculation
let currentSnippetDuration = 0;
// Track if audio is currently playing
let isPlaying = false;

export function showScreen(screenId) {
    console.log(`UI: Attempting to show screen: ${screenId}`); // DEBUG
    const screens = document.querySelectorAll('.screen');
    let screenFound = false; // Flag to track if the screen is found
    screens.forEach(screen => {
        screen.classList.remove('active');
        if (screen.id === screenId) {
            screen.classList.add('active');
            screenFound = true; // Set flag to true if screen is found and activated
        }
    });
    if (!screenFound) { // Check the flag
        console.error(`UI: Screen with ID '${screenId}' not found.`); // DEBUG
    }
}

export function updateStageCounter(currentStage, totalStages) {
    const stageElement = document.getElementById('stage-counter');
    if (stageElement) {
        stageElement.textContent = `Stage ${currentStage}`;
    }
    
    // Update the stage duration display
    const stageDurationElement = document.getElementById('stage-duration');
    if (stageDurationElement) {
        const duration = getStageDuration(currentStage - 1); // Convert to 0-indexed
        stageDurationElement.textContent = `${duration} ${duration === 1 ? 'Second' : 'Seconds'}`;
    }
}

// Helper to get stage duration for display
function getStageDuration(stageIndex) {
    // These should match the snippetDurations array in main.js
    const durations = [0.3, 0.7, 2.5, 5, 9, 15];
    return durations[stageIndex] || 0;
}

// Set the current snippet duration for progress bar calculations
export function setCurrentSnippetDuration(duration) {
    currentSnippetDuration = duration;
}

export function updateTimer(elapsedTime) {
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.textContent = formatTime(elapsedTime);
    }
    
    // Update progress bar based on fixed duration
    if (currentSnippetDuration > 0) {
        // Calculate the percentage based on the fixed duration
        const percentage = Math.min(Math.ceil((elapsedTime / currentSnippetDuration) * 100), 100);
        updateProgressBar(percentage);
    }
}

function formatTime(seconds) {
    // Round up to nearest 0.1 second
    const roundedSeconds = Math.ceil(seconds * 10) / 10;
    // Format with 1 decimal place
    return `${roundedSeconds.toFixed(1)}sec`;
}

export function updateProgressBar(percentage) {
    const progressBarFill = document.getElementById('progress-bar');
    if (progressBarFill) {
        progressBarFill.style.width = `${percentage}%`;
    }
}

export function displayAutocompleteSuggestions(suggestions, onSelectCallback) {
    const autocompleteResults = document.getElementById('autocomplete-results');
    if (!autocompleteResults) return;

    autocompleteResults.innerHTML = ''; // Clear previous suggestions
    if (suggestions.length === 0) {
        autocompleteResults.classList.remove('active');
        return;
    }

    suggestions.forEach(song => {
        const item = document.createElement('div');
        item.classList.add('autocomplete-item');
        item.textContent = `${song.title} - ${song.artist}`;
        item.addEventListener('click', () => {
            onSelectCallback(`${song.title}`); // Pass the full title or combined, as needed
            autocompleteResults.innerHTML = '';
            autocompleteResults.classList.remove('active');
        });
        autocompleteResults.appendChild(item);
    });
    autocompleteResults.classList.add('active');
}

export function clearAutocompleteSuggestions() {
    const autocompleteResults = document.getElementById('autocomplete-results');
    if (autocompleteResults) {
        autocompleteResults.innerHTML = '';
        autocompleteResults.classList.remove('active');
    }
}

/*
export function displayAlbumArt(imageUrl) {
    const imgElement = document.getElementById('album-art-img');
    if (imgElement) {
        if (imageUrl) {
            imgElement.src = imageUrl;
            imgElement.style.display = 'block';
        } else {
            imgElement.src = '';
            imgElement.style.display = 'none';
        }
    }
}
*/

export function updatePlayButton(isEnabled, hasPreview, isCurrentlyPlaying = null) {
    const playButton = document.getElementById('play-pause-button');
    if (!playButton) return;
    
    // Always update playing state if provided
    if (isCurrentlyPlaying !== null) {
        isPlaying = isCurrentlyPlaying;
        console.log(`UI: updatePlayButton called with isCurrentlyPlaying=${isCurrentlyPlaying}`);
    }
    
    // Enable/disable the button
    playButton.disabled = !isEnabled;
    
    // Update the button icon based on play state
    const iconSpan = playButton.querySelector('span') || document.createElement('span');
    
    if (isPlaying) {
        iconSpan.textContent = '⏸️'; // Pause icon
        iconSpan.className = 'pause-icon';
    } else {
        iconSpan.textContent = '▶'; // Play icon
        iconSpan.className = 'play-icon';
    }
    
    // If the button doesn't already have the span, add it
    if (!playButton.querySelector('span')) {
        playButton.innerHTML = '';
        playButton.appendChild(iconSpan);
    }
}

// Function to update a specific guess box
export function updateGuessBox(index, type, guess = '') {
    const guessBoxes = document.querySelectorAll('.guess-box');
    if (index < 0 || index >= guessBoxes.length) return;
    
    const box = guessBoxes[index];
    
    // Remove all existing classes except 'guess-box'
    box.className = 'guess-box';
    
    // Add the appropriate class based on type
    box.classList.add(type);
    
    // Clear existing content
    box.innerHTML = '';
    
    if (type === 'skipped') {
        // Skipped boxes use ::before and ::after in CSS for content
    } else if (type === 'wrong' && guess) {
        // Add guess text
        const guessText = document.createElement('span');
        guessText.className = 'guess-text';
        guessText.textContent = guess;
        box.appendChild(guessText);
        
        // Add status
        const status = document.createElement('span');
        status.className = 'status';
        status.textContent = 'WRONG';
        box.appendChild(status);
    } else if (type === 'correct' && guess) {
        // Add guess text
        const guessText = document.createElement('span');
        guessText.className = 'guess-text';
        guessText.textContent = guess;
        box.appendChild(guessText);
        
        // Add status
        const status = document.createElement('span');
        status.className = 'status';
        status.textContent = 'CORRECT';
        box.appendChild(status);
    }
}

// Reset all guess boxes to empty
export function resetGuessBoxes() {
    const guessBoxes = document.querySelectorAll('.guess-box');
    guessBoxes.forEach(box => {
        box.className = 'guess-box empty';
        box.innerHTML = '';
    });
}

export function addGuessResult(type, guess = '', currentStage) {
    // Update the appropriate guess box based on the current stage (0-indexed)
    updateGuessBox(currentStage - 1, type, guess);
}

export function showSuccessScreen(songTitle, artist, onPlayNext) {
    const modal = document.getElementById('success-modal');
    const songInfo = document.getElementById('success-song-info');
    const playNextButton = document.getElementById('play-next-button');

    // Add correct guess to the current box
    addGuessResult('correct', songTitle, 6); // Assuming always showing in last box on success
    
    songInfo.textContent = `${songTitle} - ${artist}`;
    modal.style.display = 'block';

    playNextButton.replaceWith(playNextButton.cloneNode(true));
    document.getElementById('play-next-button').addEventListener('click', () => {
        modal.style.display = 'none';
        resetGuessBoxes(); // Reset boxes for new game
        if (onPlayNext) onPlayNext();
    });
}

export function showFailureScreen(songTitle, artist, onTryAgain) {
    const modal = document.getElementById('failure-modal');
    const songInfo = document.getElementById('failure-song-info');
    const tryAgainButton = document.getElementById('try-again-button');

    songInfo.textContent = `The song was: ${songTitle} - ${artist}`;
    modal.style.display = 'block';

    tryAgainButton.replaceWith(tryAgainButton.cloneNode(true));
    document.getElementById('try-again-button').addEventListener('click', () => {
        modal.style.display = 'none';
        resetGuessBoxes(); // Reset boxes for new game
        if (onTryAgain) onTryAgain();
    });
}

// Placeholder for other UI update functions
// e.g., updateSongInfo, displayAutocomplete, showSuccess, showFailure 

// Loading Screen Overlay functions
export function showLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('active');
        console.log("UI: Loading overlay SHOWN");
    }
}

export function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        console.log("UI: Loading overlay HIDDEN");
    }
} 