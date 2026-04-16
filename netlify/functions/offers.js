// netlify/functions/offers.js
// Proxies the Airtable Offers table for the DF Offers page.
// - GET  /api/offers         → list approved offers for this site
// - POST /api/offers         → submit a new offer (creates an un-approved record)

const AIRTABLE_BASE = 'appzNaWxLuQstEUSX';
const AIRTABLE_TABLE = 'tblrQUho0RGnhh03V';
const SITE_NAME = 'Darlington First';

exports.handler = async (event) => {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) {
    console.error('AIRTABLE_TOKEN is not set');
    return json(500, { error: 'Server misconfigured' });
  }

  if (event.httpMethod === 'GET') {
    return handleList(token);
  }
  if (event.httpMethod === 'POST') {
    return handleSubmit(event, token);
  }
  return json(405, { error: 'Method not allowed' });
};

// ─── GET: list approved offers for the current site ────────────
async function handleList(token) {
  const filter = `AND({Approved}=1,OR({Site}="${SITE_NAME}",{Site}="All Sites"))`;
  const params = new URLSearchParams();
  params.set('filterByFormula', filter);
  const fields = [
    'Business Name','Sector','Description','Offer Headline','Offer Detail',
    'Discount Code','Website URL','Logo URL','Town / City','Featured','Terms','How to Claim',
  ];
  fields.forEach((f) => params.append('fields[]', f));
  params.set('sort[0][field]', 'Business Name');
  params.set('sort[0][direction]', 'asc');

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}?${params.toString()}`;

  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!resp.ok) {
      let details = {};
      try { details = await resp.json(); } catch {}
      return json(resp.status, { error: 'Airtable list failed', details });
    }
    const data = await resp.json();
    // Return the records array directly — client expects data.records
    return json(200, { records: data.records || [] });
  } catch (err) {
    console.error('Airtable list failed:', err);
    return json(502, { error: 'Upstream request failed' });
  }
}

// ─── POST: create a new (un-approved) offer submission ─────────
async function handleSubmit(event, token) {
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  // Validate + allowlist fields (prevents clients from setting Approved=true)
  const required = ['Business Name','Sector','Description','Offer Headline','Website URL','Town / City','Contact Name','Contact Email'];
  const missing = required.filter((k) => !payload[k] || String(payload[k]).trim() === '');
  if (missing.length) {
    return json(400, { error: `Missing required field(s): ${missing.join(', ')}` });
  }

  // Allowlist: only these fields can be written from client submissions
  // Note: "Approved" and "Featured" are deliberately excluded — only you can set those in Airtable
  const allowed = [
    'Business Name','Sector','Description','Offer Headline','Offer Detail',
    'Discount Code','Website URL','Logo URL','Town / City','Terms','How to Claim',
    'Contact Name','Contact Email',
  ];
  const fields = {};
  allowed.forEach((k) => {
    if (payload[k] != null && String(payload[k]).trim() !== '') {
      fields[k] = String(payload[k]).trim();
    }
  });
  // Always stamp the Site server-side — prevents client from spoofing it
  fields['Site'] = SITE_NAME;

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    if (resp.ok) {
      return json(200, { ok: true });
    }
    let details = {};
    try { details = await resp.json(); } catch {}
    return json(resp.status, { error: 'Airtable create failed', details });
  } catch (err) {
    console.error('Airtable submit failed:', err);
    return json(502, { error: 'Upstream request failed' });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
