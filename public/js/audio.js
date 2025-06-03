let currentAudio = null;
let audioTimerInterval = null; // Timer for tracking audio playback
let currentVolume = 0.5; // Default volume 50%

export function setVolume(volume) {
    currentVolume = volume;
    if (currentAudio) {
        currentAudio.volume = currentVolume;
    }
    console.log(`Audio: Volume set to ${Math.round(currentVolume * 100)}%`);
}

export async function playSnippet(previewUrl, duration, onTimeUpdate, onSnippetEnd) {
    if (currentAudio) {
        currentAudio.pause();
    }
    if (audioTimerInterval) {
        clearInterval(audioTimerInterval);
        audioTimerInterval = null;
    }

    currentAudio = new Audio(previewUrl);
    currentAudio.currentTime = 0;
    currentAudio.volume = currentVolume; // Apply current volume

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
            }, 100); // Update timer more frequently (10 times per second) for smoother progress
        }

        setTimeout(() => {
            if (currentAudio && !currentAudio.paused) {
                console.log(currentAudio.currentTime, currentAudio.paused);
                currentAudio.pause();
                console.log(`Snippet paused after ${duration}s`);
            }
            if (audioTimerInterval) {
                clearInterval(audioTimerInterval);
                audioTimerInterval = null;
            }
            // Call onSnippetEnd when the snippet duration is met
            if (onSnippetEnd) onSnippetEnd();
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
    currentAudio.currentTime = 0;
    currentAudio.volume = currentVolume; // Apply current volume

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
            }, 100); // Update timer more frequently for smoother progress
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

// Check if audio is currently playing
export function isAudioPlaying() {
    const isPlaying = currentAudio !== null && !currentAudio.paused;
    console.log(`AUDIO: isAudioPlaying check - currentAudio exists: ${currentAudio !== null}, not paused: ${currentAudio ? !currentAudio.paused : 'N/A'}, result: ${isPlaying}`);
    return isPlaying;
} 