let currentAudio = null;
let muteState = false; // false = not muted, true = muted

export async function playSnippet(previewUrl, duration) {
    if (currentAudio) {
        currentAudio.pause();
    }
    currentAudio = new Audio(previewUrl);
    currentAudio.volume = muteState ? 0 : 1;
    currentAudio.currentTime = 0;

    try {
        await currentAudio.play();
        console.log(`Playing snippet: ${previewUrl} for ${duration}s`);
        setTimeout(() => {
            if (currentAudio && !currentAudio.paused) {
                currentAudio.pause();
                console.log(`Snippet paused after ${duration}s`);
            }
        }, duration * 1000);
    } catch (error) {
        console.error("Error playing audio snippet:", error);
        // Potentially handle specific errors, e.g., user gesture needed
    }
}

export async function playFullPreview(previewUrl) {
    if (currentAudio) {
        currentAudio.pause();
    }
    currentAudio = new Audio(previewUrl);
    currentAudio.volume = muteState ? 0 : 1;
    currentAudio.currentTime = 0;
    try {
        await currentAudio.play();
        console.log(`Playing full preview: ${previewUrl}`);
    } catch (error) {
        console.error("Error playing full audio preview:", error);
    }
}

export function stopAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0; // Reset for next play
        currentAudio = null;
        console.log("Audio stopped");
    }
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