/* Mellomrommet – felles skript. Innholdet hentes fra /content/*.json,
   som redigeres i admin-sida (/admin). */
(function () {
  'use strict';

  const LOGO = '/images/logo.png';
  const SIDE = document.body.dataset.side || '';
  // Ved lansering byttes logoen til versjonen med «PODKASTEN»
  const logoSrc = () => (window.__pod ? '/images/logo-lansering.png' : LOGO);
  const TOMT_BILDE = '<img class="tomt" src="' + LOGO + '" alt="">';

  // ---------- Hjelpere ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, el = document) => el.querySelector(sel);

  // Innholdet hentes rett fra GitHub, så endringer i admin vises uten ny publisering på Netlify.
  const REPO = 'mellomrommetpod-arch/mellomrommet';
  const RAW = 'https://raw.githubusercontent.com/' + REPO + '/main/';
  async function json(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status + ' ' + url);
    return r.json();
  }
  async function hent(fil) {
    try { return await json(RAW + 'content/' + fil + '?v=' + Date.now()); }
    catch (e) {
      try { return await json('/content/' + fil + '?v=' + Date.now()); }
      catch (e2) { console.warn('Kunne ikke hente', fil, e2); return null; }
    }
  }
  // Én fil per sak i content/saker/. Lista hentes fra GitHub og huskes i to minutter.
  async function hentSaker() {
    const NOKKEL = 'mm-saker-v1';
    let lagret = null;
    try { lagret = JSON.parse(localStorage.getItem(NOKKEL) || 'null'); } catch (e) { /* privat modus */ }
    if (lagret && Date.now() - lagret.t < 120000) return lagret.saker;
    try {
      const liste = await json('https://api.github.com/repos/' + REPO + '/contents/content/saker?ref=main');
      const filer = liste.filter((f) => f.type === 'file' && /\.json$/.test(f.name));
      const saker = (await Promise.all(filer.map((f) => json(RAW + f.path + '?v=' + f.sha).catch(() => null)))).filter(Boolean);
      try { localStorage.setItem(NOKKEL, JSON.stringify({ t: Date.now(), saker })); } catch (e) { /* fullt eller privat */ }
      return saker;
    } catch (e) {
      console.warn('Fikk ikke hentet sakslista – viser sist lagrede', e);
      return lagret ? lagret.saker : [];
    }
  }

  function tidSiden(dato) {
    const d = new Date(dato);
    if (isNaN(d)) return '';
    const min = Math.round((Date.now() - d) / 60000);
    if (min < 1) return 'nå';
    if (min < 60) return min + ' min siden';
    const t = Math.round(min / 60);
    if (t < 24) return t + ' t siden';
    const dager = Math.round(t / 24);
    if (dager === 1) return 'i går';
    if (dager < 7) return dager + ' dager siden';
    return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const datoTekst = (dato) => {
    const d = new Date(dato);
    return isNaN(d) ? '' : d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Enkel og trygg markdown: avsnitt, **fet**, *kursiv*, [lenke](url), ## overskrift, - liste
  function markdown(md) {
    const inline = (t) => esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return String(md || '').trim().split(/\n{2,}/).map((blokk) => {
      if (/^##\s/.test(blokk)) return '<h2>' + inline(blokk.replace(/^##\s/, '')) + '</h2>';
      if (/^- /m.test(blokk) && blokk.split('\n').every((l) => /^- /.test(l))) {
        return '<ul>' + blokk.split('\n').map((l) => '<li>' + inline(l.slice(2)) + '</li>').join('') + '</ul>';
      }
      return '<p>' + inline(blokk).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  const SPALTE = 'Mellomrommet mener';
  // Står over alle saker i kategorien Kommentar. Kan endres i admin (Innstillinger).
  const MERKNAD = 'Innlegget gir uttrykk for skribentens holdninger, som er grundig gjennomtenkt i pausen. Skribenten er nesten alltid på ball. Dette kan være et av unntakene.';
  const SPALTE_URL = '/nyheter.html?k=' + encodeURIComponent(SPALTE);
  const katMerke = (k) => k === SPALTE ? '<span class="spaltemerke">' + esc(k) + '</span>' : esc(k);

  const sorterNyest = (liste) => [...(liste || [])].sort((a, b) => new Date(b.dato) - new Date(a.dato));
  const sakUrl = (s) => '/sak.html?s=' + encodeURIComponent(s.slug);
  const bilde = (src, alt) => src ? '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '" loading="lazy">' : TOMT_BILDE;

  // ---------- Header, ticker og footer ----------
  function rammeverk(site, saker) {
    const lenker = (site && site.lenker) || {};
    const pod = !!(site && site.podkastLansert);
    const nav = [
      ['/nyheter.html', 'Nyheter', 'nyheter'],
      [SPALTE_URL, SPALTE, 'mener'],
      pod && ['/podkast.html', 'Podkast', 'podkast'],
      ['/om-oss.html', 'Om oss', 'om-oss'],
      ['/#tips', 'Tips oss', 'tips'],
    ].filter(Boolean);
    const aktiv = SIDE === 'nyheter' && new URLSearchParams(location.search).get('k') === SPALTE ? 'mener' : SIDE;
    const header = document.createElement('header');
    header.className = 'header';
    header.innerHTML =
      '<div class="wrap">' +
        '<a class="brand" href="/" aria-label="Mellomrommet – til forsiden">' +
          '<img src="' + logoSrc() + '" alt="">' +
          '<span><b>MELLOMROMMET</b><small>Nesten alltid på ball</small></span>' +
        '</a>' +
        '<nav class="nav" id="hovedmeny" aria-label="Hovedmeny">' +
          nav.map(([h, t, k]) => '<a href="' + h + '"' + (k === aktiv ? ' aria-current="page"' : '') + '>' + t + '</a>').join('') +
        '</nav>' +
        (pod ? '<a class="knapp lytt" href="' + esc(lenker.spotify || '/podkast.html') + '">Lytt nå</a>' : '<a class="knapp lytt" href="/#tips">Tips oss</a>') +
        '<button class="menyknapp" aria-expanded="false" aria-controls="hovedmeny" aria-label="Åpne meny">' +
          '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
        '</button>' +
      '</div>';
    document.body.prepend(header);
    const skip = document.createElement('a');
    skip.className = 'skip'; skip.href = '#innhold'; skip.textContent = 'Hopp til innhold';
    document.body.prepend(skip);

    const btn = $('.menyknapp', header), meny = $('#hovedmeny', header);
    btn.addEventListener('click', () => {
      const apen = meny.classList.toggle('open');
      btn.setAttribute('aria-expanded', apen);
      btn.setAttribute('aria-label', apen ? 'Lukk meny' : 'Åpne meny');
    });

    const footer = document.createElement('footer');
    footer.className = 'footer';
    const so = [['Instagram', lenker.instagram], ['TikTok', lenker.tiktok], ['YouTube', lenker.youtube], ['Spotify', lenker.spotify]]
      .filter(([, u]) => u).map(([n, u]) => '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + n + '</a>').join('');
    footer.innerHTML = '<div class="wrap"><span>Mellomrommet – uavhengig og laget av supportere. Ikke tilknyttet klubben.</span><nav aria-label="Sosiale medier">' + so + '</nav></div>';
    document.body.append(footer);
  }

  function ticker(saker) {
    if (!saker.length) return;
    const el = document.createElement('div');
    el.className = 'ticker';
    el.setAttribute('aria-label', 'Siste saker');
    const items = saker.slice(0, 6).map((s) => '<a href="' + sakUrl(s) + '"><span class="kat">' + esc(s.kategori) + '</span>' + esc(s.tittel) + '</a>').join('');
    // Dupliseres for sømløs rulling; kopien skjules for skjermlesere
    el.innerHTML = '<span class="merke">Siste</span><div class="spor">' + items + '<span aria-hidden="true" style="display:contents">' + items.replace(/<a /g, '<a tabindex="-1" ') + '</span></div>';
    $('.header').after(el);
  }

  // ---------- Komponenter ----------
  // Opptaket til en sak vises først når podkasten er lansert
  const harOpptak = (s) => !!(window.__pod && s && s.opptak && (s.opptak.lyd || s.opptak.spotify || s.opptak.youtube || s.opptak.apple));
  function lytteBoks(s, lenker) {
    if (!harOpptak(s)) return '';
    const o = s.opptak;
    const pl = [['Spotify', o.spotify || lenker.spotify], ['Apple Podcasts', o.apple || lenker.apple], ['YouTube', o.youtube || lenker.youtube]]
      .filter(([, u]) => u).map(([n, u]) => '<a class="knapp omriss" href="' + esc(u) + '" target="_blank" rel="noopener">' + n + '</a>').join('');
    return '<section class="boks lytt"><span class="kat">🎧 Hør hele praten' + (o.episode ? ' · Episode ' + esc(o.episode) : '') + '</span>' +
      '<p>Denne saken er skrevet fra samtalen i Mellomrommet. Hør hele praten – med alt vi ikke fikk plass til her.</p>' +
      (o.lyd ? spiller(o.lyd) : '') + (pl ? '<div class="plattformer">' + pl + '</div>' : '') + '</section>';
  }

  const kort = (s) =>
    '<a class="kort reveal" href="' + sakUrl(s) + '">' +
      '<div class="bilde">' + bilde(s.bilde, '') + '</div>' +
      '<span class="kat">' + katMerke(s.kategori) + (harOpptak(s) ? ' · 🎧 Hør' : '') + ' · <span class="meta" style="color:inherit">' + tidSiden(s.dato) + '</span></span>' +
      '<h3>' + esc(s.tittel) + '</h3>' +
      (s.ingress ? '<p>' + esc(s.ingress) + '</p>' : '') +
    '</a>';

  function episodeBoks(ep, lenker) {
    if (!ep) return '<p class="tom-melding">Første episode kommer snart.</p>';
    const plattform = [['Spotify', ep.spotify || lenker.spotify], ['Apple Podcasts', lenker.apple], ['YouTube', ep.youtube || lenker.youtube]]
      .filter(([, u]) => u).map(([n, u]) => '<a class="knapp omriss" href="' + esc(u) + '" target="_blank" rel="noopener">' + n + '</a>').join('');
    return '<section class="boks episode reveal" aria-label="Siste episode">' +
      '<img src="' + logoSrc() + '" alt="">' +
      '<div>' +
        '<span class="kat">Ny episode' + (ep.nr ? ' · #' + esc(ep.nr) : '') + (ep.varighet ? ' · ' + esc(ep.varighet) : '') + '</span>' +
        '<h2>' + esc(ep.tittel) + '</h2>' +
        (ep.beskrivelse ? '<p>' + esc(ep.beskrivelse) + '</p>' : '') +
        (ep.lyd ? spiller(ep.lyd) : '') +
        '<div class="plattformer">' + plattform + '</div>' +
      '</div></section>';
  }

  function spiller(url) {
    return '<div class="spiller" data-lyd="' + esc(url) + '">' +
      '<button class="spill" type="button" aria-label="Spill av episode"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg></button>' +
      '<div class="bar" role="slider" aria-label="Posisjon i episoden" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0"><i></i></div>' +
      '<span class="tid">0:00</span></div>';
  }

  function aktiverSpillere() {
    document.querySelectorAll('.spiller').forEach((el) => {
      const lyd = new Audio(el.dataset.lyd);
      lyd.preload = 'none';
      const knapp = $('.spill', el), bar = $('.bar', el), fyll = $('.bar i', el), tid = $('.tid', el);
      const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>';
      const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
      const fmt = (s) => isFinite(s) ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '0:00';
      knapp.addEventListener('click', () => { lyd.paused ? lyd.play() : lyd.pause(); });
      lyd.addEventListener('play', () => { knapp.innerHTML = PAUSE; knapp.setAttribute('aria-label', 'Pause'); });
      lyd.addEventListener('pause', () => { knapp.innerHTML = PLAY; knapp.setAttribute('aria-label', 'Spill av episode'); });
      lyd.addEventListener('timeupdate', () => {
        const p = lyd.duration ? (lyd.currentTime / lyd.duration) * 100 : 0;
        fyll.style.width = p + '%'; bar.setAttribute('aria-valuenow', Math.round(p));
        tid.textContent = fmt(lyd.currentTime) + ' / ' + fmt(lyd.duration);
      });
      const hopp = (andel) => { if (lyd.duration) lyd.currentTime = andel * lyd.duration; };
      bar.addEventListener('click', (e) => { const r = bar.getBoundingClientRect(); hopp((e.clientX - r.left) / r.width); });
      bar.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') lyd.currentTime += 15;
        if (e.key === 'ArrowLeft') lyd.currentTime -= 15;
      });
    });
  }

  function animer() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('vis')); return; }
    const io = new IntersectionObserver((ents) => ents.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('vis'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -40px 0px' });
    els.forEach((e) => io.observe(e));
  }

  // ---------- Neste kamp (hentes automatisk) ----------
  // Henter Glimts neste kamp i alle turneringer fra ESPNs åpne kampoversikt.
  // Feiler hentingen, vises det som er lagt inn manuelt i admin (Neste kamp).
  const GLIMT_ESPN_ID = '2980';
  const LAGNAVN = {
    'Bodo/Glimt': 'Bodø/Glimt', 'Tromso': 'Tromsø', 'Lillestrom': 'Lillestrøm', 'Valerenga': 'Vålerenga',
    'Stromsgodset': 'Strømsgodset', 'Sarpsborg FK': 'Sarpsborg 08', 'Sarpsborg': 'Sarpsborg 08', 'HamKam': 'HamKam',
    'Ham-Kam': 'HamKam', 'Hamarkameratene': 'HamKam', 'Viking FK': 'Viking', 'SK Brann': 'Brann', 'KFUM Oslo': 'KFUM',
    'Rosenborg BK': 'Rosenborg', 'Molde FK': 'Molde', 'Fredrikstad FK': 'Fredrikstad', 'IK Start': 'Start', 'Aalesund': 'Aalesund', 'Kristiansund BK': 'Kristiansund', 'Sandefjord Fotball': 'Sandefjord',
  };
  const TURNERING = {
    'Norwegian Eliteserien': 'Eliteserien', 'UEFA Champions League': 'Champions League',
    'UEFA Europa League': 'Europa League', 'UEFA Conference League': 'Conference League',
    'UEFA Europa Conference League': 'Conference League', 'Norwegian NM Cup': 'NM', 'Norwegian Cup': 'NM',
  };
  const lagnavn = (n) => LAGNAVN[n] || n;
  function nesteKampHtml(k) {
    if (!k) return '';
    return '<span class="kat">Neste kamp</span><strong>' + esc(k.kamp) + '</strong>' +
      (k.info ? '<span class="meta" style="text-transform:none">' + esc(k.info) + '</span>' : '');
  }
  async function oppdaterNesteKamp() {
    const boks = document.getElementById('nestekamp');
    if (!boks) return;
    try {
      const r = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/' + GLIMT_ESPN_ID + '/schedule?fixture=true');
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      const naa = Date.now() - 2 * 3600 * 1000; // vis kampen til to timer etter avspark
      const ev = (j.events || [])
        .filter((e) => new Date(e.date).getTime() > naa)
        .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
      if (!ev) return;
      const komp = (ev.competitions && ev.competitions[0]) || {};
      const lag = komp.competitors || [];
      const hjemme = lag.find((c) => c.homeAway === 'home');
      const borte = lag.find((c) => c.homeAway === 'away');
      if (!hjemme || !borte) return;
      const d = new Date(ev.date);
      const tid = d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Oslo' }) +
        ' kl. ' + d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' });
      const turnering = (ev.league && ev.league.name) || (ev.season && ev.season.displayName) || '';
      const info = [tid.charAt(0).toUpperCase() + tid.slice(1), komp.venue && komp.venue.fullName, TURNERING[turnering] || turnering]
        .filter(Boolean).join(' · ');
      boks.innerHTML = nesteKampHtml({ kamp: lagnavn(hjemme.team.displayName) + ' – ' + lagnavn(borte.team.displayName), info });
      boks.hidden = false;
    } catch (e) {
      console.warn('Fikk ikke hentet neste kamp automatisk – viser manuell verdi', e);
    }
  }

  // ---------- Ukas kort (ris, ros, kjeft – og en og annen softis) ----------
  const KORTTYPER = {
    rodt: ['Rødt kort', 'rod', ''], gult: ['Gult kort', 'gul', ''],
    gront: ['Grønt kort', 'gronn', ''], softis: ['Softis', 'softis', '🍦 '],
  };
  function ukasKort(k) {
    const kort = ((k && k.kort) || []).filter((x) => x && KORTTYPER[x.farge] && (x.hvem || x.hvorfor));
    if (!kort.length) return '';
    const rekkefolge = ['rodt', 'gult', 'gront', 'softis'];
    kort.sort((a, b) => rekkefolge.indexOf(a.farge) - rekkefolge.indexOf(b.farge));
    return '<section class="segment ukas-kort"><h2>Ukas kort!</h2>' +
      '<img class="hovedbilde" src="' + esc((k && k.bilde) || (window.__pod ? '/images/ukas-kort-lansering.jpg' : '/images/ukas-kort.jpg')) + '" alt="Ukas kort – rødt, gult eller grønt?" onerror="this.remove()">' +
      '<p class="ks-ingress">Ris, ros og kjeft for det som skjedde denne uka – på og utenfor banen. Delt ut av panelet i fellesskap.</p><div class="ks-grid">' +
      kort.map((x) => { const [tittel, cls, ikon] = KORTTYPER[x.farge];
        return '<div class="ks-kort ' + cls + '"><span class="ks-merke">' + ikon + tittel + '</span>' +
          (x.hvem ? '<strong>' + esc(x.hvem) + '</strong>' : '') + (x.hvorfor ? '<p>' + esc(x.hvorfor) + '</p>' : '') + '</div>'; }).join('') +
      '</div></section>';
  }

  // ---------- Tabellutsnitt (Eliteserien, hentes automatisk) ----------
  // Viser Glimt i midten med inntil fire lag over og under. Hentes fersk ved hvert besøk – koster ingen deploy.
  async function oppdaterTabell() {
    const boks = document.getElementById('tabell');
    if (!boks) return;
    try {
      const r = await fetch('https://site.api.espn.com/apis/v2/sports/soccer/nor.1/standings');
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      const del = (j.children || [])[0] || {};
      const st = (e, n) => { const x = (e.stats || []).find((s) => s.name === n); return x ? x.value : 0; };
      const lag = ((del.standings && del.standings.entries) || [])
        .map((e) => ({ id: String(e.team.id), navn: lagnavn(e.team.displayName), plass: st(e, 'rank'), kamper: st(e, 'gamesPlayed'), diff: st(e, 'pointDifferential'), poeng: st(e, 'points') }))
        .sort((a, b) => a.plass - b.plass);
      const i = lag.findIndex((l) => l.id === GLIMT_ESPN_ID);
      if (i < 0) return;
      const VINDU = 4;
      let fra = Math.max(0, i - VINDU), til = Math.min(lag.length, i + VINDU + 1);
      const mangler = 2 * VINDU + 1 - (til - fra);
      if (fra === 0) til = Math.min(lag.length, til + mangler); else if (til === lag.length) fra = Math.max(0, fra - mangler);
      const fortegn = (n) => (n > 0 ? '+' : '') + n;
      boks.innerHTML = '<span class="kat">Eliteserien ' + esc((del.standings && del.standings.seasonDisplayName || '').replace(/\D/g, '')) + '</span>' +
        '<table><thead><tr><th scope="col">#</th><th scope="col">Lag</th><th scope="col" class="tall">K</th><th scope="col" class="tall">+/-</th><th scope="col" class="tall">P</th></tr></thead><tbody>' +
        lag.slice(fra, til).map((l) => '<tr' + (l.id === GLIMT_ESPN_ID ? ' class="leder"' : '') + '><td>' + l.plass + '</td><td>' + esc(l.navn) + '</td><td class="tall">' + l.kamper + '</td><td class="tall">' + fortegn(l.diff) + '</td><td class="tall">' + l.poeng + '</td></tr>').join('') +
        '</tbody></table>';
      boks.hidden = false;
    } catch (e) {
      console.warn('Fikk ikke hentet tabellen', e);
    }
  }

  // ---------- Analyse (humor, ikke sport) ----------
  // Månefasen regnes ut automatisk fra kampdatoen. Ingen taktikk er brukt i utregningen.
  function maanefase(dato) {
    const d = new Date(dato);
    if (isNaN(d)) return null;
    const syk = 29.530588853, ny = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
    const alder = (((d.getTime() / 86400000 - ny) % syk) + syk) % syk;
    const faser = [[1.85, '🌑', 'Nymåne'], [5.54, '🌒', 'Voksende månesigd'], [9.23, '🌓', 'Første kvarter'], [12.92, '🌔', 'Voksende måne'],
      [16.61, '🌕', 'Fullmåne'], [20.3, '🌖', 'Minkende måne'], [23.99, '🌗', 'Siste kvarter'], [27.68, '🌘', 'Minkende månesigd'], [99, '🌑', 'Nymåne']];
    const f = faser.find(([g]) => alder < g);
    return { ikon: f[1], navn: f[2], alder: Math.round(alder), lys: Math.round((1 - Math.cos(2 * Math.PI * alder / syk)) / 2 * 100) };
  }
  // Arenaer med koordinater, slik at vær, sol og måne hentes for riktig sted
  const ARENAER = {
    'Aspmyra Stadion (Bodø)': [67.2766, 14.3966], 'SR-Bank Arena (Stavanger)': [58.9157, 5.7330], 'Brann Stadion (Bergen)': [60.3667, 5.3594],
    'Lerkendal (Trondheim)': [63.4125, 10.4044], 'Aker Stadion (Molde)': [62.7350, 7.1453], 'Romssa Arena (Tromsø)': [69.6458, 18.9386],
    'Intility Arena (Oslo)': [59.9050, 10.7900], 'Åråsen Stadion (Lillestrøm)': [59.9625, 11.0461], 'Sarpsborg Stadion (Sarpsborg)': [59.2797, 11.1072],
    'KFUM Arena (Oslo)': [59.9286, 10.7861], 'Briskeby (Hamar)': [60.7944, 11.0728], 'Fredrikstad Stadion (Fredrikstad)': [59.2072, 10.9447],
    'Release Arena (Sandefjord)': [59.1394, 10.2131], 'Kristiansund Stadion (Kristiansund)': [63.1078, 7.7303],
    'Color Line Stadion (Ålesund)': [62.4708, 6.1722], 'Sparebanken Sør Arena (Kristiansand)': [58.1525, 7.9969],
  };
  // Solhøyde over horisonten (grader), standard astronomisk tilnærming
  function solhoyde(d, lat, lon) {
    const rad = Math.PI / 180, dag = d.getTime() / 86400000 + 2440587.5 - 2451545;
    const g = (357.529 + 0.98560028 * dag) * rad, q = 280.459 + 0.98564736 * dag;
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad, e = (23.439 - 0.00000036 * dag) * rad;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dek = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = (18.697374558 + 24.06570982441908 * dag) % 24, ha = (gmst * 15 + lon) * rad - ra;
    return Math.asin(Math.sin(lat * rad) * Math.sin(dek) + Math.cos(lat * rad) * Math.cos(dek) * Math.cos(ha)) / rad;
  }
  const VAERKODER = { 0: 'Klar himmel', 1: 'Stort sett klart', 2: 'Delvis skyet', 3: 'Overskyet', 45: 'Tåke', 48: 'Rimtåke', 51: 'Lett yr', 53: 'Yr', 55: 'Kraftig yr',
    61: 'Lett regn', 63: 'Regn', 65: 'Kraftig regn', 66: 'Underkjølt regn', 67: 'Kraftig underkjølt regn', 71: 'Lett snø', 73: 'Snø', 75: 'Kraftig snø', 77: 'Snøkorn',
    80: 'Lette regnbyger', 81: 'Regnbyger', 82: 'Kraftige regnbyger', 85: 'Snøbyger', 86: 'Kraftige snøbyger', 95: 'Torden', 96: 'Torden med hagl', 99: 'Kraftig torden med hagl' };
  async function hentFakta() {
    const el = document.getElementById('kampfakta');
    if (!el) return;
    const d = new Date(el.dataset.tid);
    let sted = ARENAER[el.dataset.arena];
    if (!sted && el.dataset.annet) {
      // Bortekamper ute: finn koordinatene til byen/arenaen automatisk
      try {
        const g = await (await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=nb&name=' + encodeURIComponent(el.dataset.annet))).json();
        if (g.results && g.results[0]) sted = [g.results[0].latitude, g.results[0].longitude];
      } catch (e) { console.warn('Fant ikke stedet', e); }
    }
    if (isNaN(d) || !sted) return;
    const [lat, lon] = sted, rader = [];
    const sol = solhoyde(d, lat, lon);
    rader.push(['☀️', 'Sola ved avspark', sol > 0 ? Math.round(sol) + ' grader over horisonten' : 'Under horisonten (' + Math.round(sol) + ' grader)']);
    try {
      const dag = d.toISOString().slice(0, 10);
      const gammel = Date.now() - d > 80 * 86400000;
      const url = (gammel ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast') +
        '?latitude=' + lat + '&longitude=' + lon + '&start_date=' + dag + '&end_date=' + dag +
        '&hourly=temperature_2m,precipitation,cloud_cover,wind_speed_10m,weather_code&wind_speed_unit=ms&timezone=UTC';
      const j = await (await fetch(url)).json();
      const h = j.hourly, i = h && h.time.indexOf(d.toISOString().slice(0, 13) + ':00');
      if (i >= 0) {
        rader.push(['🌦️', 'Været', (VAERKODER[h.weather_code[i]] || 'Ukjent') + ', ' + Math.round(h.temperature_2m[i]) + ' °C']);
        rader.push(['💨', 'Vind', String(h.wind_speed_10m[i]).replace('.', ',') + ' m/s']);
        rader.push(['☁️', 'Skydekke', h.cloud_cover[i] + ' %']);
        rader.push(['💧', 'Nedbør', String(h.precipitation[i]).replace('.', ',') + ' mm']);
      }
    } catch (e) { console.warn('Fikk ikke hentet vær', e); }
    el.insertAdjacentHTML('beforeend', rader.map(([ik, n, v]) => '<p class="maane"><span aria-hidden="true">' + ik + '</span> ' + n + ': <b>' + esc(v) + '</b></p>').join(''));
  }

  function analyseBoks(s) {
    const a = s.analyse || {};
    const faktorer = (a.faktorer || []).filter((f) => f && f.faktor);
    const m = maanefase(a.kampdato || s.dato);
    if (!faktorer.length && !a.konklusjon && !a.kampdato) return '';
    const sum = faktorer.reduce((t, f) => t + (Number(f.andel) || 0), 0) || 1;
    return '<section class="segment analyseboks"><h2>Analysepanelets funn</h2>' +
      '<div class="kampfakta" id="kampfakta" data-tid="' + esc(a.kampdato || '') + '" data-arena="' + esc(a.arena || '') + '" data-annet="' + esc(a.annetSted || '') + '">' +
        '<span class="kat">Fakta fra kampøyeblikket</span>' +
        ((a.annetSted || a.arena) ? '<p class="maane"><span aria-hidden="true">📍</span> Sted: <b>' + esc(a.annetSted || a.arena) + '</b></p>' : '') +
        (m ? '<p class="maane"><span aria-hidden="true">' + m.ikon + '</span> Månen: <b>' + m.navn + '</b>, ' + m.lys + ' % opplyst</p>' : '') +
      '</div>' +
      (faktorer.length ? '<h3>Skyldfordeling</h3><div class="skyld">' + faktorer.map((f) => {
        const pst = Math.round(((Number(f.andel) || 0) / sum) * 100);
        return '<div class="skyld-rad"><div class="skyld-topp"><span>' + esc(f.faktor) + '</span><b>' + pst + ' %</b></div>' +
          '<div class="skyld-bar" role="img" aria-label="' + esc(f.faktor) + ' ' + pst + ' prosent"><i style="width:' + pst + '%"></i></div>' +
          (f.forklaring ? '<p>' + esc(f.forklaring) + '</p>' : '') + '</div>';
      }).join('') + '</div>' : '') +
      '<p class="fotnote">Fakta er hentet automatisk: vær fra Open-Meteo, sol og måne er regnet ut for stedet og tidspunktet. Faktorer som ikke ble vurdert: taktikk, formasjon, spillerkvalitet, motstanderen.</p>' +
      (a.konklusjon ? '<div class="konklusjon"><span class="kat">Konklusjon</span><p>' + esc(a.konklusjon) + '</p></div>' : '') +
      '</section>';
  }

  // ---------- Årets spiller (løpende stilling) ----------
  // Summerer poengene panelet deler ut i hver «Mellomrommet mener»-sak for inneværende sesong (kalenderår).
  function aaretsStilling(saker, aar) {
    const tab = {};
    saker.filter((s) => new Date(s.dato).getFullYear() === aar).forEach((s) => (s.aaretsSpiller || []).forEach((r) => {
      const navn = String((r && r.spiller) || '').trim();
      const poeng = Number(r && r.poeng) || 0;
      if (!navn || !poeng) return;
      const t = tab[navn.toLowerCase()] || (tab[navn.toLowerCase()] = { navn, poeng: 0, ganger: 0 });
      t.poeng += poeng; t.ganger += 1;
    }));
    return Object.values(tab).sort((a, b) => b.poeng - a.poeng || b.ganger - a.ganger || a.navn.localeCompare(b.navn, 'nb'));
  }
  function stillingHtml(saker, maks) {
    const aar = new Date().getFullYear();
    let rader = aaretsStilling(saker, aar), visAar = aar;
    if (!rader.length) { rader = aaretsStilling(saker, aar - 1); visAar = aar - 1; }
    if (!rader.length) return '';
    let plass = 0, forrige = null;
    const liste = rader.map((r, i) => { if (r.poeng !== forrige) { plass = i + 1; forrige = r.poeng; } return { ...r, plass }; });
    const vis = maks ? liste.slice(0, maks) : liste;
    return '<div class="boks stilling"><span class="kat">Årets spiller ' + visAar + '</span>' +
      '<table><thead><tr><th scope="col">#</th><th scope="col">Spiller</th><th scope="col" class="tall">Poeng</th></tr></thead><tbody>' +
      vis.map((r) => '<tr' + (r.plass === 1 ? ' class="leder"' : '') + '><td>' + r.plass + '</td><td>' + esc(r.navn) + '</td><td class="tall">' + r.poeng + '</td></tr>').join('') +
      '</tbody></table>' +
      (maks && liste.length > maks ? '<a class="mer" href="' + SPALTE_URL + '#stilling">Hele stillingen →</a>' : '') +
      '<p class="fotnote">Panelet deler ut 3, 2 og 1 poeng etter hver runde.</p></div>';
  }

  // ---------- Mellomrommet mener: de faste segmentene ----------
  const SEGMENTER = [
    { navn: 'Kampen', tekst: 'Hva avgjorde kampen, hvem var best – og hvem skuffet? Hver av oss tar med seg ett øyeblikk.' },
    { navn: 'Dommerhjørnet', tekst: 'Mads-Birger, vårt dommeralibi, tar ukas mest omdiskuterte avgjørelse og gir fasiten etter regelboka.' },
    { navn: 'Uenige om', tekst: 'Børge legger fram en påstand. De to andre velger side. Ingen trenger å bli enige.' },
    { navn: 'Analysen', tekst: 'Garantert uten taktikk. Vi finner de virkelige årsakene – målt mot ekte vær, sol og måne.' },
    { navn: 'Ukas kort', tekst: 'Rødt, gult eller grønt – og en og annen softis. Ris, ros og kjeft for det som skjedde i uka.' },
    { navn: 'Årets spiller', tekst: 'Panelet deler ut 3, 2 og 1 poeng etter hver runde. Stillingen oppdateres løpende.' },
  ];
  const utdrag = (md, n) => { const t = String(md || '').replace(/[*#_>\[\]]/g, '').replace(/\(https?:[^)]*\)/g, '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n).replace(/\s\S*$/, '') + ' …' : t; };
  function spalteside(m, site, saker) {
    const mener = saker.filter((s) => s.kategori === SPALTE);
    const sisteMed = (fn) => mener.find(fn);
    const innhold = (navn) => {
      if (navn === 'Analysen') {
        const a = saker.find((s) => s.kategori === 'Analyse');
        return a ? '<a class="seg-siste" href="' + sakUrl(a) + '"><b>' + esc(a.tittel) + '</b>' + (a.ingress ? '<span>' + esc(utdrag(a.ingress, 140)) + '</span>' : '') + '</a>' : '';
      }
      if (navn === 'Ukas kort') {
        const s = sisteMed((x) => x.ukasKort && (x.ukasKort.kort || []).length);
        if (!s) return '';
        const k = s.ukasKort.kort.filter((x) => KORTTYPER[x.farge]).slice(0, 4);
        return '<a class="seg-siste" href="' + sakUrl(s) + '#kort">' + k.map((x) => '<span class="seg-kort ' + KORTTYPER[x.farge][1] + '">' + KORTTYPER[x.farge][2] + esc(KORTTYPER[x.farge][0]) + ': ' + esc(x.hvem) + '</span>').join('') + '</a>';
      }
      if (navn === 'Årets spiller') {
        const r = aaretsStilling(saker, new Date().getFullYear()).slice(0, 3);
        return r.length ? '<ol class="seg-topp">' + r.map((x) => '<li>' + esc(x.navn) + ' <b>' + x.poeng + ' p</b></li>').join('') + '</ol><a class="mer" href="#stilling">Hele stillingen →</a>' : '';
      }
      const s = sisteMed((x) => (x.segmenter || []).some((g) => g && g.navn && g.navn.toLowerCase() === navn.toLowerCase() && g.tekst));
      if (!s) return '';
      const g = s.segmenter.find((x) => x.navn.toLowerCase() === navn.toLowerCase());
      return '<a class="seg-siste" href="' + sakUrl(s) + '"><b>' + esc(s.tittel) + '</b><span>' + esc(utdrag(g.tekst, 160)) + '</span></a>';
    };
    m.innerHTML = '<section><h1 class="seksjonstittel" style="font-size:40px">' + SPALTE + '</h1>' +
      '<p class="spalteingress">Børge, Mads-Birger og Hans Fredrik tar praten om Glimt – kampene, dommerne og alt imellom. Hver runde går vi gjennom de samme seks postene.' +
        (window.__pod ? ' <b style="color:var(--gul)">Og ja: Alt du har lest her er podkast. Hver sak har sin episode – trykk deg inn og hør hele praten. 🎧</b>' : '') + '</p>' +
      '<div class="segmentgrid">' + SEGMENTER.map((g, i) => {
        const inn = innhold(g.navn);
        return '<article class="boks segmentboks reveal"><span class="kat">' + String(i + 1).padStart(2, '0') + '</span><h2>' + esc(g.navn) + '</h2><p>' + esc(g.tekst) + '</p>' +
          (inn || '<p class="seg-tom">Første runde kommer snart.</p>') + '</article>';
      }).join('') + '</div></section>' +
      (mener.length ? '<section><h2 class="seksjonstittel">Alle samtaler</h2><div class="kort-grid">' + mener.map(kort).join('') + '</div></section>' : '') +
      '<div id="stilling">' + stillingHtml(saker) + '</div>';
    animer();
  }

  // ---------- Sider ----------
  const sider = {
    async forside(site, saker, episoder) {
      const [hoved, ...resten] = saker;
      const lenker = site.lenker || {};
      const nk = site.nesteKamp || {};
      const m = $('#innhold .wrap');
      m.innerHTML =
        '<section class="lead" aria-label="Hovedsaker">' +
          (hoved
            ? '<a class="hovedsak" href="' + sakUrl(hoved) + '">' +
                '<div class="bilde">' + bilde(hoved.bilde || '/images/gjengen.jpg', '') + '</div>' +
                '<span class="kat">' + katMerke(hoved.kategori) + (harOpptak(hoved) ? ' · 🎧 Hør' : '') + ' · <span class="meta" style="color:inherit">' + tidSiden(hoved.dato) + '</span></span>' +
                '<h1>' + esc(hoved.tittel) + '</h1>' +
                (hoved.ingress ? '<p>' + esc(hoved.ingress) + '</p>' : '') +
              '</a>'
            : '<p class="tom-melding">Ingen saker ennå.</p>') +
          '<aside class="sidekolonne" aria-label="Kamp og tabell">' +
            '<div class="boks nestekamp" id="nestekamp" aria-live="polite"' + (nk.kamp ? '' : ' hidden') + '>' + nesteKampHtml(nk.kamp ? { kamp: nk.kamp, info: [nk.tidspunkt, nk.arena, nk.turnering].filter(Boolean).join(' · ') } : null) + '</div>' +
            '<div class="boks stilling tabell" id="tabell" aria-live="polite" hidden></div>' +
          '</aside>' +
        '</section>' +
        (resten.length
          ? '<section class="boks siste3" aria-label="Siste saker"><h2 class="seksjonstittel">Siste saker <a href="/nyheter.html">Alle saker →</a></h2><div class="siste3-grid">' +
            resten.slice(0, 3).map((s) => '<a class="siste3-sak" href="' + sakUrl(s) + '"><span class="kat">' + katMerke(s.kategori) + ' · <span class="meta" style="color:inherit">' + tidSiden(s.dato) + '</span></span><h3>' + esc(s.tittel) + '</h3>' + (s.ingress ? '<p>' + esc(s.ingress) + '</p>' : '') + '</a>').join('') +
            '</div></section>'
          : '') +
        stillingHtml(saker, 5) +
        (site.podkastLansert ? episodeBoks(episoder[0], lenker) : '') +
        (resten.length > 3
          ? '<section aria-label="Flere saker"><h2 class="seksjonstittel">Flere saker</h2><div class="kort-grid">' + resten.slice(3, 11).map(kort).join('') + '</div></section>'
          : '') +
        '<section class="to reveal" aria-label="Om oss">' +
          '<img src="/images/gjengen.jpg" alt="Børge, Mads-Birger og Hans Fredrik – gjengen bak Mellomrommet">' +
          '<div><span class="kat">Om oss</span><h2>Nesten alltid på ball</h2>' +
          '<p>' + esc(site.omOssKort || 'Tre supportere som brenner for laget. Uavhengig, uten reklame og uten salg – bare ærlig prat i medgang og motgang.') + '</p>' +
          '<a class="knapp omriss" href="/om-oss.html">Bli kjent med oss</a></div>' +
        '</section>' +
        tipsSkjema();
      oppdaterNesteKamp();
      oppdaterTabell();
    },

    async nyheter(site, saker) {
      const kategorier = ['Alle', ...new Set(saker.map((s) => s.kategori).filter(Boolean))];
      const m = $('#innhold .wrap');
      const start = new URLSearchParams(location.search).get('k');
      const valgt = kategorier.includes(start) ? start : (start === SPALTE ? SPALTE : 'Alle');
      if (valgt === SPALTE && !kategorier.includes(SPALTE)) kategorier.push(SPALTE);
      const ingressAnalyse = '<p class="spalteingress">Garantert uten taktikk. Vi finner de virkelige årsakene: været, månen og stjernetegnet til linjedommeren.</p>';
      const ingressSpalte = '<p class="spalteingress">Børge, Mads-Birger og Hans Fredrik tar praten om Glimt – kampene, dommerne og alt imellom.' +
        (window.__pod ? ' <b style="color:var(--gul)">Og ja: Alt du har lest her er podkast. Hver sak har sin episode – trykk deg inn og hør hele praten. 🎧</b>' : '') + '</p>';
      if (valgt === SPALTE) { spalteside(m, site, saker); return; }
      m.innerHTML = '<section><h1 class="seksjonstittel" style="font-size:40px">' + (valgt === SPALTE ? SPALTE : 'Nyheter') + '</h1>' +
        (valgt === 'Analyse' ? ingressAnalyse : '') +
        (valgt === SPALTE ? ingressSpalte + '<div id="stilling">' + stillingHtml(saker) + '</div>' : '') +
        '<div class="filter" role="group" aria-label="Filtrer på kategori"' + (kategorier.length <= 2 ? ' hidden' : '') + '>' +
        kategorier.map((k) => '<button type="button" aria-pressed="' + (k === valgt) + '" data-k="' + esc(k) + '">' + esc(k) + '</button>').join('') +
        '</div><div class="kort-grid" id="liste"></div></section>';
      const liste = $('#liste');
      const tegn = (k) => {
        const utvalg = k === 'Alle' ? saker : saker.filter((s) => s.kategori === k);
        liste.innerHTML = utvalg.length ? utvalg.map(kort).join('') : '<p class="tom-melding">Ingen saker i denne kategorien ennå.</p>';
        animer();
      };
      m.querySelectorAll('.filter button').forEach((b) => b.addEventListener('click', () => {
        m.querySelectorAll('.filter button').forEach((x) => x.setAttribute('aria-pressed', x === b));
        tegn(b.dataset.k);
      }));
      tegn(valgt);
    },

    async sak(site, saker) {
      const slug = new URLSearchParams(location.search).get('s');
      const s = saker.find((x) => x.slug === slug);
      const m = $('#innhold .wrap');
      if (!s) { m.innerHTML = '<div class="artikkel"><h1>Fant ikke saken</h1><p><a class="knapp" href="/nyheter.html">Til alle saker</a></p></div>'; return; }
      document.title = s.tittel + ' – Mellomrommet';
      setTimeout(hentFakta, 0);
      m.innerHTML = '<article class="artikkel">' +
        '<span class="kat">' + katMerke(s.kategori) + ' · <span class="meta" style="color:inherit">' + datoTekst(s.dato) + '</span></span>' +
        '<h1>' + esc(s.tittel) + '</h1>' +
        (s.kategori === 'Kommentar' ? '<aside class="merknad" aria-label="Merknad"><b>Dette er ikke et debattinnlegg.</b> ' + esc(site.kommentarMerknad || MERKNAD) + '</aside>' : '') +
        (s.ingress ? '<p class="ingress">' + esc(s.ingress) + '</p>' : '') +
        (s.bilde ? '<img class="hovedbilde" src="' + esc(s.bilde) + '" alt="">' : '') +
        lytteBoks(s, site.lenker || {}) +
        '<div class="brodtekst">' + markdown(s.brodtekst) + '</div>' +
        (s.segmenter || []).filter((g) => g && (g.navn || g.tekst)).map((g) =>
          '<section class="segment"><h2>' + esc(g.navn) + '</h2><div class="brodtekst">' + markdown(g.tekst) + '</div></section>').join('') +
        analyseBoks(s) +
        ukasKort(s.ukasKort) +
        ((s.aaretsSpiller || []).some((r) => r && r.spiller && Number(r.poeng))
          ? '<section class="segment"><h2>Poeng til Årets spiller</h2><ul class="poengliste">' +
            [...s.aaretsSpiller].filter((r) => r && r.spiller && Number(r.poeng)).sort((a, b) => b.poeng - a.poeng)
              .map((r) => '<li><b>' + Number(r.poeng) + ' p</b> ' + esc(r.spiller) + '</li>').join('') +
            '</ul><a class="mer" href="' + SPALTE_URL + '#stilling">Se stillingen →</a></section>'
          : '') +
        (s.kilde ? '<p class="kilde">Kilde: <a href="' + esc(s.kilde) + '" target="_blank" rel="noopener" style="color:var(--gul)">' + esc(s.kildenavn || s.kilde) + '</a></p>' : '') +
        (s.kategori === SPALTE ? '<p><a class="knapp omriss" href="' + SPALTE_URL + '">← Flere fra ' + SPALTE + '</a></p>' : '<p><a class="knapp omriss" href="/nyheter.html">← Alle saker</a></p>') +
        '</article>';
    },

    async podkast(site, saker, episoder) {
      if (!site.podkastLansert) { location.replace('/'); return; }
      const m = $('#innhold .wrap');
      m.innerHTML = '<section><h1 class="seksjonstittel" style="font-size:40px">Podkast</h1>' +
        episodeBoks(episoder[0], site.lenker || {}) +
        (episoder.length > 1
          ? '<h2 class="seksjonstittel" style="margin-top:48px">Tidligere episoder</h2><div class="ep-liste">' +
            episoder.slice(1).map((e) => '<div class="boks ep-rad reveal"><span class="nr">#' + esc(e.nr) + '</span><div><h3>' + esc(e.tittel) + '</h3><p>' + esc(datoTekst(e.dato)) + (e.beskrivelse ? ' – ' + esc(e.beskrivelse) : '') + '</p></div>' +
              (e.spotify || e.youtube || e.lyd ? '<a class="knapp omriss" href="' + esc(e.spotify || e.youtube || e.lyd) + '" target="_blank" rel="noopener">Lytt</a>' : '') + '</div>').join('') +
            '</div>'
          : '') +
        '</section>';
    },

    async omoss(site) {
      const m = $('#innhold .wrap');
      const pers = site.programledere || [];
      m.innerHTML = '<section class="to"><img src="/images/gjengen.jpg" alt="Børge, Mads-Birger og Hans Fredrik – gjengen bak Mellomrommet">' +
        '<div><span class="kat">Om oss</span><h1 style="font-size:clamp(36px,5vw,56px);text-transform:uppercase;margin:8px 0 16px">Nesten alltid på ball</h1>' +
        markdown(site.omOss || '').replace(/<p>/g, '<p style="color:var(--tekst2);font-size:18px">') + '</div></section>' +
        (pers.length ? '<section><h2 class="seksjonstittel">Gjengen</h2><div class="personer">' +
          pers.map((p) => '<div class="boks person reveal"><h3>' + esc(p.navn) + '</h3>' + markdown(p.om) + '</div>').join('') + '</div></section>' : '') +
        tipsSkjema();
    },
  };

  function tipsSkjema() {
    // Netlify Forms tar imot innsendingene (se Netlify → Forms)
    return '<section id="tips" class="boks skjema reveal" aria-label="Tips oss">' +
      '<h2>Tips oss eller send et spørsmål</h2>' +
      '<p style="margin:0;color:var(--tekst2)">' + (window.__pod ? 'Vi tar med lytterspørsmål i episodene.' : 'Har du et tips eller noe du lurer på? Send det til oss.') + '</p>' +
      '<form name="tips" method="POST" data-netlify="true" netlify-honeypot="bot-felt" action="/takk.html" style="display:flex;flex-direction:column;gap:12px">' +
        '<input type="hidden" name="form-name" value="tips">' +
        '<p class="skjult"><label>Ikke fyll ut: <input name="bot-felt"></label></p>' +
        '<label for="tips-navn">Navn (valgfritt)</label><input id="tips-navn" name="navn" autocomplete="name">' +
        '<label for="tips-melding">Din melding</label><textarea id="tips-melding" name="melding" required></textarea>' +
        '<button class="knapp" type="submit">Send inn</button>' +
      '</form></section>';
  }

  // ---------- Start ----------
  (async function start() {
    const [site, alleSaker, eps] = await Promise.all([hent('site.json'), hentSaker(), Promise.resolve(null)]);
    const s = site || {};
    const eps2 = s.podkastLansert ? await hent('episoder.json') : null;
    window.__pod = !!s.podkastLansert;
    const saker = sorterNyest(alleSaker);
    const episoder = sorterNyest((eps2 || eps) && (eps2 || eps).episoder);
    rammeverk(s, saker);
    const fn = sider[SIDE.replace('-', '')];
    if (fn) await fn(s, saker, episoder);
    aktiverSpillere();
    animer();
  })();
})();
