document.addEventListener('DOMContentLoaded', () => {
    const playlistUrlInput = document.getElementById('playlist-url');
    const artistNameInput = document.getElementById('artist-name');
    const validateButton = document.getElementById('validate-input-btn');
    const messageArea = document.getElementById('validation-message');
    const startGameButton = document.getElementById('go-to-game-button');

    const modeButtons = document.querySelectorAll('.input-mode-selector .mode-btn');
    const playlistInputSection = document.getElementById('playlist-input-section');
    const artistInputSection = document.getElementById('artist-input-section');
    const genreInputSection = document.getElementById('genre-input-section');
    const dailySongSection = document.getElementById('daily-song-section');
    const genreSelect = document.getElementById('genre-select');

    const howToPlayButton = document.getElementById('how-to-play-btn');
    const howToPlayModal = document.getElementById('how-to-play-modal');
    const closeHowToPlayButton = document.getElementById('close-how-to-play-btn');

    let currentInputMode = 'daily';

    const genres = [
        { name: "R&B", playlistId: "0X4K4T2IqcV3MAZ7HhB8Qy" },
        { name: "Pop", playlistId: "6mtYuOxzl58vSGnEDtZ9uB" },
        { name: "Rap", playlistId: "01MRi9jFGeSEEttKOk7VgR" },
        { name: "Recent Hits", playlistId: "5KJDMJe9EJ7QRz8FG2MIpI" },
        { name: "2010s Hits", playlistId: "5XALIurWS8TuF6kk8bj438" },
        { name: "2000s Hits", playlistId: "1udqwx26htiKljZx4HwVxs" }
    ];

    function populateGenres() {
        if (genreSelect) {
            genreSelect.innerHTML = ''; // Clear existing options
            genres.forEach(genre => {
                const option = document.createElement('option');
                option.value = genre.playlistId; // Store playlist ID as value
                option.textContent = genre.name;
                genreSelect.appendChild(option);
            });
        }
    }

    function updateInputModeUI(mode) {
        currentInputMode = mode;
        playlistInputSection.style.display = 'none';
        artistInputSection.style.display = 'none';
        genreInputSection.style.display = 'none';
        if(dailySongSection) dailySongSection.style.display = 'none';

        modeButtons.forEach(btn => {
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        if (mode === 'playlist') {
            playlistInputSection.style.display = 'block';
            validateButton.textContent = 'Validate Playlist';
            playlistUrlInput.focus();
        } else if (mode === 'artist') {
            artistInputSection.style.display = 'block';
            validateButton.textContent = 'Set Artist & Start';
            artistNameInput.focus();
        } else if (mode === 'genre') {
            genreInputSection.style.display = 'block';
            populateGenres(); // Populate dropdown when genre mode is active
            validateButton.textContent = 'Set Genre & Start';
            if (genreSelect) genreSelect.focus();
        } else if (mode === 'daily') {
            if(dailySongSection) dailySongSection.style.display = 'block';
            validateButton.textContent = 'Start Daily Challenge';
        }
        messageArea.textContent = '';
    }

    modeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.dataset.mode;
            updateInputModeUI(mode);
            localStorage.setItem('userInputMode', mode); // Persist selected mode
        });
    });

    const storedInputMode = localStorage.getItem('userInputMode');
    const storedPlaylistId = localStorage.getItem('userPlaylistId');
    const storedArtistName = localStorage.getItem('userArtistName');
    const storedGenreName = localStorage.getItem('userGenreName');

    if (storedInputMode) {
        updateInputModeUI(storedInputMode);

        if (storedInputMode === 'playlist' && storedPlaylistId) {
            messageArea.textContent = 'Previously used playlist ID is set. Validate or start.';
            messageArea.style.color = '#2ecc71';
        } else if (storedInputMode === 'artist' && storedArtistName) {
            artistNameInput.value = storedArtistName;
            messageArea.textContent = `Previously used artist: ${storedArtistName}. Set new artist or start.`;
            messageArea.style.color = '#2ecc71';
        } else if (storedInputMode === 'genre' && storedGenreName) {
            if (genreSelect) genreSelect.value = storedPlaylistId || '';
            messageArea.textContent = `Previously used genre: ${storedGenreName}. Set new genre or start.`;
            messageArea.style.color = '#2ecc71';
        } else if (storedInputMode === 'daily') {
            messageArea.textContent = 'Daily challenge is ready. Press start to play.';
            messageArea.style.color = '#2ecc71';
        }
    } else {
        updateInputModeUI('daily');
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
                        localStorage.setItem('userGenreName', '');
                        window.location.href = '/game';
                    } else {
                        messageArea.textContent = result.message || 'Failed to validate playlist. Try a different link.';
                        messageArea.style.color = '#e74c3c';
                        localStorage.removeItem('userPlaylistId');
                        localStorage.removeItem('userInputMode');
                        localStorage.removeItem('userGenreName');
                    }
                } catch (error) {
                    console.error('Error validating playlist:', error);
                    messageArea.textContent = 'Error validating playlist. Check console or try again.';
                    messageArea.style.color = '#e74c3c';
                    localStorage.removeItem('userPlaylistId');
                    localStorage.removeItem('userInputMode');
                    localStorage.removeItem('userGenreName');
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
                localStorage.setItem('userGenreName', '');
                window.location.href = '/game';
            } else if (currentInputMode === 'genre') {
                const selectedPlaylistId = genreSelect ? genreSelect.value : null;
                const selectedGenreName = genreSelect ? genreSelect.options[genreSelect.selectedIndex].text : '';
                if (!selectedPlaylistId) {
                    messageArea.textContent = 'Please select a genre.';
                    messageArea.style.color = '#e74c3c';
                    return;
                }
                messageArea.textContent = `Genre '${selectedGenreName}' selected. Redirecting to game...`;
                messageArea.style.color = '#2ecc71';
                localStorage.setItem('userPlaylistId', selectedPlaylistId);
                localStorage.setItem('userArtistName', '');
                localStorage.setItem('userInputMode', 'genre');
                localStorage.setItem('userGenreName', selectedGenreName);
                window.location.href = '/game';
            } else if (currentInputMode === 'daily') {
                messageArea.textContent = 'Starting the daily challenge...';
                messageArea.style.color = '#2ecc71';
                localStorage.setItem('userPlaylistId', ''); // No longer needed
                localStorage.setItem('userArtistName', '');
                localStorage.setItem('userInputMode', 'daily');
                localStorage.setItem('userGenreName', 'Daily Song');
                window.location.href = '/game';
            }
        });
    }

    if (howToPlayButton) {
        howToPlayButton.addEventListener('click', () => {
            howToPlayModal.classList.add('active');
        });
    }

    if (closeHowToPlayButton) {
        closeHowToPlayButton.addEventListener('click', () => {
            howToPlayModal.classList.remove('active');
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