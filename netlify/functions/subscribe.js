// netlify/functions/subscribe.js
// Proxies the Brevo "add contact to list" call so the API key stays server-side.
// Called by the newsletter + contact forms on index.html.

exports.handler = async (event) => {
  // Method gate
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  // Env var check — fail loud if misconfigured
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    console.error('BREVO_API_KEY is not set');
    return json(500, { error: 'Server misconfigured' });
  }

  // Parse body
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const { email, fn, ln, co, ph, tp } = payload;
  if (!email || typeof email !== 'string') {
    return json(400, { error: 'Email required' });
  }

  // Forward to Brevo — same shape as the original client-side bSub() call
  try {
    const resp = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': key,
      },
      body: JSON.stringify({
        email: email,
        attributes: {
          FIRSTNAME: fn || '',
          LASTNAME: ln || '',
          COMPANY: co || '',
          SMS: ph || '',
          ENQUIRY_TYPE: tp || 'Newsletter',
          SOURCE: 'Darlington First Website',
        },
        listIds: [7],
        updateEnabled: true,
      }),
    });

    // Brevo returns 201 for created, 204 for updated, 200 for other success
    if (resp.status === 200 || resp.status === 201 || resp.status === 204) {
      return json(200, { ok: true, status: resp.status });
    }

    // Pass through Brevo error details to help with debugging
    let details = {};
    try { details = await resp.json(); } catch {}
    return json(resp.status, { error: details.message || 'Brevo error', details });
  } catch (err) {
    console.error('Brevo subscribe failed:', err);
    return json(502, { error: 'Upstream request failed' });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
