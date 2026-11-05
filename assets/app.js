let ID_TOKEN = '';
let ME = null;
let PHONES = [];
let PHONE = '';

const $ = id => document.getElementById(id);

window.onGoogleLogin = async r => {
    ID_TOKEN = r.credential;
    try {
        const b = await api('bootstrap');
        ME = b.user;
        PHONES = b.phones || [];

        $('brand').textContent = b.title || 'TOKO SAYA';
        $('login').hidden = true;
        $('app').hidden = false;
        $('profile').textContent = ME.email + ' · ' + ME.role;
        $('numbersNav').hidden = ME.role !== 'superadmin';

        $('phone').innerHTML = PHONES.map(p =>
            `<option value="${esc(p.phoneId)}">
                ${esc(p.name || p.displayPhone || p.phoneId)} · ${esc(p.phoneId)}
            </option>`
        ).join('');

        PHONE = $('phone').value;

        $('phone').onchange = () => {
            PHONE = $('phone').value;
            load('overview');
        };

        $('refresh').onclick = () => load('overview');

        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.onclick = () => load(btn.dataset.view);
        });

        await load('overview');
    } catch (e) {
        alert(e.message);
    }
};

async function api(action, extra = {}) {
  const response = await fetch('/api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      action,
      idToken: ID_TOKEN,
      phoneId: PHONE,
      ...extra
    })
  });

  const responseText = await response.text();

  // Respons kosong: tampilkan informasi yang lebih jelas.
  if (!responseText || !responseText.trim()) {
    throw new Error(
      'API mengembalikan respons kosong. ' +
      'HTTP Status: ' + response.status +
      '. Periksa Cloudflare Pages Functions.'
    );
  }

  let result;

  try {
    result = JSON.parse(responseText);
  } catch (error) {
    throw new Error(
      'API tidak mengembalikan JSON yang valid. ' +
      'HTTP Status: ' + response.status +
      '. Respons awal: ' + responseText.substring(0, 250)
    );
  }

  if (!response.ok) {
    throw new Error(
      result.error ||
      'HTTP Error ' + response.status
    );
  }

  if (!result.ok) {
    throw new Error(
      result.error || 'API error'
    );
  }

  return result;
}

async function load(view) {
    const root = $('view');
    root.innerHTML = '<div class="card">Memuat…</div>';

    try {
        if (view === 'overview') {
            const [m, c, q] = await Promise.all([
                api('list', { tab: 'MESSAGES' }),
                api('list', { tab: 'CONTACTS' }),
                api('list', { tab: 'QUEUE' })
            ]);
            const phoneName = PHONES.find(p => String(p.phoneId) === String(PHONE))?.name || 'nomor';
            
            root.innerHTML = `
                <h2>Ringkasan ${esc(phoneName)}</h2>
                <div class="grid">
                    <div class="card">
                        Pesan tercatat
                        <div class="stat">${m.data.length}</div>
                    </div>
                    <div class="card">
                        Kontak CRM
                        <div class="stat">${c.data.length}</div>
                    </div>
                    <div class="card">
                        Antrean pesan
                        <div class="stat">${q.data.filter(x => x.status === 'pending').length}</div>
                    </div>
                </div>
            `;
            return;
        }

        if (view === 'contacts') {
            const x = await api('list', { tab: 'CONTACTS' });
            root.innerHTML = `
                <h2>CRM Kontak</h2>
                <div class="card">
                    <div class="formrow">
                        <label>Nomor WhatsApp<input id="cwa" placeholder="62812..."/></label>
                        <label>Nama<input id="cname" placeholder="Nama pelanggan"/></label>
                        <label>Label<input id="clabel" placeholder="Pelanggan baru"/></label>
                    </div>
                    <button onclick="addContact()">Tambah kontak</button>
                </div>
                <div class="card">
                    <table>
                        <tr>
                            <th>Nomor</th>
                            <th>Nama</th>
                            <th>Label</th>
                            <th>Opt-in</th>
                        </tr>
                        ${x.data.map(c => `
                            <tr>
                                <td>${esc(c.waId)}</td>
                                <td>${esc(c.name)}</td>
                                <td>${esc(c.labels)}</td>
                                <td>${String(c.optIn) === 'true' ? 'Ya' : 'Tidak'}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
            `;
            return;
        }

        if (view === 'keywords') {
            const x = await api('list', { tab: 'KEYWORDS' });
            root.innerHTML = `
                <h2>Keyword Auto Response</h2>
                <div class="card">
                    <div class="formrow">
                        <label>Keyword<input id="kw"/></label>
                        <label>Jenis
                            <select id="km">
                                <option value="contains">Mengandung</option>
                                <option value="exact">Persis</option>
                            </select>
                        </label>
                    </div>
                    <label>Balasan<textarea id="kr"></textarea></label>
                    <button onclick="saveKeyword()">Simpan keyword</button>
                </div>
                <div class="card">
                    <table>
                        <tr>
                            <th>Keyword</th>
                            <th>Match</th>
                            <th>Balasan</th>
                            <th>Aktif</th>
                        </tr>
                        ${x.data.map(k => `
                            <tr>
                                <td>${esc(k.keyword)}</td>
                                <td>${esc(k.matchType)}</td>
                                <td>${esc(k.reply)}</td>
                                <td>${esc(k.enabled)}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
            `;
            return;
        }

        if (view === 'messages') {
            root.innerHTML = `
                <h2>Kirim Pesan Manual</h2>
                <div class="card">
                    <label>Nomor tujuan<input id="to" placeholder="628xxxxxxxxxx"/></label>
                    <label>Pesan<textarea id="msg"></textarea></label>
                    <p class="muted">Di luar jendela layanan 24 jam, pilih template yang telah disetujui Meta.</p>
                    <label>Template (opsional)<input id="tpl" placeholder="template_name"/></label>
                    <label>Bahasa template<input id="lang" value="id"/></label>
                    <button onclick="sendNow()">Kirim</button>
                </div>
            `;
            return;
        }

        if (view === 'schedule') {
            root.innerHTML = `
                <h2>Pesan Terjadwal</h2>
                <div class="card">
                    <label>Daftar WA ID, pisahkan koma<input id="stargets" placeholder="62812...,62813..."/></label>
                    <label>Pesan<textarea id="smsg"></textarea></label>
                    <label>Waktu kirim<input id="stime" type="datetime-local"/></label>
                    <label>Template opsional<input id="stpl"/></label>
                    <button onclick="scheduleNow()">Buat jadwal</button>
                </div>
            `;
            return;
        }

        if (view === 'numbers') {
            const x = await api('list', { tab: 'PHONES' });
            root.innerHTML = `
                <h2>Monitoring Phone Numbers</h2>
                <div class="card">
                    <table>
                        <tr>
                            <th>ID</th>
                            <th>Nama</th>
                            <th>Nomor</th>
                            <th>Aktif</th>
                            <th>Admin</th>
                        </tr>
                        ${x.data.map(p => `
                            <tr>
                                <td>${esc(p.phoneId)}</td>
                                <td>${esc(p.name)}</td>
                                <td>${esc(p.displayPhone)}</td>
                                <td>${esc(p.enabled)}</td>
                                <td>${esc(p.adminEmails)}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
            `;
            return;
        }
    } catch (e) {
        root.innerHTML = `<div class="card">${esc(e.message)}</div>`;
    }
}

async function addContact() {
    await api('addContact', {
        waId: $('cwa').value,
        name: $('cname').value,
        labels: $('clabel').value,
        optIn: false
    });
    load('contacts');
}

async function saveKeyword() {
    await api('saveKeyword', {
        item: {
            phoneId: PHONE,
            keyword: $('kw').value,
            matchType: $('km').value,
            reply: $('kr').value,
            enabled: true
        }
    });
    load('keywords');
}

async function sendNow() {
    const res = await api('send', {
        to: $('to').value,
        text: $('msg').value,
        templateName: $('tpl').value,
        templateLang: $('lang').value
    });
    alert('Dikirim / diterima Meta. WAMID: ' + res.wamid);
}

async function scheduleNow() {
    const targets = $('stargets').value
        .split(',')
        .map(x => x.trim())
        .filter(Boolean);

    await api('schedule', {
        contactIds: targets,
        text: $('smsg').value,
        scheduledAt: new Date($('stime').value).toISOString(),
        templateName: $('stpl').value,
        templateLang: 'id'
    });
    alert('Jadwal disimpan');
}
