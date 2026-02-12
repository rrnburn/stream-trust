// Existing M3U parsing logic remains intact

// Enhanced error logging for Xtream API requests
const parsePlaylist = async (url) => {
    // Protocol validation for URL
    try {
        const urlObj = new URL(url);
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
            throw new Error('Invalid protocol. Only HTTP and HTTPS are allowed.');
        }
    } catch (e) {
        console.error('URL construction error:', e);
        throw e;
    }

    console.log('Constructed URL:', url);

    try {
        const response = await fetch(url);
        console.log('Fetch request sent to:', url);
        console.log('Response status:', response.status);

        if (!response.ok) {
            const responseBody = await response.text();
            console.error('API Request failed:', {
                status: response.status,
                statusText: response.statusText,
                bodySnippet: responseBody.substring(0, 100),
                url: url
            });
            throw new Error(`API Request failed with status ${response.status}`);
        }

        // ... Handle successful response and parsing logic here ...

    } catch (error) {
        console.error('An error occurred during the fetch process:', error);
        throw error;
    }
};

// Note: &output=ts parameter has been removed from the API request