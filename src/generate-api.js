const getBaseUrl = () =>
  process.env.REACT_APP_GENERATE_API_URL || window.location.origin + '/api';

async function request(path, body) {
  if (!process.env.REACT_APP_GENERATE_API_URL) {
    throw new Error('The dream realm is not yet configured. Set REACT_APP_GENERATE_API_URL to your Vercel API endpoint.');
  }
  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('The dream realm returned an unexpected response. Is the API URL configured correctly?');
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error('The dream realm is unreachable... check your connection and try again.');
    }
    throw err;
  }
}

/**
 * Cast a dream — generate an image via Azure OpenAI (Flux or gpt-image).
 * @param {Object} options
 * @param {string} options.prompt - The dream vision text
 * @param {string} options.model - "flux-1.1-pro" or "gpt-image-1.5"
 * @param {string} options.size - e.g. "1024x1024", "1536x1024", "1024x1536"
 * @param {string} [options.background] - "transparent" or "opaque"
 * @param {string} [options.style] - Comma-separated essence names
 * @param {string} [options.type] - "background", "element", "freeform", "custom"
 * @returns {Promise<{image: string, model: string, size: string}>} image is base64
 */
export async function castDream({ prompt, model, size, background, style, type }) {
  try {
    return await request('/generate/cast', { prompt, model, size, background, style, type });
  } catch (err) {
    throw new Error(err.message || 'The dream faded... generation failed. Try again.');
  }
}

/**
 * Divine a card's name and meaning from its image via Claude.
 * @param {string} imageBase64 - Base64-encoded image data
 * @returns {Promise<{name: string, description: string, keywords: string[]}>}
 */
export async function divineName(imageBase64) {
  try {
    return await request('/generate/divine', { image: imageBase64 });
  } catch (err) {
    throw new Error(err.message || 'The oracle is silent... divination failed. Try again.');
  }
}
