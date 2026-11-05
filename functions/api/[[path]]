export async function onRequest(context) {
  const { request, env } = context;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: cors()
    });
  }

  // Endpoint hanya menerima POST
  if (request.method !== 'POST') {
    return jsonResponse({
      ok: false,
      error: 'Method tidak diizinkan. Gunakan POST.'
    }, 405);
  }

  // Periksa konfigurasi Apps Script
  if (!env.GAS_WEBAPP_URL) {
    return jsonResponse({
      ok: false,
      error: 'GAS_WEBAPP_URL belum diset pada Cloudflare.'
    }, 500);
  }

  let body;

  // Baca JSON dari dashboard
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({
      ok: false,
      error: 'Request dari dashboard bukan JSON yang valid.'
    }, 400);
  }

  try {
    // Teruskan request ke Google Apps Script
    const upstream = await fetch(env.GAS_WEBAPP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      redirect: 'follow'
    });

    const text = await upstream.text();

    // Periksa apakah Apps Script mengembalikan respons kosong
    if (!text || !text.trim()) {
      return jsonResponse({
        ok: false,
        error: 'Google Apps Script mengembalikan respons kosong.',
        upstreamStatus: upstream.status
      }, 502);
    }

    // Pastikan respons Apps Script benar-benar JSON
    let result;

    try {
      result = JSON.parse(text);
    } catch (e) {
      return jsonResponse({
        ok: false,
        error: 'Respons Google Apps Script bukan JSON yang valid.',
        upstreamStatus: upstream.status,
        upstreamContentType: upstream.headers.get('content-type'),
        responsePreview: text.substring(0, 500)
      }, 502);
    }

    // Teruskan respons JSON
    return jsonResponse(
      result,
      upstream.ok ? 200 : upstream.status
    );

  } catch (e) {
    return jsonResponse({
      ok: false,
      error: 'Gagal menghubungi Google Apps Script.',
      detail: String(e)
    }, 502);
  }
}


// CORS headers
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  };
}


// JSON response helper
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors(),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
