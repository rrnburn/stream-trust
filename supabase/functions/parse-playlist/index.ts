// Enhanced error logging for fetch response and Xtream API URL construction

const BASE_URL = 'https://example.com/api'; // Replace with your actual base URL

async function fetchPlaylist(playlistId) {
    const url = `${BASE_URL}/playlists/${playlistId}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Error fetching playlist: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Fetch error: ${error.message}. URL: ${url}`);
    }
}

// Example usage
fetchPlaylist('12345');