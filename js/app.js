/* Mellomrommet – felles skript. Innholdet hentes fra /content/*.json,
   som redigeres i admin-sida (/admin). */
(function () {
  'use strict';

  const LOGO = '/images/logo.png';
  const SIDE = document.body.dataset.side || '';
  const TOMT_BILDE = '<img class="tomt" src="' + LOGO + '" alt="">';

  // ---------- Hjelpere ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, el = document) => el.querySelector(sel);

  async function hent(fil) {
    try {
      const r = await fetch('/content/' + fil + '?v=' + Date.now());
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      console.warn('Kunne ikke hente', fil, e);
      return null;
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

  const sorterNyest = (liste) => [...(liste || [])].sort((a, b) => new Date(b.dato) - new Date(a.dato));
  const sakUrl = (s) => '/sak.html?s=' + encodeURIComponent(s.slug);
  const bilde = (src, alt) => src ? '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '" loading="lazy">' : TOMT_BILDE;

  // ---------- Header, ticker og footer ----------
  function rammeverk(site) {
    const lenker = (site && site.lenker) || {};
    const pod = !!(site && site.podkastLansert);
    const nav = [
      ['/nyheter.html', 'Nyheter', 'nyheter'],
      pod && ['/podkast.html', 'Podkast', 'podkast'],
      ['/om-oss.html', 'Om oss', 'om-oss'],
      ['/#tips', 'Tips oss', 'tips'],
    ].filter(Boolean);
    const header = document.createElement('header');
    header.className = 'header';
    header.innerHTML =
      '<div class="wrap">' +
        '<a class="brand" href="/" aria-label="Mellomrommet – til forsiden">' +
          '<img src="' + LOGO + '" alt="">' +
          '<span><b>MELLOMROMMET</b><small>Nesten alltid på ball</small></span>' +
        '</a>' +
        '<nav class="nav" id="hovedmeny" aria-label="Hovedmeny">' +
          nav.map(([h, t, k]) => '<a href="' + h + '"' + (k === SIDE ? ' aria-current="page"' : '') + '>' + t + '</a>').join('') +
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
  const kort = (s) =>
    '<a class="kort reveal" href="' + sakUrl(s) + '">' +
      '<div class="bilde">' + bilde(s.bilde, '') + '</div>' +
      '<span class="kat">' + esc(s.kategori) + ' · <span class="meta" style="color:inherit">' + tidSiden(s.dato) + '</span></span>' +
      '<h3>' + esc(s.tittel) + '</h3>' +
      (s.ingress ? '<p>' + esc(s.ingress) + '</p>' : '') +
    '</a>';

  function episodeBoks(ep, lenker) {
    if (!ep) return '<p class="tom-melding">Første episode kommer snart.</p>';
    const plattform = [['Spotify', ep.spotify || lenker.spotify], ['Apple Podcasts', lenker.apple], ['YouTube', ep.youtube || lenker.youtube]]
      .filter(([, u]) => u).map(([n, u]) => '<a class="knapp omriss" href="' + esc(u) + '" target="_blank" rel="noopener">' + n + '</a>').join('');
    return '<section class="boks episode reveal" aria-label="Siste episode">' +
      '<img src="' + LOGO + '" alt="">' +
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
                '<span class="kat">' + esc(hoved.kategori) + ' · <span class="meta" style="color:inherit">' + tidSiden(hoved.dato) + '</span></span>' +
                '<h1>' + esc(hoved.tittel) + '</h1>' +
                (hoved.ingress ? '<p>' + esc(hoved.ingress) + '</p>' : '') +
              '</a>'
            : '<p class="tom-melding">Ingen saker ennå.</p>') +
          '<aside class="siste" aria-label="Siste saker">' +
            '<h2>Siste saker</h2>' +
            resten.slice(0, 4).map((s) => '<a href="' + sakUrl(s) + '"><span class="meta">' + esc(s.kategori) + ' · ' + tidSiden(s.dato) + '</span><span>' + esc(s.tittel) + '</span></a>').join('') +
            (nk.kamp
              ? '<div class="boks nestekamp"><span class="kat">Neste kamp</span><strong>' + esc(nk.kamp) + '</strong>' +
                '<span class="meta" style="text-transform:none">' + [nk.tidspunkt, nk.arena, nk.turnering].filter(Boolean).map(esc).join(' · ') + '</span></div>'
              : '') +
          '</aside>' +
        '</section>' +
        (site.podkastLansert ? episodeBoks(episoder[0], lenker) : '') +
        (resten.length > 4
          ? '<section aria-label="Flere saker"><h2 class="seksjonstittel">Flere saker <a href="/nyheter.html">Alle saker →</a></h2><div class="kort-grid">' + resten.slice(4, 12).map(kort).join('') + '</div></section>'
          : '') +
        '<section class="to reveal" aria-label="Om oss">' +
          '<img src="/images/gjengen.jpg" alt="De tre programlederne i Mellomrommet">' +
          '<div><span class="kat">Om oss</span><h2>Vi står han av</h2>' +
          '<p>' + esc(site.omOssKort || 'Tre supportere som brenner for laget. Uavhengig, uten reklame og uten salg – bare ærlig prat i medgang og motgang.') + '</p>' +
          '<a class="knapp omriss" href="/om-oss.html">Bli kjent med oss</a></div>' +
        '</section>' +
        tipsSkjema();
    },

    async nyheter(site, saker) {
      const kategorier = ['Alle', ...new Set(saker.map((s) => s.kategori).filter(Boolean))];
      const m = $('#innhold .wrap');
      m.innerHTML = '<section><h1 class="seksjonstittel" style="font-size:40px">Nyheter</h1>' +
        '<div class="filter" role="group" aria-label="Filtrer på kategori">' +
        kategorier.map((k, i) => '<button type="button" aria-pressed="' + (i === 0) + '" data-k="' + esc(k) + '">' + esc(k) + '</button>').join('') +
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
      tegn('Alle');
    },

    async sak(site, saker) {
      const slug = new URLSearchParams(location.search).get('s');
      const s = saker.find((x) => x.slug === slug);
      const m = $('#innhold .wrap');
      if (!s) { m.innerHTML = '<div class="artikkel"><h1>Fant ikke saken</h1><p><a class="knapp" href="/nyheter.html">Til alle saker</a></p></div>'; return; }
      document.title = s.tittel + ' – Mellomrommet';
      m.innerHTML = '<article class="artikkel">' +
        '<span class="kat">' + esc(s.kategori) + ' · <span class="meta" style="color:inherit">' + datoTekst(s.dato) + '</span></span>' +
        '<h1>' + esc(s.tittel) + '</h1>' +
        (s.ingress ? '<p class="ingress">' + esc(s.ingress) + '</p>' : '') +
        (s.bilde ? '<img class="hovedbilde" src="' + esc(s.bilde) + '" alt="">' : '') +
        '<div class="brodtekst">' + markdown(s.brodtekst) + '</div>' +
        (s.kilde ? '<p class="kilde">Kilde: <a href="' + esc(s.kilde) + '" target="_blank" rel="noopener" style="color:var(--gul)">' + esc(s.kildenavn || s.kilde) + '</a></p>' : '') +
        '<p><a class="knapp omriss" href="/nyheter.html">← Alle saker</a></p>' +
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
      m.innerHTML = '<section class="to"><img src="/images/gjengen.jpg" alt="De tre programlederne i Mellomrommet">' +
        '<div><span class="kat">Om oss</span><h1 style="font-size:clamp(36px,5vw,56px);text-transform:uppercase;margin:8px 0 16px">Vi står han av</h1>' +
        markdown(site.omOss || '').replace(/<p>/g, '<p style="color:var(--tekst2);font-size:18px">') + '</div></section>' +
        (pers.length ? '<section><h2 class="seksjonstittel">Programlederne</h2><div class="personer">' +
          pers.map((p) => '<div class="boks person reveal"><h3>' + esc(p.navn) + '</h3><p>' + esc(p.om) + '</p></div>').join('') + '</div></section>' : '') +
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
    const [site, art, eps] = await Promise.all([hent('site.json'), hent('saker.json'), hent('episoder.json')]);
    const s = site || {};
    window.__pod = !!s.podkastLansert;
    const saker = sorterNyest(art && art.saker);
    const episoder = sorterNyest(eps && eps.episoder);
    rammeverk(s);
    ticker(saker);
    const fn = sider[SIDE.replace('-', '')];
    if (fn) await fn(s, saker, episoder);
    aktiverSpillere();
    animer();
  })();
})();
