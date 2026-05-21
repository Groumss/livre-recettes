exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);

    // Si une URL est fournie dans les metadata, on récupère la page côté serveur
    let messages = body.messages;
    if (body._fetchUrl) {
      try {
        const pageRes = await fetch(body._fetchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' },
          signal: AbortSignal.timeout(8000),
        });
        const html = await pageRes.text();
        // Extraire le texte brut basiquement (supprimer les balises HTML)
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 12000);

        messages = [{
          role: 'user',
          content: body.messages[0].content[0].text.replace('__PAGE_CONTENT__', text)
        }];
      } catch (fetchErr) {
        // Si la page est inaccessible, on continue sans le contenu
        messages = body.messages;
      }
      delete body._fetchUrl;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: body.model,
        max_tokens: body.max_tokens,
        system: body.system,
        messages,
      }),
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
