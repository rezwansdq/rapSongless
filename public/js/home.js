document.addEventListener('DOMContentLoaded', () => {
    const playlistUrlInput = document.getElementById('playlist-url');
    const validateButton = document.getElementById('validate-playlist-btn');
    const messageArea = document.getElementById('playlist-message');
    const startGameButton = document.getElementById('go-to-game-button');

    // Load stored playlist URL on page load
    const storedPlaylistId = localStorage.getItem('userPlaylistId');
    if (storedPlaylistId) {
        // For simplicity, we don't reconstruct the full URL, but we can indicate it's set.
        // Or, you could store the full URL if preferred.
        // We will re-validate if the user clicks validate again or just allow them to start.
        messageArea.textContent = 'A playlist ID is already set. You can start the game or validate a new one.';
        messageArea.style.color = '#2ecc71'; // Green
    }

    if (validateButton) {
        validateButton.addEventListener('click', async () => {
            const playlistUrl = playlistUrlInput.value.trim();
            if (!playlistUrl) {
                messageArea.textContent = 'Please enter a Spotify playlist URL.';
                messageArea.style.color = '#e74c3c'; // Red
                return;
            }

            const playlistId = extractPlaylistId(playlistUrl);

            if (!playlistId) {
                messageArea.textContent = 'Invalid Spotify playlist URL format.';
                messageArea.style.color = '#e74c3c'; // Red
                return;
            }

            messageArea.textContent = 'Validating...';
            messageArea.style.color = '#ccc'; // Neutral

            try {
                const response = await fetch(`/api/playlist/validate?id=${playlistId}`);
                const result = await response.json();

                if (response.ok && result.success) {
                    messageArea.textContent = `Success! Playlist found: ${result.name || 'Playlist'}`;
                    messageArea.style.color = '#2ecc71'; // Green
                    localStorage.setItem('userPlaylistId', playlistId); // Store the validated ID
                } else {
                    messageArea.textContent = result.message || 'Failed to validate playlist. Try a different link.';
                    messageArea.style.color = '#e74c3c'; // Red
                    localStorage.removeItem('userPlaylistId'); // Clear if validation fails
                }
            } catch (error) {
                console.error('Error validating playlist:', error);
                messageArea.textContent = 'Error validating playlist. Check console or try again.';
                messageArea.style.color = '#e74c3c'; // Red
                localStorage.removeItem('userPlaylistId');
            }
        });
    }

    if (startGameButton) {
        startGameButton.addEventListener('click', (event) => {
            const currentPlaylistId = localStorage.getItem('userPlaylistId');
            if (!currentPlaylistId) {
                event.preventDefault(); // Stop navigation
                messageArea.textContent = 'Please validate a Spotify playlist URL before starting the game.';
                messageArea.style.color = '#e74c3c'; // Red
                alert('Please enter and validate a Spotify playlist URL first!');
            }
            // If playlistId exists, the link will proceed to /game
        });
    }
});

function extractPlaylistId(url) {
    try {
        const path = new URL(url).pathname;
        const parts = path.split('/');
        // Expected format: /playlist/PLAYLIST_ID or /user/USER_ID/playlist/PLAYLIST_ID
        const playlistIndex = parts.indexOf('playlist');
        if (playlistIndex !== -1 && parts.length > playlistIndex + 1) {
            const idCandidate = parts[playlistIndex + 1];
            if (idCandidate && idCandidate.length === 22) { // Spotify IDs are 22 chars
                 return idCandidate;
            }
        }
    } catch (e) {
        // Invalid URL format
        console.error('Error parsing playlist URL:', e);
    }
    return null;
} 