const screens = document.querySelectorAll('.screen');

export function showScreen(screenId) {
    screens.forEach(screen => {
        if (screen.id === screenId) {
            screen.classList.add('active');
        } else {
            screen.classList.remove('active');
        }
    });
}

export function updateStageCounter(currentStage, totalStages) {
    const stageElement = document.getElementById('stage-counter');
    if (stageElement) {
        stageElement.textContent = `Stage ${currentStage}/${totalStages}`;
    }
    // console.log(`UI: Stage ${currentStage}/${totalStages}`);
}

export function updateTimer(elapsedTime) {
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.textContent = formatTime(elapsedTime);
    }
    // console.log(`UI: Timer ${elapsedTime}s`);
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const paddedSeconds = String(remainingSeconds).padStart(2, '0');
    return `${minutes}:${paddedSeconds}`;
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
        autocompleteResults.style.display = 'none';
        return;
    }

    suggestions.forEach(song => {
        const item = document.createElement('div');
        item.classList.add('autocomplete-item');
        item.textContent = `${song.title} - ${song.artist}`;
        item.addEventListener('click', () => {
            onSelectCallback(`${song.title}`); // Pass the full title or combined, as needed
            autocompleteResults.innerHTML = '';
            autocompleteResults.style.display = 'none';
        });
        autocompleteResults.appendChild(item);
    });
    autocompleteResults.style.display = 'block';
}

export function clearAutocompleteSuggestions() {
    const autocompleteResults = document.getElementById('autocomplete-results');
    if (autocompleteResults) {
        autocompleteResults.innerHTML = '';
        autocompleteResults.style.display = 'none';
    }
}

export function updatePlayButton(isReadyToPlay) {
    const playButton = document.getElementById('play-pause-button');
    if (playButton) {
        playButton.textContent = isReadyToPlay ? "Play Snippet" : "Playing...";
        // playButton.disabled = !isReadyToPlay; // Or some other indicator
    }
}

export function showSuccessScreen(title, artist, onPlayNextCallback) {
    showScreen('success-screen');
    const successMessage = document.getElementById('success-message');
    const playNextButton = document.getElementById('play-next-button');
    const songInfo = document.getElementById('success-song-info');

    if (successMessage) successMessage.textContent = "Congratulations!";
    if (songInfo) songInfo.textContent = `You guessed: ${title} by ${artist}`;

    if (playNextButton) {
        // Clone and replace to remove old listeners
        const newPlayNextButton = playNextButton.cloneNode(true);
        playNextButton.parentNode.replaceChild(newPlayNextButton, playNextButton);
        newPlayNextButton.addEventListener('click', () => {
            showScreen('landing-screen'); // Or directly call onPlayNextCallback if it handles screen transitions
            onPlayNextCallback();
        });
    }
}

export function showFailureScreen(title, artist, onTryAgainCallback) {
    showScreen('failure-screen');
    const failureMessage = document.getElementById('failure-message');
    const tryAgainButton = document.getElementById('try-again-button');
    const songInfo = document.getElementById('failure-song-info');

    if (failureMessage) failureMessage.textContent = "You failed!";
    if (songInfo) songInfo.textContent = `The song was: ${title} by ${artist}`;

    if (tryAgainButton) {
        const newTryAgainButton = tryAgainButton.cloneNode(true);
        tryAgainButton.parentNode.replaceChild(newTryAgainButton, tryAgainButton);
        newTryAgainButton.addEventListener('click', () => {
            showScreen('landing-screen');
            onTryAgainCallback();
        });
    }
}

export function updateMuteButtonText(isMuted) {
    const muteButton = document.getElementById('mute-toggle');
    if (muteButton) {
        muteButton.textContent = isMuted ? "Unmute" : "Mute";
    }
}

// Placeholder for other UI update functions
// e.g., updateSongInfo, displayAutocomplete, showSuccess, showFailure 