import axios from 'axios';

export async function searchGoogle(query) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.warn('SERPER_API_KEY is not set. Skipping search.');
    return null;
  }

  try {
    const response = await axios.post(
      'https://google.serper.dev/search',
      { q: query },
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Serper API error:', error?.response?.data || error.message);
    return null;
  }
}
