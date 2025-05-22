const screens = document.querySelectorAll('.screen');

export function showScreen(screenId) {
    console.log(`UI: Attempting to show screen: ${screenId}`); // DEBUG
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
        if (screen.id === screenId) {
            screen.classList.add('active');
        }
    });
    if (!screens.some(screen => screen.id === screenId)) {
        console.error(`UI: Screen with ID '${screenId}' not found.`); // DEBUG
    }
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

export function updatePlayButton(isEnabled, hasPreview) {
    const playButton = document.getElementById('play-pause-button');
    if (playButton) {
        playButton.disabled = !isEnabled;
        if (!isEnabled && hasPreview) { // Playing audio
            playButton.textContent = "Playing...";
        } else if (hasPreview) {
            playButton.textContent = "Play Snippet";
        } else {
            playButton.textContent = "Get Hint (No Audio)"; // Or just "Get Hint"
        }
    }
}

export function addHistoryItem(type, guess = '') {
    const historyContainer = document.querySelector('.history-container');
    if (!historyContainer) return;

    const historyItem = document.createElement('div');
    historyItem.className = `history-item ${type}`;

    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '→';
    historyItem.appendChild(arrow);

    if (guess) {
        const guessText = document.createElement('span');
        guessText.className = 'guess';
        guessText.textContent = guess;
        historyItem.appendChild(guessText);
    }

    const status = document.createElement('span');
    status.className = 'status';
    status.textContent = type.toUpperCase();
    historyItem.appendChild(status);

    // Add with fade-in animation
    historyItem.style.opacity = '0';
    historyContainer.appendChild(historyItem);
    setTimeout(() => {
        historyItem.style.opacity = '1';
    }, 10);
}

export function clearHistory() {
    const historyContainer = document.querySelector('.history-container');
    if (historyContainer) {
        historyContainer.innerHTML = '';
    }
}

export function showSuccessScreen(songTitle, artist, albumArtUrl, onPlayNext) {
    const modal = document.getElementById('success-modal');
    const songInfo = document.getElementById('success-song-info');
    const playNextButton = document.getElementById('play-next-button');
    // Optional: Display album art in modal too
    // const modalAlbumArt = modal.querySelector('.album-art-modal-img'); 
    // if (modalAlbumArt && albumArtUrl) modalAlbumArt.src = albumArtUrl;

    addHistoryItem('correct', songTitle);
    songInfo.textContent = `${songTitle} - ${artist}`;
    modal.style.display = 'block';

    playNextButton.replaceWith(playNextButton.cloneNode(true));
    document.getElementById('play-next-button').addEventListener('click', () => {
        modal.style.display = 'none';
        clearHistory(); 
        if (onPlayNext) onPlayNext();
    });
}

export function showFailureScreen(songTitle, artist, albumArtUrl, onTryAgain) {
    const modal = document.getElementById('failure-modal');
    const songInfo = document.getElementById('failure-song-info');
    const tryAgainButton = document.getElementById('try-again-button');
    // Optional: Display album art in modal too
    // const modalAlbumArt = modal.querySelector('.album-art-modal-img');
    // if (modalAlbumArt && albumArtUrl) modalAlbumArt.src = albumArtUrl;

    addHistoryItem('wrong', `Failed. Song was: ${songTitle}`); // More informative history for failure
    songInfo.textContent = `The song was: ${songTitle} - ${artist}`;
    modal.style.display = 'block';

    tryAgainButton.replaceWith(tryAgainButton.cloneNode(true));
    document.getElementById('try-again-button').addEventListener('click', () => {
        modal.style.display = 'none';
        clearHistory(); 
        if (onTryAgain) onTryAgain();
    });
}

export function updateMuteButtonText(isMuted) {
    const muteButton = document.getElementById('mute-toggle');
    if (muteButton) {
        muteButton.textContent = isMuted ? "Unmute" : "Mute";
    }
}

// Placeholder for other UI update functions
// e.g., updateSongInfo, displayAutocomplete, showSuccess, showFailure 