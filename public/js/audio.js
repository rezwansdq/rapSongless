let currentAudio = null;
let muteState = false; // false = not muted, true = muted
let audioTimerInterval = null; // Timer for tracking audio playback

export async function playSnippet(previewUrl, duration, onTimeUpdate, onSnippetEnd) {
    if (currentAudio) {
        currentAudio.pause();
    }
    if (audioTimerInterval) {
        clearInterval(audioTimerInterval);
        audioTimerInterval = null;
    }

    currentAudio = new Audio(previewUrl);
    currentAudio.volume = muteState ? 0 : 1;
    currentAudio.currentTime = 0;

    // Call onTimeUpdate immediately with 0 to reset timer display
    if (onTimeUpdate) onTimeUpdate(0);

    try {
        await currentAudio.play();
        console.log(`Playing snippet: ${previewUrl} for ${duration}s`);

        // Update timer display during playback
        if (onTimeUpdate) {
            audioTimerInterval = setInterval(() => {
                if (currentAudio && !currentAudio.paused) {
                    onTimeUpdate(currentAudio.currentTime);
                } else {
                    clearInterval(audioTimerInterval);
                    audioTimerInterval = null;
                }
            }, 250); // Update timer display roughly 4 times a second
        }

        setTimeout(() => {
            if (currentAudio && !currentAudio.paused) {
                currentAudio.pause();
                console.log(`Snippet paused after ${duration}s`);
            }
            if (audioTimerInterval) {
                clearInterval(audioTimerInterval);
                audioTimerInterval = null;
            }
            // Call onSnippetEnd when the snippet duration is met
            if (onSnippetEnd) onSnippetEnd();
            // Optionally reset timer display to 0 or snippet duration
            // if (onTimeUpdate) onTimeUpdate(0); 
        }, duration * 1000);
    } catch (error) {
        console.error("Error playing audio snippet:", error);
        if (audioTimerInterval) {
            clearInterval(audioTimerInterval);
            audioTimerInterval = null;
        }
        if (onSnippetEnd) onSnippetEnd(); // Ensure onSnippetEnd is called on error too
    }
}

export async function playFullPreview(previewUrl, onTimeUpdate, onPreviewEnd) {
    if (currentAudio) {
        currentAudio.pause();
    }
    if (audioTimerInterval) {
        clearInterval(audioTimerInterval);
        audioTimerInterval = null;
    }
    currentAudio = new Audio(previewUrl);
    currentAudio.volume = muteState ? 0 : 1;
    currentAudio.currentTime = 0;

    if (onTimeUpdate) onTimeUpdate(0); // Reset timer display

    try {
        await currentAudio.play();
        console.log(`Playing full preview: ${previewUrl}`);
        if (onTimeUpdate) {
            audioTimerInterval = setInterval(() => {
                if (currentAudio && !currentAudio.paused) {
                    onTimeUpdate(currentAudio.currentTime);
                } else {
                    clearInterval(audioTimerInterval);
                    audioTimerInterval = null;
                }
            }, 250);
        }
        currentAudio.addEventListener('ended', () => {
            console.log("Full preview ended.");
            if (audioTimerInterval) {
                clearInterval(audioTimerInterval);
                audioTimerInterval = null;
            }
            if (onTimeUpdate) onTimeUpdate(currentAudio.duration); // Show full duration at end
            if (onPreviewEnd) onPreviewEnd();
        });

    } catch (error) {
        console.error("Error playing full audio preview:", error);
        if (audioTimerInterval) {
            clearInterval(audioTimerInterval);
            audioTimerInterval = null;
        }
        if (onPreviewEnd) onPreviewEnd(); // Ensure onPreviewEnd is called
    }
}

export function stopAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0; // Reset for next play
        currentAudio = null;
        console.log("Audio stopped");
    }
    if (audioTimerInterval) {
        clearInterval(audioTimerInterval);
        audioTimerInterval = null;
    }
    // Caller should update UI timer if needed, e.g., ui.updateTimer(0);
}

export function toggleMute() {
    muteState = !muteState;
    if (currentAudio) {
        currentAudio.volume = muteState ? 0 : 1;
    }
    console.log(muteState ? "Audio Muted" : "Audio Unmuted");
    return muteState;
}

export function getMuteState() {
    return muteState;
} 