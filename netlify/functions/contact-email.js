// netlify/functions/contact-email.js
// Proxies the Brevo transactional email API — sends the enquiry details
// to hello@first-connections.com with reply-to set to the visitor's address.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const key = process.env.BREVO_API_KEY;
  if (!key) {
    console.error('BREVO_API_KEY is not set');
    return json(500, { error: 'Server misconfigured' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const { email, fn, ln, co, ph, tp, msg } = payload;
  if (!email || !fn) {
    return json(400, { error: 'Email and first name required' });
  }

  // Escape user-supplied content for the email HTML
  const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const htmlContent =
    '<h3>New Enquiry</h3>' +
    `<p>Name: ${esc(fn)} ${esc(ln)}</p>` +
    `<p>Email: ${esc(email)}</p>` +
    `<p>Company: ${esc(co) || '-'}</p>` +
    `<p>Phone: ${esc(ph) || '-'}</p>` +
    `<p>Topic: ${esc(tp) || 'General Enquiry'}</p>` +
    `<p>Message: ${esc(msg) || '-'}</p>`;

  try {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': key,
      },
      body: JSON.stringify({
        sender: { name: 'Darlington First', email: 'hello@first-connections.com' },
        to: [{ email: 'hello@first-connections.com' }],
        replyTo: { email: email },
        subject: `Enquiry: ${tp || 'General'} - Darlington First`,
        htmlContent,
      }),
    });

    if (resp.ok) {
      return json(200, { ok: true });
    }
    let details = {};
    try { details = await resp.json(); } catch {}
    return json(resp.status, { error: details.message || 'Brevo email failed', details });
  } catch (err) {
    console.error('Brevo email failed:', err);
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
