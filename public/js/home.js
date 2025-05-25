document.addEventListener('DOMContentLoaded', () => {
    const playlistUrlInput = document.getElementById('playlist-url');
    const artistNameInput = document.getElementById('artist-name');
    const validateButton = document.getElementById('validate-input-btn');
    const messageArea = document.getElementById('validation-message');
    const startGameButton = document.getElementById('go-to-game-button');

    const inputModeRadios = document.querySelectorAll('input[name="input-mode"]');
    const playlistInputSection = document.getElementById('playlist-input-section');
    const artistInputSection = document.getElementById('artist-input-section');

    let currentInputMode = 'playlist';

    function updateInputModeUI(mode) {
        currentInputMode = mode;
        if (mode === 'playlist') {
            playlistInputSection.style.display = 'block';
            artistInputSection.style.display = 'none';
            validateButton.textContent = 'Validate Playlist';
            playlistUrlInput.focus();
        } else if (mode === 'artist') {
            playlistInputSection.style.display = 'none';
            artistInputSection.style.display = 'block';
            validateButton.textContent = 'Set Artist & Start';
            artistNameInput.focus();
        }
        messageArea.textContent = '';
    }

    inputModeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            updateInputModeUI(event.target.value);
        });
    });

    const storedInputMode = localStorage.getItem('userInputMode');
    const storedPlaylistId = localStorage.getItem('userPlaylistId');
    const storedArtistName = localStorage.getItem('userArtistName');

    if (storedInputMode) {
        const radioToSelect = document.querySelector(`input[name="input-mode"][value="${storedInputMode}"]`);
        if (radioToSelect) radioToSelect.checked = true;
        updateInputModeUI(storedInputMode);

        if (storedInputMode === 'playlist' && storedPlaylistId) {
            messageArea.textContent = 'Previously used playlist ID is set. Validate or start.';
            messageArea.style.color = '#2ecc71';
        } else if (storedInputMode === 'artist' && storedArtistName) {
            artistNameInput.value = storedArtistName;
            messageArea.textContent = `Previously used artist: ${storedArtistName}. Set new artist or start.`;
            messageArea.style.color = '#2ecc71';
        }
    } else {
        updateInputModeUI('playlist');
    }

    if (validateButton) {
        validateButton.addEventListener('click', async () => {
            if (currentInputMode === 'playlist') {
                const playlistUrl = playlistUrlInput.value.trim();
                if (!playlistUrl) {
                    messageArea.textContent = 'Please enter a Spotify playlist URL.';
                    messageArea.style.color = '#e74c3c';
                    return;
                }
                const playlistId = extractPlaylistId(playlistUrl);
                if (!playlistId) {
                    messageArea.textContent = 'Invalid Spotify playlist URL format.';
                    messageArea.style.color = '#e74c3c';
                    return;
                }

                messageArea.textContent = 'Validating...';
                messageArea.style.color = '#ccc';

                try {
                    const response = await fetch(`/api/playlist/validate?id=${playlistId}`);
                    const result = await response.json();

                    if (response.ok && result.success) {
                        messageArea.textContent = `Success! Playlist '${result.name || 'Playlist'}' ready. Redirecting to game...`;
                        messageArea.style.color = '#2ecc71';
                        localStorage.setItem('userPlaylistId', playlistId);
                        localStorage.setItem('userArtistName', '');
                        localStorage.setItem('userInputMode', 'playlist');
                        window.location.href = '/game';
                    } else {
                        messageArea.textContent = result.message || 'Failed to validate playlist. Try a different link.';
                        messageArea.style.color = '#e74c3c';
                        localStorage.removeItem('userPlaylistId');
                        localStorage.removeItem('userInputMode');
                    }
                } catch (error) {
                    console.error('Error validating playlist:', error);
                    messageArea.textContent = 'Error validating playlist. Check console or try again.';
                    messageArea.style.color = '#e74c3c';
                    localStorage.removeItem('userPlaylistId');
                    localStorage.removeItem('userInputMode');
                }
            } else if (currentInputMode === 'artist') {
                const artistName = artistNameInput.value.trim();
                if (!artistName) {
                    messageArea.textContent = 'Please enter an artist name.';
                    messageArea.style.color = '#e74c3c';
                    return;
                }
                messageArea.textContent = `Artist '${artistName}' set. Redirecting to game...`;
                messageArea.style.color = '#2ecc71';
                localStorage.setItem('userArtistName', artistName);
                localStorage.setItem('userPlaylistId', '');
                localStorage.setItem('userInputMode', 'artist');
                window.location.href = '/game';
            }
        });
    }
});

function extractPlaylistId(url) {
    try {
        const path = new URL(url).pathname;
        const parts = path.split('/');
        const playlistIndex = parts.indexOf('playlist');
        if (playlistIndex !== -1 && parts.length > playlistIndex + 1) {
            const idCandidate = parts[playlistIndex + 1];
            if (idCandidate && /^[a-zA-Z0-9]{22}$/.test(idCandidate)) {
                 return idCandidate;
            }
        }
    } catch (e) {
        console.error('Error parsing playlist URL:', e);
    }
    return null;
} 