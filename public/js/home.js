document.addEventListener('DOMContentLoaded', () => {
    const artistNameInput = document.getElementById('artist-name');
    const validateButton = document.getElementById('validate-input-btn');
    const messageArea = document.getElementById('validation-message');

    const modeButtons = document.querySelectorAll('.input-mode-selector .mode-btn');
    const artistInputSection = document.getElementById('artist-input-section');
    const genreInputSection = document.getElementById('genre-input-section');
    const dailySongSection = document.getElementById('daily-song-section');
    const genreSelect = document.getElementById('genre-select');

    const howToPlayButton = document.getElementById('how-to-play-btn');
    const howToPlayModal = document.getElementById('how-to-play-modal');
    const closeHowToPlayButton = document.getElementById('close-how-to-play-btn');

    let currentInputMode = 'daily';

    const genres = [
        { name: "Rap & Hip-Hop", genreId: "18" },
        { name: "Pop", genreId: "14" },
        { name: "R&B / Soul", genreId: "15" },
        { name: "Alternative", genreId: "20" },
        { name: "Dance", genreId: "17" },
        { name: "Country", genreId: "6" }
    ];

    function populateGenres() {
        if (genreSelect) {
            genreSelect.innerHTML = ''; // Clear existing options
            genres.forEach(genre => {
                const option = document.createElement('option');
                option.value = genre.genreId; // Store iTunes Genre ID as value
                option.textContent = genre.name;
                genreSelect.appendChild(option);
            });
        }
    }

    function updateInputModeUI(mode) {
        currentInputMode = mode;
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

        if (mode === 'artist') {
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
    const storedArtistName = localStorage.getItem('userArtistName');
    const storedGenreName = localStorage.getItem('userGenreName');
    const storedGenreId = localStorage.getItem('userGenreId');

    // Default to daily if the user previously had 'playlist' saved.
    if (storedInputMode === 'playlist') {
        localStorage.removeItem('userInputMode');
        localStorage.removeItem('userPlaylistId');
        updateInputModeUI('daily');
    } else if (storedInputMode) {
        updateInputModeUI(storedInputMode);

        if (storedInputMode === 'artist' && storedArtistName) {
            artistNameInput.value = storedArtistName;
            messageArea.textContent = `Previously used artist: ${storedArtistName}. Set new artist or start.`;
            messageArea.style.color = '#aaa';
        } else if (storedInputMode === 'genre') {
            if (genreSelect && storedGenreId) {
                 // Try to set the select to the stored genre ID if it exists in the new list
                 const exists = Array.from(genreSelect.options).some(opt => opt.value === storedGenreId);
                 if (exists) genreSelect.value = storedGenreId;
            }
            if(storedGenreName) {
                messageArea.textContent = `Previously used genre: ${storedGenreName}. Set new genre or start.`;
            }
            messageArea.style.color = '#aaa';
        } else if (storedInputMode === 'daily') {
            messageArea.textContent = 'Daily challenge is ready. Press start to play.';
            messageArea.style.color = '#aaa';
        }
    } else {
        updateInputModeUI('daily');
    }

    if (validateButton) {
        validateButton.addEventListener('click', async () => {
            if (currentInputMode === 'artist') {
                const artistName = artistNameInput.value.trim();
                if (!artistName) {
                    messageArea.textContent = 'Please enter an artist name.';
                    messageArea.style.color = '#e74c3c';
                    return;
                }
                messageArea.textContent = `Artist '${artistName}' set. Redirecting to game...`;
                messageArea.style.color = '#2ecc71';
                localStorage.setItem('userArtistName', artistName);
                localStorage.setItem('userGenreId', '');
                localStorage.setItem('userInputMode', 'artist');
                localStorage.setItem('userGenreName', '');
                window.location.href = '/game';
            } else if (currentInputMode === 'genre') {
                const selectedGenreId = genreSelect ? genreSelect.value : null;
                const selectedGenreName = genreSelect ? genreSelect.options[genreSelect.selectedIndex].text : '';
                if (!selectedGenreId) {
                    messageArea.textContent = 'Please select a genre.';
                    messageArea.style.color = '#e74c3c';
                    return;
                }
                messageArea.textContent = `Genre '${selectedGenreName}' selected. Redirecting to game...`;
                messageArea.style.color = '#2ecc71';
                localStorage.setItem('userGenreId', selectedGenreId);
                localStorage.setItem('userArtistName', '');
                localStorage.setItem('userInputMode', 'genre');
                localStorage.setItem('userGenreName', selectedGenreName);
                window.location.href = '/game';
            } else if (currentInputMode === 'daily') {
                messageArea.textContent = 'Starting the daily challenge...';
                messageArea.style.color = '#2ecc71';
                // Daily defaults to rap/hip-hop for now
                localStorage.setItem('userGenreId', '18'); 
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