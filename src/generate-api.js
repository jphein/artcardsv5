const getBaseUrl = () =>
  process.env.REACT_APP_GENERATE_API_URL || window.location.origin + '/api';

async function request(path, body) {
  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed with status ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    if (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed')) {
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
