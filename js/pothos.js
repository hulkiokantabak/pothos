/* POTHOS — pothos.js
 * The garden: storage, time, the sow gesture, the two doors (foresee, give), witnessing,
 * pressings, packets, .ics, export/import. Everything the visitor does; nothing the plant needs.
 *
 * Write-set discipline (ADR-006 / fidelity INV-03): after sowing, the only per-plant writes are
 * witnessedAt (once), foreseenAt (once), givenIn + acceptedAt (both at take-in). acceptedAt is
 * the take-in timestamp; it exists only to refuse a false "You were away" on a gift that closed
 * in transit (ADR-022), pays no attendance and rewards no frequency. Other keys: the garden at
 * sowing, pothos.sound.v1 (the toggle), pothos.clock.v1 (maxNowSeen — read ONLY by the
 * backward-clock clamp, ADR-014; never rendered, never fed to growth).
 */
(function (global) {
  'use strict';
  var B = global.POTHOS_BOTANY, E = global.POTHOS_ENGINE;
  var doc = document;

  /* ---------- storage (kind fallback when the browser cannot remember) ---------- */
  var mem = {};
  var canStore = (function () {
    try { localStorage.setItem('pothos.test', '1'); localStorage.removeItem('pothos.test'); return true; }
    catch (e) { return false; }
  })();
  function sGet(k) { if (canStore) { try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; } } return mem[k] || null; }
  /* returns true only when the value reached DURABLE storage; false when it fell back to the
     in-memory mem — either canStore was false at load, OR a mid-session write threw (quota
     exceeded, or a private mode that passes the 1-byte probe but throws on the full garden).
     A false return means "this will not survive a close"; saveGarden surfaces it so a sow can
     never silently look saved when it is only in volatile memory (final-review adversary). */
  function sSet(k, v) { if (canStore) { try { localStorage.setItem(k, v); return true; } catch (e) {} } mem[k] = v; return false; }
  function revealPrivateNote() { var pm = doc.getElementById('private-note'); if (pm) pm.hidden = false; }

  /* the petition verb (visual-arts panel): the piece calls itself a petition and discloses
     that browsers forget — so it asks the browser's own literal petition, once, at the first
     real sowing, and reports the browser's answer in the flat register. Persisted storage is
     far less likely to be evicted, which is the honest defense of a 90-day Season. */
  function askToPersist(cb) {
    if (!canStore || sGet('pothos.persist.v1')) { if (cb) cb(null); return; }
    if (!(navigator.storage && navigator.storage.persist)) { sSet('pothos.persist.v1', 'unavailable'); if (cb) cb(null); return; }
    try {
      navigator.storage.persist().then(function (granted) {
        sSet('pothos.persist.v1', granted ? 'granted' : 'asked');
        if (cb) cb(granted ? 'The browser agreed to keep this garden.' : 'The browser was asked to keep this garden; it has not promised.');
      }, function () { sSet('pothos.persist.v1', 'asked'); if (cb) cb(null); });
    } catch (e) { sSet('pothos.persist.v1', 'asked'); if (cb) cb(null); }
  }

  var GARDEN_KEY = 'pothos.garden.v1';
  /* per-record validation on every load (security audit): only well-shaped plants render;
     ids must match the sown alphabet so they can never carry markup or selector syntax */
  function validPlant(p) {
    return p && typeof p.seed === 'number' && typeof p.sowAt === 'number' &&
      typeof p.bloomAt === 'number' && p.bloomAt > p.sowAt &&
      typeof p.species === 'string' && !!B.SPECIES[p.species] &&
      typeof p.id === 'string' && /^p[0-9a-z]+$/.test(p.id) &&
      (p.witnessedAt === null || p.witnessedAt === undefined || typeof p.witnessedAt === 'number') &&
      (p.foreseenAt === null || p.foreseenAt === undefined || typeof p.foreseenAt === 'number');
  }
  function loadGarden() {
    var raw = sGet(GARDEN_KEY);
    if (!raw) return { v: 1, plants: [], given: [] };
    try {
      var g = JSON.parse(raw);
      if (!g || g.v !== 1 || !Array.isArray(g.plants)) return { v: 1, plants: [], given: [] };
      g.plants = g.plants.filter(validPlant);
      g.plants.forEach(function (p) {
        p.seed = p.seed >>> 0;
        p.closeAt = p.bloomAt + B.SPECIES[p.species].window;
      });
      if (!Array.isArray(g.given)) g.given = [];
      g.given = g.given.filter(function (x) {
        return x && typeof x.sowAt === 'number' && typeof x.bloomAt === 'number' &&
          typeof x.species === 'string' && !!B.SPECIES[x.species];
      });
      return g;
    } catch (e) { return { v: 1, plants: [], given: [] }; }
  }
  var STORAGE_FAIL_NOTE = 'This browser will not let the garden remember; anything sown lives only this sitting.';
  /* Read-merge before writing (final-review round 2): another tab may have written since this tab
     loaded, and a blind whole-object overwrite would drop its plants in the sub-100ms window before
     our 'storage' listener fires. Plants are never removed at runtime, so union-by-id is safe (our
     copy wins for shared ids); this matches importGarden's merge semantics. Then, if the write did
     not reach durable storage, reveal the honest #private-note and report failure so the caller can
     say so out loud — a sow must never look saved when it will vanish on close. */
  function saveGarden(g) {
    if (canStore) {
      try {
        var raw = localStorage.getItem(GARDEN_KEY);
        if (raw) {
          var cur = JSON.parse(raw);
          if (cur && cur.v === 1 && Array.isArray(cur.plants)) {
            var have = {};
            for (var i = 0; i < g.plants.length; i++) have[g.plants[i].id] = true;
            for (var j = 0; j < cur.plants.length; j++) {
              var q = cur.plants[j];
              if (q && q.id && !have[q.id] && validPlant(q)) {
                q.seed = q.seed >>> 0; q.closeAt = q.bloomAt + B.SPECIES[q.species].window;
                g.plants.push(q);
              }
            }
            if (Array.isArray(cur.given)) {
              for (var k = 0; k < cur.given.length; k++) {
                var x = cur.given[k];
                if (x && typeof x.sowAt === 'number' && typeof x.bloomAt === 'number' && B.SPECIES[x.species] &&
                    !givenHas(g.given, x)) g.given.push({ species: x.species, sowAt: x.sowAt, bloomAt: x.bloomAt });
              }
            }
          }
        }
      } catch (e) {}
    }
    var ok = sSet(GARDEN_KEY, JSON.stringify(g));
    if (!ok) revealPrivateNote();
    return ok;
  }
  function givenHas(list, x) {
    for (var i = 0; i < list.length; i++) if (list[i].sowAt === x.sowAt && list[i].bloomAt === x.bloomAt) return true;
    return false;
  }
  var garden = loadGarden();

  /* ---------- the clock (ADR-014): backward clamp; forward trusted ---------- */
  var CLOCK_KEY = 'pothos.clock.v1';
  var clockBack = false;
  function now() {
    var t = Date.now();
    var seen = parseInt(sGet(CLOCK_KEY) || '0', 10) || 0;
    if (t < seen - 300000) { clockBack = true; return seen; }
    clockBack = false;
    if (t > seen) sSet(CLOCK_KEY, String(t));
    return t;
  }

  /* ---------- dates: 'en-GB' voice (24h), visitor's own timezone ----------
     Formatters are built once (performance audit: fresh construction was the dominant
     render cost). Records grow a year whenever theirs differs from the current one. */
  var FMT = {
    wkTime: new Intl.DateTimeFormat('en-GB', { weekday: 'long', hour: '2-digit', minute: '2-digit' }),
    full: new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
    fullY: new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    date: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }),
    dateY: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    time: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }),
    day: new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
    dayY: new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  };
  function sameYear(ms) { return new Date(ms).getFullYear() === new Date(Date.now()).getFullYear(); }
  function fWeekdayTime(ms) { return FMT.wkTime.format(ms).replace(',', ''); }
  function fFull(ms) { return (sameYear(ms) ? FMT.full : FMT.fullY).format(ms); }
  function fDate(ms) { return (sameYear(ms) ? FMT.date : FMT.dateY).format(ms); }
  function fDateYear(ms) { return FMT.dateY.format(ms); }
  function fTime(ms) { return FMT.time.format(ms); }
  function fDay(ms) { return (sameYear(ms) ? FMT.day : FMT.dayY).format(ms); }
  function sameDay(a, b) { return new Date(a).toDateString() === new Date(b).toDateString(); }

  /* the phrasing ladder (ADR-014): calendar voice; precision degrades in language only */
  function openPhrase(p, t) {
    var d = p.bloomAt - t;
    var dayMs = 86400000;
    if (t >= p.bloomAt && t < p.closeAt) {
      var closes = sameDay(t, p.closeAt) ? fTime(p.closeAt) + (new Date(p.closeAt).getHours() >= 17 ? ' this evening' : ' today')
        : fDay(p.closeAt);
      return 'Open now · until ' + closes + '.';
    }
    if (t >= p.closeAt) return 'Went to seed ' + fDay(p.closeAt) + ', ' + fTime(p.closeAt) + '.';
    if (d > 45 * dayMs) {
      var y = new Date(p.bloomAt).getFullYear() !== new Date(t).getFullYear();
      return 'Opens ' + (y ? fDateYear(p.bloomAt) : fDate(p.bloomAt)) + '.';
    }
    if (d > 7 * dayMs) {
      var weeks = Math.round(d / (7 * dayMs));
      return 'Opens ' + fDate(p.bloomAt) + ' — ' + (weeks <= 1 ? 'a week' : countW(weeks) + ' weeks') + ' from now.';
    }
    if (sameDay(t, p.bloomAt)) return 'Opens today at ' + fTime(p.bloomAt) + '.';
    if (sameDay(t + dayMs, p.bloomAt)) return 'Opens tomorrow at ' + fTime(p.bloomAt) + '.';
    return 'Opens ' + fWeekdayTime(p.bloomAt) + '.';
  }
  function countW(n) { var w = ['zero', 'one', 'two', 'three', 'four', 'five', 'six']; return n < w.length ? w[n] : String(n); }
  function windowPhrase(species) {
    if (species === 'day') return 'stays open six hours';
    if (species === 'week') return 'stays open a day';
    if (species === 'season') return 'stays open three days';
    return 'stays open about a minute and a half';
  }

  /* ---------- gift / packet codec: #v1.<sp>.<sow36>.<bloom36>.<seed36> ---------- */
  var SP_CODE = { day: 'd', week: 'w', season: 's', rehearsal: 'r' };
  var CODE_SP = { d: 'day', w: 'week', s: 'season', r: 'rehearsal' };
  function encodePacket(p) {
    return '#v1.' + SP_CODE[p.species] + '.' + p.sowAt.toString(36) + '.' + p.bloomAt.toString(36) + '.' + (p.seed >>> 0).toString(36);
  }
  function decodePacket(hash) {
    var m = /^#v1\.([dwsr])\.([0-9a-z]+)\.([0-9a-z]+)\.([0-9a-z]+)$/.exec(hash || '');
    if (!m) return null;
    var species = CODE_SP[m[1]];
    var sowAt = parseInt(m[2], 36), bloomAt = parseInt(m[3], 36), seed = parseInt(m[4], 36) >>> 0;
    if (!isFinite(sowAt) || !isFinite(bloomAt) || sowAt <= 0 || bloomAt <= sowAt) return null;
    /* the wait must be the species' own wait, within the placement door's ±12h band — so a
       hand-forged fragment cannot mint an instant Season. "Nothing can hurry it" becomes an
       enforced invariant, not a mere convention (deep-thinkers, Tao P1). Rehearsal is exact. */
    if (B.SPECIES[species]) {
      var wait = bloomAt - sowAt, nominal = B.SPECIES[species].wait;
      var band = species === 'rehearsal' ? 1000 : 43200000; /* 12h day-wrap; rehearsal ~exact */
      if (Math.abs(wait - nominal) > band) return null;
    }
    return { species: species, sowAt: sowAt, bloomAt: bloomAt, seed: seed };
  }
  function packetURL(p) {
    return location.origin === 'null' || location.protocol === 'file:'
      ? location.href.split('#')[0] + encodePacket(p)
      : location.href.split('#')[0].split('?')[0] + encodePacket(p);
  }

  /* ---------- placement door (ADR-014) ---------- */
  function resolveBand(sowAt, wait, seed, anchor) {
    var target = sowAt + wait;
    var minutes = (seed >>> 0) % 180;
    /* Wrap by CALENDAR day, not a fixed 24h, and re-pin the wall-clock anchor hour on each
       candidate day — so a bloom maturing on a DST-transition day (a 23h/25h local day) still
       lands exactly on its disclosed anchor hour instead of drifting ±1h (final-review round 2).
       Pick the anchor-hour instant nearest the nominal target; it is always within 12h. */
    function atDay(offset) {
      var d = new Date(target);
      d.setDate(d.getDate() + offset);
      d.setHours(anchor, minutes, 0, 0);
      return d.getTime();
    }
    var best = atDay(0);
    var alt = [atDay(-1), atDay(1)];
    for (var i = 0; i < alt.length; i++) if (Math.abs(alt[i] - target) < Math.abs(best - target)) best = alt[i];
    return best;
  }
  function placements(sowAt, species, seed) {
    var wait = B.SPECIES[species].wait;
    return [
      { key: 'hour', label: 'Keep this hour', bloomAt: sowAt + wait },
      { key: 'morning', label: 'With the morning', bloomAt: resolveBand(sowAt, wait, seed, 8) },
      { key: 'evening', label: 'With the evening', bloomAt: resolveBand(sowAt, wait, seed, 19) }
    ];
  }
  /* DST notice: only "keep this hour" can carry a wall-hour surprise — its bloom is
     sowAt + a fixed offset, so a daylight-saving change between now and then shifts the
     displayed hour. Morning/evening blooms are pinned to their anchor hour at the bloom
     instant's own DST (resolveBand), so they never shift; those pass chosenAt = null and
     get no notice. (Deep-thinkers Tao P3: the old call compared an hour to itself.) */
  function dstNotice(chosenAt, bloomAt) {
    if (chosenAt == null) return null;
    if (new Date(chosenAt).getHours() !== new Date(bloomAt).getHours()) {
      return 'The clocks change before this opens. By the clock you will have then, it opens at ' + fTime(bloomAt) + '.';
    }
    return null;
  }

  /* ---------- DOM handles ---------- */
  function $(id) { return doc.getElementById(id); }
  var els = {};
  ['status', 'almanac', 'plants', 'empty', 'pressed', 'pressedSec', 'rehearsalShelf', 'rehearsalH',
    'sowHow', 'dish', 'sowStage', 'giftView', 'gate', 'givenList', 'soundToggle'].forEach(function (k) { els[k] = null; });

  function announce(msg) { if (els.status) els.status.textContent = msg; }

  /* ---------- SVG plate builder ---------- */
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function plateSVG(bp, state, mode, titleText, descText, extraClass, pressed) {
    var tId = 'sv' + (plateSVG._n = (plateSVG._n || 0) + 1);
    var tilt = pressed ? ' transform="rotate(' + bp.pressTilt.toFixed(1) + ' 100 190)"' : '';
    return '<svg class="plant ' + (extraClass || '') + '" viewBox="0 0 200 260" role="img" aria-labelledby="' + tId + 't ' + tId + 'd">' +
      '<title id="' + tId + 't">' + esc(titleText) + '</title>' +
      '<desc id="' + tId + 'd">' + esc(descText) + '</desc>' +
      '<g' + tilt + '>' + B.renderPlant(bp, state, mode) + '</g>' +
      '</svg>';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ---------- downloads (.ics, packet, garden file) — client-side blobs, zero network ----------
     Blob + object URL, not data: URIs (playtest: iOS Safari mangles data: downloads) */
  function download(name, mime, text) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = doc.createElement('a');
    a.href = url; a.download = name;
    doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }
  function icsFor(p) {
    function icsDate(ms) { return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
    /* RFC 5545 TEXT escaping (compat audit: '\#' is invalid and can corrupt the seed link) */
    function icsText(s) {
      return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    }
    /* fold lines at 75 octets per RFC 5545 (CRLF + single space) */
    function fold(line) {
      var out = '';
      while (line.length > 73) { out += line.slice(0, 73) + '\r\n '; line = line.slice(73); }
      return out + line;
    }
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//POTHOS//EN', 'BEGIN:VEVENT',
      'UID:' + p.seed.toString(36) + '.' + p.sowAt.toString(36) + '@pothos',
      'DTSTAMP:' + icsDate(p.sowAt),
      'DTSTART:' + icsDate(p.bloomAt),
      'DTEND:' + icsDate(p.closeAt),
      /* ASCII only in the .ics (compat audit): the em-dash was one multi-byte character that
         a length-based fold could in principle bisect if a label ever grew long */
      fold('SUMMARY:A bloom opens - ' + (B.SPECIES[p.species] ? B.SPECIES[p.species].label : p.species) + ' seed'),
      /* the seed line, labelled — so the calendar entry is a re-entry path to the exact
         plant on any device, not a bare URL (handpicked session: the durable anchor across
         the device switch, the modal cross-Season failure) */
      fold('DESCRIPTION:' + icsText('Open this to return to the seed on any device: ' + packetURL(p))),
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  }

  /* ---------- plants ---------- */
  function makePlant(species, seed, sowAt, bloomAt, givenIn) {
    return {
      id: 'p' + sowAt.toString(36) + (seed % 997),
      gv: 1, seed: seed >>> 0, species: species,
      sowAt: sowAt, bloomAt: bloomAt, closeAt: bloomAt + B.SPECIES[species].window,
      witnessedAt: null, foreseenAt: null, givenIn: !!givenIn, acceptedAt: null
    };
  }
  function findPlant(seed, sowAt) {
    for (var i = 0; i < garden.plants.length; i++) {
      if (garden.plants[i].seed === seed && garden.plants[i].sowAt === sowAt) return garden.plants[i];
    }
    return null;
  }

  /* witness: a fact about the visitor, written once (INV-04). The chord plays only when
     audio is actually running (compat audit: autoplay policy would silently eat it and a
     stale chord could burst out during a later gesture). */
  var chordPlayed = {};
  function witness(p, t) {
    if (!p.witnessedAt) { p.witnessedAt = t; saveGarden(garden); }
    if (!chordPlayed[p.id]) {
      if (E.Audio.witness(p.seed)) chordPlayed[p.id] = true;
    }
  }

  /* ---------- rendering ---------- */
  var boundaryTimer = null;
  function hourClass(t) {
    var h = new Date(t).getHours();
    if (h >= 5 && h < 9) return 'h-dawn';
    if (h >= 9 && h < 17) return 'h-day';
    if (h >= 17 && h < 21) return 'h-dusk';
    return 'h-night';
  }

  function stakeLines(p, t) {
    var lines = [];
    lines.push('Sown ' + fDay(p.sowAt) + ', ' + fTime(p.sowAt) + '.');
    if (p.species === 'rehearsal' && t < p.bloomAt) {
      /* the rehearsal speaks in 'about' language, visibly (playtest: the best sentence
         must not live only in the live region) */
      lines.push('Opens in a few minutes. You do not have to watch.');
    } else {
      lines.push(openPhrase(p, t) + (t < p.bloomAt ? ' It ' + windowPhrase(p.species) + '.' : ''));
    }
    return lines;
  }

  function renderPlantCard(p, t) {
    var bp = B.buildBlueprint(p.seed, p.species);
    var st = B.stateAt(p.species, p.sowAt, p.bloomAt, t);
    var sp = B.SPECIES[p.species];
    var mode = p.species === 'rehearsal' ? 'sketch' : 'live';
    var title = sp.label + ' plant, ' + (st.phase === 'open' ? 'open now' : (st.phase === 'seeded' ? 'gone to seed' : B.stageLabel(p.species, st.stage)));
    var desc = B.describe(bp, st, sp.label);
    var li = doc.createElement('li');
    li.className = 'plot' + (st.phase === 'open' ? ' open' : '') + (p.species === 'rehearsal' ? ' rehearsal-plot' : '');
    li.dataset.id = p.id;
    var openNow = st.phase === 'open';
    /* no idle breath: after it opens, the plant stands still — stillness is the plant not
       auditioning (game-masters subtractive ruling; a 12s pulse for up to 3 days performed
       aliveness at no one). The opening ceremony is the plant's one motion. */
    var html = '';
    html += '<article aria-labelledby="h' + p.id + '">';
    html += plateSVG(bp, st, mode, title, desc, (openNow ? ' bloom-live' : ''), false);
    html += '<div class="under">';
    html += '<h3 id="h' + p.id + '" tabindex="-1"><span class="species">' + sp.label + '</span>' + (p.givenIn ? ' <span class="given-mark" title="arrived by seed line">○</span>' : '') + '</h3>';
    html += '<p class="phase">' + esc(st.phase === 'open' ? 'open' : (st.phase === 'seeded' ? 'gone to seed' : B.stageLabel(p.species, st.stage))) + '</p>';
    var lines = stakeLines(p, t);
    for (var i = 0; i < lines.length; i++) html += '<p class="stake">' + esc(lines[i]) + '</p>';
    if (p.witnessedAt) html += '<p class="ledger ledger-w">Witnessed, ' + esc(fFull(p.witnessedAt)) + '.</p>';
    if (p.foreseenAt) html += '<p class="ledger ledger-f">Seen early, ' + esc(fDay(p.foreseenAt)) + '.</p>';
    /* growth notes: derived, never stored */
    if (st.phase === 'growing' && p.species !== 'rehearsal') {
      var notes = B.growthNotes(p.species, p.sowAt, p.bloomAt, t);
      if (notes.length > 1) {
        html += '<details class="notes"><summary>Notes</summary>';
        for (var n = 0; n < notes.length; n++) html += '<p>' + esc(notes[n].label) + ' — ' + esc(fDay(notes[n].at)) + '</p>';
        html += '</details>';
      }
    }
    html += '<div class="doors">';
    if (st.phase === 'growing' && p.species !== 'rehearsal') {
      html += '<button type="button" class="door foresee" data-id="' + p.id + '" aria-describedby="fd' + p.id + '">See it now</button>';
      html += '<span class="pre-door" id="fd' + p.id + '">a drawing, not the bloom</span>';
    }
    if (p.species !== 'rehearsal') {
      html += '<button type="button" class="door ics" data-id="' + p.id + '">Keep the date (calendar file)</button>';
      html += '<button type="button" class="door packet" data-id="' + p.id + '">Keep a copy of this seed</button>';
    }
    html += '</div></div></article>';
    li.innerHTML = html;
    return li;
  }

  function pressingMode(p) {
    if (p.witnessedAt) return 'pressed';
    if (p.foreseenAt) return 'pressed-study';
    return 'pressed-unseen';
  }
  function renderPressedPlate(p, t) {
    var bp = B.buildBlueprint(p.seed, p.species);
    var mode = p.species === 'rehearsal' ? 'sketch' : pressingMode(p);
    /* ADR-011: the pressing shows what you saw. witnessed -> open+quiet color;
       foreseen -> open line-study; unseen -> the seed-head that remained. */
    var st = mode === 'pressed' ? { phase: 'open', u: 1 } : (mode === 'pressed-study' ? { phase: 'open', u: 1 } : { phase: 'seeded', u: 1 });
    var li = doc.createElement('li');
    li.className = 'plate';
    var sp = B.SPECIES[p.species];
    var factLine;
    /* the transit case (deep-thinkers panel, the sharpest single finding): a gift that
       bloomed and closed before it was ever taken in was never yours to attend — the ledger
       must not accuse you of an absence you could not have helped. "You were away." is
       reserved for a plant that was yours through its window. When a gift's take-in time is
       unknown (a record from before this fact was tracked, or an imported file), absence is
       the one reading not to assert without evidence — so it reads transit, not away
       (round-2 audit, logic seat). */
    var transit = p.givenIn && (p.acceptedAt == null || p.acceptedAt >= p.closeAt);
    if (p.species === 'rehearsal') factLine = 'A rehearsal. ' + fDay(p.sowAt) + '. That was a drawing of waiting; color comes only after a real wait.';
    else if (p.witnessedAt) factLine = 'Witnessed, ' + fFull(p.witnessedAt) + '.';
    else if (transit) factLine = 'It bloomed on the way here — ' + fFull(p.bloomAt) + ', and closed before it reached you. Its record is kept.';
    else factLine = 'It opened ' + fFull(p.bloomAt) + ' and closed ' + fFull(p.closeAt) + '. You were away.';
    /* the sentence matches the pressing mode (ADR-011; playtest sr-user fix) */
    var saw = p.species === 'rehearsal' ? 'rehearsal' : (p.witnessedAt ? 'witnessed' : (p.foreseenAt ? 'foreseen' : 'unseen'));
    var bloomWords = B.describePressed(bp, sp.label, saw); /* words tell the whole truth */
    var descText = bloomWords + ' ' + factLine;
    var justClosed = p.witnessedAt && t >= p.closeAt && t < p.closeAt + 86400000;
    var html = '<figure>';
    html += plateSVG(bp, st, mode === 'pressed-study' ? 'sketch' : mode, sp.label + ' — pressed', descText, 'pressed-svg', true);
    html += '<figcaption>';
    html += '<p class="label"><span class="species">' + sp.label + '</span> · sown ' + esc(fDate(p.sowAt)) + '</p>';
    html += '<p class="fact">' + esc(factLine) + '</p>';
    if (p.species !== 'rehearsal') {
      /* the bloom told in words, on every real pressing — declarative botany is the one
         warmth the copy ban permits, spent where it was earned (reflection, aesthetics seat) */
      var d2 = bloomWords; var idx2 = d2.indexOf('It opened');
      if (idx2 >= 0) html += '<p class="fact words">' + esc(d2.slice(idx2)) + '</p>';
    }
    if (p.foreseenAt && !p.witnessedAt) html += '<p class="ledger">Seen early, ' + esc(fDay(p.foreseenAt)) + '.</p>';
    if (justClosed) html += '<p class="fact">It has gone to seed. The record keeps it.</p>';
    html += '</figcaption></figure>';
    li.innerHTML = html;
    return li;
  }

  var clockToldThisSitting = false;
  function renderGarden() {
    var t = now();
    foreseeState = {}; /* any open study is superseded by the rebuild (perf audit) */
    /* remember focus so a full rebuild never strands a keyboard user (a11y audit) */
    var focusPlantId = null, focusSel = null;
    var ae = doc.activeElement;
    if (ae && els.plants && els.plants.contains(ae)) {
      var plot = ae.closest ? ae.closest('li.plot') : null;
      if (plot) {
        focusPlantId = plot.dataset.id;
        if (ae.classList.contains('foresee')) focusSel = 'button.foresee';
        else if (ae.classList.contains('ics')) focusSel = 'button.ics';
        else if (ae.classList.contains('packet')) focusSel = 'button.packet';
        else focusSel = 'h3';
      }
    }
    doc.body.className = doc.body.className.replace(/h-\w+/g, '').trim() + ' ' + hourClass(t);
    if (els.almanac) els.almanac.textContent = fDay(t);
    if (clockBack && !clockToldThisSitting) {
      announce('Your clock has gone back. The garden keeps the later hour.');
      clockToldThisSitting = true;
    }
    /* witnessing = the disclosed rule: you are here while it is open (page visible during the
       window). Presence-only; no interaction, no scroll position, no reading speed. */
    witnessOpenPlants(t);

    var living = [], pressed = [], rehearsalsPressed = [];
    for (var i = 0; i < garden.plants.length; i++) {
      var p = garden.plants[i];
      var st = B.stateAt(p.species, p.sowAt, p.bloomAt, t);
      if (st.phase === 'seeded') {
        if (p.species === 'rehearsal') rehearsalsPressed.push(p); else pressed.push(p);
      } else living.push(p);
    }
    /* rehearsal shelf keeps only the latest (ADR-013) */
    rehearsalsPressed.sort(function (a, b) { return b.sowAt - a.sowAt; });
    rehearsalsPressed = rehearsalsPressed.slice(0, 1);

    els.plants.innerHTML = '';
    living.sort(function (a, b) { return a.bloomAt - b.bloomAt; });
    for (var j = 0; j < living.length; j++) els.plants.appendChild(renderPlantCard(living[j], t));
    els.empty.hidden = living.length > 0 || pressed.length > 0 || rehearsalsPressed.length > 0;

    els.pressed.innerHTML = '';
    /* oldest-first: a herbarium accretes; newest-first is the feed's grammar, refused
       everywhere else in the piece (visual-arts panel, unopposed) */
    pressed.sort(function (a, b) { return a.closeAt - b.closeAt; });
    for (var k = 0; k < pressed.length; k++) els.pressed.appendChild(renderPressedPlate(pressed[k], t));
    els.rehearsalShelf.innerHTML = '';
    for (var r = 0; r < rehearsalsPressed.length; r++) els.rehearsalShelf.appendChild(renderPressedPlate(rehearsalsPressed[r], t));
    els.rehearsalH.hidden = rehearsalsPressed.length === 0;
    els.pressedSec.hidden = pressed.length === 0 && rehearsalsPressed.length === 0;

    /* given packets (fact lines only — no live view, ADR-018) */
    els.givenList.innerHTML = '';
    for (var gv = 0; gv < garden.given.length; gv++) {
      var g = garden.given[gv];
      var li = doc.createElement('li');
      var gWin = B.SPECIES[g.species] ? B.SPECIES[g.species].window : 0;
      var gLabel = B.SPECIES[g.species] ? B.SPECIES[g.species].label : g.species;
      var gLine;
      if (t > g.bloomAt + gWin) gLine = 'It opened ' + fFull(g.bloomAt) + '.';
      else if (t >= g.bloomAt) gLine = 'It is open now, until ' + fFull(g.bloomAt + gWin) + '.';
      else gLine = 'It opens ' + fFull(g.bloomAt) + '.';
      li.textContent = 'Given, ' + fDate(g.sowAt) + ' — a ' + gLabel + ' seed. ' + gLine;
      els.givenList.appendChild(li);
    }

    if (focusPlantId) {
      var back = els.plants.querySelector('li.plot[data-id="' + focusPlantId + '"] ' + focusSel);
      if (back) { try { back.focus(); } catch (x) {} }
    }
    scheduleNextBoundary(t);
  }

  /* witnessing: you are here while it is open — the About's own sentence, made the code's rule
     (playtest skeptic seat: the machine must never call a present visitor absent) */
  function witnessOpenPlants(t) {
    if (doc.hidden) return;
    var msgs = [];
    for (var i = 0; i < garden.plants.length; i++) {
      var p = garden.plants[i];
      if (t >= p.bloomAt && t < p.closeAt) {
        var newly = !p.witnessedAt;
        witness(p, t);
        if (newly) {
          var bp = B.buildBlueprint(p.seed, p.species);
          msgs.push(B.describe(bp, { phase: 'open', u: 1 }, B.SPECIES[p.species].label));
        }
      }
    }
    if (msgs.length) announce('Open now. Witnessed. ' + msgs.join(' '));
  }
  function byId(id) {
    for (var i = 0; i < garden.plants.length; i++) if (garden.plants[i].id === id) return garden.plants[i];
    return null;
  }

  /* one timeout to the next phase boundary — no polling, no ticking (ADR-014).
     Stage boundaries update the affected card IN PLACE (playtest sr-user: a full rebuild
     clobbers a screen reader's place); a phase change into seeded reflows the sections. */
  function scheduleNextBoundary(t) {
    if (boundaryTimer) { clearTimeout(boundaryTimer); boundaryTimer = null; }
    var next = Infinity;
    for (var i = 0; i < garden.plants.length; i++) {
      var p = garden.plants[i];
      if (t < p.bloomAt) {
        var N = B.STAGE_COUNT[p.species];
        var stage = Math.min(N - 1, Math.floor(((t - p.sowAt) / (p.bloomAt - p.sowAt)) * N));
        var nb = p.sowAt + ((stage + 1) / N) * (p.bloomAt - p.sowAt);
        next = Math.min(next, nb, p.bloomAt);
      } else if (t < p.closeAt) next = Math.min(next, p.closeAt);
    }
    if (!isFinite(next)) return;
    var delay = Math.max(1000, Math.min(next - t + 100, 2147000000));
    boundaryTimer = setTimeout(function () {
      var t2 = now();
      if (doc.hidden) { scheduleNextBoundary(t2); return; } /* the return re-renders anyway */
      var reflow = false;
      var openedNow = [];
      for (var i = 0; i < garden.plants.length; i++) {
        var p = garden.plants[i];
        if (t2 >= p.closeAt && p.closeAt > t) reflow = true; /* something pressed: sections change */
        else if (Math.abs(t2 - p.bloomAt) < 3000) openedNow.push(p);
      }
      if (reflow) { renderGarden(); return; }
      /* in-place updates for still-living plants */
      for (var j = 0; j < garden.plants.length; j++) {
        var q = garden.plants[j];
        var st = B.stateAt(q.species, q.sowAt, q.bloomAt, t2);
        if (st.phase !== 'seeded') refreshCardVisuals(q, t2);
      }
      witnessOpenPlants(t2);
      /* a bloom opening in the visitor's presence: the one ceremony (ADR-012).
         Late arrivals never see a replayed opening — the bloom is simply open. */
      if (!doc.hidden) openedNow.forEach(playCeremony);
      scheduleNextBoundary(t2);
    }, delay);
  }

  /* update one card's drawing and words without replacing focusable nodes */
  function refreshCardVisuals(p, t) {
    var li = els.plants.querySelector('li.plot[data-id="' + p.id + '"]');
    if (!li) return;
    var bp = B.buildBlueprint(p.seed, p.species);
    var st = B.stateAt(p.species, p.sowAt, p.bloomAt, t);
    var sp = B.SPECIES[p.species];
    var mode = p.species === 'rehearsal' ? 'sketch' : 'live';
    var svg = li.querySelector('svg.plant');
    if (svg) {
      var tEl = svg.querySelector('title'), dEl = svg.querySelector('desc'), g = svg.querySelector('g');
      if (tEl) tEl.textContent = sp.label + ' plant, ' + (st.phase === 'open' ? 'open now' : B.stageLabel(p.species, st.stage));
      if (dEl) dEl.textContent = B.describe(bp, st, sp.label);
      if (g) g.innerHTML = B.renderPlant(bp, st, mode);
    }
    li.classList.toggle('open', st.phase === 'open');
    var ph = li.querySelector('.phase');
    if (ph) ph.textContent = st.phase === 'open' ? 'open' : B.stageLabel(p.species, st.stage);
    var stakes = li.querySelectorAll('.stake');
    var lines = stakeLines(p, t);
    for (var i = 0; i < stakes.length && i < lines.length; i++) stakes[i].textContent = lines[i];
    if (p.witnessedAt && !li.querySelector('.ledger-w')) {
      var led = doc.createElement('p'); led.className = 'ledger ledger-w';
      led.textContent = 'Witnessed, ' + fFull(p.witnessedAt) + '.';
      var doors = li.querySelector('.doors');
      if (doors) doors.parentNode.insertBefore(led, doors);
    }
  }

  /* the ceremony: openF plays 0→1 over ~45 s for a visitor present at opensAt */
  function playCeremony(p) {
    var li = els.plants.querySelector('li.plot[data-id="' + p.id + '"]');
    if (!li) return;
    var svg = li.querySelector('svg.plant');
    var g = svg && svg.querySelector('g');
    if (!g) return;
    var bp = B.buildBlueprint(p.seed, p.species);
    var mode = p.species === 'rehearsal' ? 'sketch' : 'live';
    if (!E.Motion.shouldAnimate()) {
      g.innerHTML = B.renderPlant(bp, { phase: 'open', u: 1 }, mode);
      return;
    }
    /* the unfold IS the ceremony: openF steps the petals 0->1 below. No opacity fade laid
       over it — a plant opens once, and the CSS bloomIn was a second opening on the same
       plant (game-masters double-ceremony strike). Paint the first (near-closed) frame
       synchronously so the plant never flashes full-open then rewinds — the boundary loop
       had already refreshed it to a full bloom before the ceremony began (round-2 bug-fix). */
    g.innerHTML = B.renderPlant(bp, { phase: 'open', u: 1, openF: 0.15 }, mode);
    var steps = 15, k = 0;
    var iv = setInterval(function () {
      k++;
      if (!g.isConnected) { clearInterval(iv); return; } /* the card was rebuilt (perf audit) */
      var f = k / steps, eased = 1 - Math.pow(1 - f, 2);
      g.innerHTML = B.renderPlant(bp, { phase: 'open', u: 1, openF: 0.15 + 0.85 * eased }, mode);
      if (k >= steps || doc.hidden) { clearInterval(iv); g.innerHTML = B.renderPlant(bp, { phase: 'open', u: 1 }, mode); }
    }, 3000);
  }

  /* ---------- the sow gesture (ADR-017): two events, every modality ----------
     Plus (playtest fixes): a synthetic-click path for assistive tech, and a movement-slop
     cancel so a scroll flick that starts on a seed never sows. */
  var hold = null; /* {species, forGift, t0, el, armed, px, py} */
  var lastGestureEnd = 0;
  function holdBegin(btn, species, forGift, px, py) {
    if (hold) {
      if (hold.el === btn) return;
      /* an armed seed must never silently brick the rest of the dish (a11y audit, high):
         taking a different seed puts the held one back first */
      holdEnd(false);
    }
    hold = { species: species, forGift: forGift, t0: performance.now(), el: btn, armed: false, px: px, py: py };
    btn.classList.add('holding');
    E.Audio.holdStart();
    var line = btn.querySelector('.riser');
    if (line) {
      line.style.transition = 'height 2.35s linear';
      requestAnimationFrame(function () { line.style.height = '46px'; });
    }
  }
  function holdEnd(commit) {
    if (!hold) return;
    lastGestureEnd = performance.now();
    var h = hold; hold = null;
    h.el.classList.remove('holding');
    E.Audio.holdEnd();
    var line = h.el.querySelector('.riser');
    if (line) { line.style.transition = 'none'; line.style.height = '2px'; }
    h.el.removeAttribute('data-armed');
    if (!commit) { announce('Put back.'); return; }
    var heldMs = performance.now() - h.t0;
    if (heldMs < 150 && !h.armed) {
      /* a discrete activation: arm — the second activation completes (switch access path) */
      hold = h; h.armed = true; h.t0 = performance.now();
      h.el.classList.add('holding');
      h.el.setAttribute('data-armed', '1');
      announce('Held. Press again to let go.');
      var l2 = h.el.querySelector('.riser');
      if (l2) { l2.style.transition = 'height 2.35s linear'; requestAnimationFrame(function () { l2.style.height = '46px'; }); }
      return;
    }
    h.el.removeAttribute('data-armed');
    finishSow(h.species, heldMs, h.forGift);
  }
  function finishSow(species, heldMs, forGift) {
    var fine = (Math.floor(performance.now() * 1000) ^ Date.now()) >>> 0;
    var seed = B.makeSeed(heldMs, fine);
    var sowAt = now();
    if (species === 'rehearsal' && !forGift) {
      var p = makePlant('rehearsal', seed, sowAt, sowAt + B.SPECIES.rehearsal.wait, false);
      var okR = (garden.plants.push(p), saveGarden(garden));
      E.Audio.sow();
      announce('Sown. A rehearsal. It opens in about two and a half minutes. You do not have to watch.' + (okR ? '' : ' ' + STORAGE_FAIL_NOTE));
      renderGarden();
      focusPlant(p.id);
      return;
    }
    showPlacementDoor(species, seed, sowAt, forGift);
  }
  function focusPlant(id) {
    var h = doc.getElementById('h' + id);
    if (h) h.focus();
  }

  /* the placement door (ADR-014): three placements, no text input */
  function showPlacementDoor(species, seed, sowAt, forGift) {
    var stage = els.sowStage;
    var opts = placements(sowAt, species, seed);
    opts[0].label = 'Keep this hour — the hour you sowed';
    var html = '<p class="door-lead" id="door-lead">A ' + B.SPECIES[species].label + ' seed, held. When should it open?</p>' +
      '<p class="door-note" id="door-note">Morning and evening land on the nearest such hour to the wait’s end — sometimes a little before it.</p><div class="place-row">';
    for (var i = 0; i < opts.length; i++) {
      html += '<button type="button" class="place" data-i="' + i + '" aria-describedby="door-lead door-note"><span>' + esc(opts[i].label) + '</span><span class="place-when">' + esc(fFull(opts[i].bloomAt)) + '</span></button>';
    }
    html += '</div><button type="button" class="linklike" id="put-back">Put it back</button>';
    stage.innerHTML = html; stage.hidden = false;
    stage.querySelector('#put-back').addEventListener('click', function () {
      stage.hidden = true; stage.innerHTML = ''; announce('Put back.');
      /* focus returns to the seed that was held (a11y audit) */
      var seedBtn = doc.querySelector('button.seed[data-species="' + species + '"]' + (forGift ? '[data-gift]' : ':not([data-gift])'));
      if (seedBtn) seedBtn.focus();
    });
    stage.querySelectorAll('button.place').forEach(function (b) {
      b.addEventListener('click', function () {
        var opt = opts[parseInt(b.dataset.i, 10)];
        stage.hidden = true; stage.innerHTML = '';
        if (forGift) completeGift(species, seed, sowAt, opt.bloomAt);
        else completeSow(species, seed, sowAt, opt.bloomAt, opt.key === 'hour' ? sowAt : null);
      });
    });
    stage.querySelector('button.place').focus();
  }
  function completeSow(species, seed, sowAt, bloomAt, chosenRef) {
    var p = makePlant(species, seed, sowAt, bloomAt, false);
    var okSow = (garden.plants.push(p), saveGarden(garden));
    E.Audio.sow();
    var sp = B.SPECIES[species];
    /* the appointment, exact, both ends (playtest: the card must not forget its own 09:57) */
    var msg = 'Sown. A ' + sp.label + ' seed. Opens ' + fFull(bloomAt) + '. Stays open until ' + fFull(p.closeAt) + '.';
    var dst = dstNotice(chosenRef, bloomAt);
    /* the post-sow card: a dead-end by design (INV-15) */
    var stage = els.sowStage;
    var html = '<div class="post-sow"><p>' + esc(msg) + '</p>';
    if (dst) html += '<p>' + esc(dst) + '</p>';
    html += '<p class="packet-line">Browsers forget. The seed’s whole future fits in this line — keep it anywhere:</p>';
    html += '<p class="packet-url"><code>' + esc(packetURL(p)) + '</code></p>';
    html += '<p class="persist-line" id="ps-persist">Asking the browser to keep this garden…</p>';
    html += '<div class="doors"><button type="button" class="door" id="ps-ics">Keep the date (calendar file)</button>' +
      '<button type="button" class="door" id="ps-copy">Copy the seed line</button>' +
      '<a class="linklike" href="#garden-h" id="ps-return">Return to the garden</a></div></div>';
    stage.innerHTML = html; stage.hidden = false;
    stage.querySelector('#ps-ics').addEventListener('click', function () { download('pothos-' + species + '.ics', 'text/calendar', icsFor(p)); });
    stage.querySelector('#ps-copy').addEventListener('click', function () { copyText(packetURL(p), this); });
    stage.querySelector('#ps-return').addEventListener('click', function () { stage.hidden = true; stage.innerHTML = ''; });
    announce(msg + (dst ? ' ' + dst : '') + (okSow ? '' : ' ' + STORAGE_FAIL_NOTE));
    renderGarden();
    var firstDoor = stage.querySelector('button.door');
    if (firstDoor) firstDoor.focus(); /* the card the action created receives focus (a11y audit) */
    /* ask the browser's own petition, once, and print its answer here (visual-arts panel).
       The card shows a placeholder immediately so the disclosed answer is never raced away
       before a fast reader sees it (round-2 playtest, live-driver). */
    askToPersist(function (line) {
      var el = doc.getElementById('ps-persist');
      if (!el) return;
      if (line) el.textContent = line;
      else el.hidden = true; /* nothing to ask (already asked, or unavailable): drop it */
    });
  }

  function copyText(text, btn) {
    function done() {
      announce('Copied. The seed line is on your clipboard.');
      if (btn) { var old = btn.textContent; btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = old; }, 1500); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = doc.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.left = '-9999px';
    doc.body.appendChild(ta); ta.select();
    try { doc.execCommand('copy'); } catch (e) {}
    doc.body.removeChild(ta);
  }

  /* ---------- the gate: sow one for someone (ADR-009/018) ---------- */
  function completeGift(species, seed, sowAt, bloomAt) {
    var p = { seed: seed, species: species, sowAt: sowAt, bloomAt: bloomAt };
    garden.given.push({ species: species, sowAt: sowAt, bloomAt: bloomAt });
    var okGift = saveGarden(garden);
    E.Audio.sow();
    var url = packetURL(p);
    var stage = els.sowStage;
    var html = '<div class="post-sow"><p>A seed for someone. It starts growing now, and keeps growing while it travels. No name goes with it.</p>' +
      '<p>Nothing is sent from here. Copying the address gives you a link; the plant reaches someone only if you send it and they open it.</p>';
    html += '<p>It opens ' + esc(fFull(bloomAt)) + '.</p>';
    html += '<p class="packet-url"><code>' + esc(url) + '</code></p>';
    html += '<div class="doors"><button type="button" class="door" id="gift-copy">Copy the address</button>' +
      '<a class="linklike" href="#garden-h" id="gift-return">Return to the garden</a></div></div>';
    stage.innerHTML = html; stage.hidden = false;
    stage.querySelector('#gift-copy').addEventListener('click', function () { copyText(url, this); });
    stage.querySelector('#gift-return').addEventListener('click', function () { stage.hidden = true; stage.innerHTML = ''; });
    announce('A seed for someone. Copy the address and send it however you like.' + (okGift ? '' : ' ' + STORAGE_FAIL_NOTE));
    renderGarden();
    var giftDoor = stage.querySelector('button.door');
    if (giftDoor) giftDoor.focus();
  }

  /* ---------- receiving a gift / packet ---------- */
  function handleFragment() {
    var pk = decodePacket(location.hash);
    if (!pk) {
      if (location.hash && /^#v\d/.test(location.hash)) {
        els.giftView.hidden = false;
        els.giftView.innerHTML = '<h2 class="sr-only">A seed line</h2><p>This seed did not survive the crossing. The link is incomplete or from a newer garden.</p>';
      }
      return;
    }
    var t = now();
    if (pk.sowAt > t) pk.sowAt = t; /* a seed from a fast clock: it begins now (ADR-014) */
    var bp = B.buildBlueprint(pk.seed, pk.species);
    var st = B.stateAt(pk.species, pk.sowAt, pk.bloomAt, t);
    var sp = B.SPECIES[pk.species];
    var existing = findPlant(pk.seed, pk.sowAt);
    /* the link cannot know whether it was a gift or the sower's own seed line (editorial
       audit): the head states only what the packet carries. Rehearsals stay in the line
       register even by packet (ADR-013). */
    var mode = pk.species === 'rehearsal' ? 'sketch'
      : (st.phase === 'seeded' ? 'pressed-unseen' : 'live');
    var head = 'A seed line, sown ' + fDate(pk.sowAt) + '.';
    var line;
    if (st.phase === 'seeded') {
      /* finite past, matching the pressed record's transit sentence (editorial audit): it
         has already closed, so say so rather than the present-habitual "staying open …" */
      line = 'It bloomed on the way here — ' + fFull(pk.bloomAt) + ' — and has already closed. Its record can be kept.';
    } else if (st.phase === 'open') {
      line = 'It is open now, until ' + fFull(pk.bloomAt + sp.window) + '.';
    } else {
      line = 'It is ' + B.stageLabel(pk.species, st.stage) + '. It opens ' + fFull(pk.bloomAt) + ' and ' + windowPhrase(pk.species) + '.';
    }
    var odd = new Date(pk.bloomAt).getHours() < 6;
    var html = '<h2 class="sr-only">A seed line arrived</h2><div class="gift-plate">';
    html += plateSVG(bp, st, mode, sp.label + ' — a gift', B.describe(bp, st, sp.label), '', false);
    html += '<div class="under"><p>' + esc(head) + '</p><p>' + esc(line) + '</p>';
    if (odd) html += '<p>This seed keeps its sower’s hours.</p>';
    if (existing) html += '<p>This seed is already in your garden.</p>';
    else html += '<button type="button" class="door" id="take-in">Take it into your garden</button>';
    html += '</div></div>';
    els.giftView.innerHTML = html;
    els.giftView.hidden = false;
    if (!existing) {
      $('take-in').addEventListener('click', function () {
        var p = makePlant(pk.species, pk.seed, pk.sowAt, pk.bloomAt, true);
        p.acceptedAt = now(); /* when it entered your garden — so a bloom that closed in
                                 transit is never charged to you as an absence (deep-thinkers) */
        var okTake = (garden.plants.push(p), saveGarden(garden));
        els.giftView.hidden = true; els.giftView.innerHTML = '';
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        announce('Taken in. ' + openPhrase(p, now()) + (okTake ? '' : ' ' + STORAGE_FAIL_NOTE));
        renderGarden(); focusPlant(p.id);
      });
    }
  }

  /* ---------- foresee: hold-to-look (ADR-009, ADR-017 register) ---------- */
  var foreseeState = null;
  function foreseeShow(p) {
    var li = els.plants.querySelector('li.plot[data-id="' + p.id + '"]');
    if (!li) return;
    var svg = li.querySelector('svg.plant');
    var bp = B.buildBlueprint(p.seed, p.species);
    if (!foreseeState) foreseeState = {};
    if (!foreseeState[p.id]) foreseeState[p.id] = svg.innerHTML;
    var study = B.renderPlant(bp, { phase: 'open', u: 1 }, 'sketch');
    svg.innerHTML = '<title>A drawing, not the bloom</title><g>' + study + '</g>';
    svg.classList.add('study');
    var t = now();
    if (!p.foreseenAt) { p.foreseenAt = t; saveGarden(garden); }
    announce(B.describeStudy(bp));
  }
  function foreseeHide(p) {
    if (foreseeState) delete foreseeState[p.id]; /* unconditional: never keep a stale snapshot */
    var li = els.plants.querySelector('li.plot[data-id="' + p.id + '"]');
    if (!li) return;
    var svg = li.querySelector('svg.plant');
    if (!svg) return;
    svg.classList.remove('study');
    /* re-derive rather than restore: the renderer is pure and cheap (perf audit) */
    refreshCardVisuals(p, now());
    /* the fact, recorded in place, once — no rebuild, no focus theft */
    if (p.foreseenAt && !li.querySelector('.ledger-f')) {
      var led = doc.createElement('p'); led.className = 'ledger ledger-f';
      led.textContent = 'Seen early, ' + fDay(p.foreseenAt) + '.';
      var doors = li.querySelector('.doors');
      if (doors) doors.parentNode.insertBefore(led, doors);
    }
  }

  /* ---------- export / import ---------- */
  function exportGarden() {
    download('pothos-garden.json', 'application/json', JSON.stringify(garden, null, 2));
  }
  function importGarden(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var g = JSON.parse(reader.result);
        if (!g || g.v !== 1 || !Array.isArray(g.plants)) throw new Error('bad');
        var added = 0;
        for (var i = 0; i < g.plants.length; i++) {
          var p = g.plants[i];
          /* reconstruct through makePlant, never trust the file's shape (security audit):
             the id and closeAt are regenerated; only whitelisted facts are copied over */
          if (!p || typeof p.seed !== 'number' || typeof p.sowAt !== 'number' ||
              typeof p.bloomAt !== 'number' || p.bloomAt <= p.sowAt || !B.SPECIES[p.species]) continue;
          var seed = p.seed >>> 0;
          if (findPlant(seed, p.sowAt)) continue;
          var np = makePlant(p.species, seed, p.sowAt, p.bloomAt, !!p.givenIn);
          if (typeof p.witnessedAt === 'number') np.witnessedAt = p.witnessedAt;
          if (typeof p.foreseenAt === 'number') np.foreseenAt = p.foreseenAt;
          /* acceptedAt only on a gift and only if internally coherent (>= sowAt): a doctored
             file cannot mint a transit record its own timeline does not support (vuln audit) */
          if (np.givenIn && typeof p.acceptedAt === 'number' && p.acceptedAt >= p.sowAt) np.acceptedAt = p.acceptedAt;
          garden.plants.push(np); added++;
        }
        if (Array.isArray(g.given)) {
          for (var j = 0; j < g.given.length; j++) {
            var gg = g.given[j];
            if (!gg || typeof gg.sowAt !== 'number' || typeof gg.bloomAt !== 'number' || !B.SPECIES[gg.species]) continue;
            var dup = garden.given.some(function (x) { return x.sowAt === gg.sowAt && x.bloomAt === gg.bloomAt; });
            if (!dup) garden.given.push({ species: gg.species, sowAt: gg.sowAt, bloomAt: gg.bloomAt });
          }
        }
        saveGarden(garden);
        announce('Brought back. ' + (added === 1 ? 'One plant returned.' : added + ' plants returned.'));
        renderGarden();
      } catch (e) { announce('That file is not a garden.'); }
    };
    reader.readAsText(file);
  }

  /* ---------- wiring ---------- */
  function init() {
    els.status = $('status'); els.almanac = $('almanac');
    els.plants = $('plants'); els.empty = $('empty');
    els.pressed = $('pressed'); els.pressedSec = $('pressed-sec');
    els.rehearsalShelf = $('rehearsal-shelf'); els.rehearsalH = $('rehearsal-h');
    els.sowHow = $('sow-how'); els.sowStage = $('sow-stage');
    els.giftView = $('gift-view'); els.givenList = $('given');
    els.soundToggle = $('sound');

    /* sound toggle (persisted; default on; garnish never sole carrier) */
    var soundPref = sGet('pothos.sound.v1');
    E.Audio.enabled = soundPref === null ? true : soundPref === '1';
    updateSoundBtn();
    els.soundToggle.addEventListener('click', function () {
      E.Audio.enabled = !E.Audio.enabled;
      sSet('pothos.sound.v1', E.Audio.enabled ? '1' : '0');
      updateSoundBtn();
    });
    function updateSoundBtn() {
      els.soundToggle.setAttribute('aria-pressed', E.Audio.enabled ? 'true' : 'false');
      els.soundToggle.textContent = 'Sound: ' + (E.Audio.enabled ? 'on' : 'off');
    }

    if (!canStore) revealPrivateNote();

    /* seed dish: hold-to-sow on each seed button */
    doc.querySelectorAll('button.seed').forEach(function (btn) {
      var species = btn.dataset.species;
      var forGift = btn.dataset.gift === '1';
      btn.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        try { btn.setPointerCapture && btn.setPointerCapture(e.pointerId); } catch (x) {}
        holdBegin(btn, species, forGift, e.clientX, e.clientY);
      });
      btn.addEventListener('pointerup', function () { if (hold && hold.el === btn) holdEnd(true); });
      btn.addEventListener('pointercancel', function () { if (hold && hold.el === btn) holdEnd(false); });
      /* a scroll flick that starts on a seed is a scroll, not a sow (playtest, phone seat) */
      btn.addEventListener('pointermove', function (e) {
        if (hold && hold.el === btn && !hold.armed && hold.px !== undefined) {
          var dx = e.clientX - hold.px, dy = e.clientY - hold.py;
          if (dx * dx + dy * dy > 196) holdEnd(false);
        }
      });
      btn.addEventListener('keydown', function (e) {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          if (hold && hold.el === btn && hold.armed) { holdEnd(true); }
          else if (!hold) holdBegin(btn, species, forGift);
        }
        if (e.key === 'Escape' && hold && hold.el === btn) holdEnd(false);
      });
      btn.addEventListener('keyup', function (e) {
        if ((e.key === ' ' || e.key === 'Enter') && hold && hold.el === btn && !hold.armed) holdEnd(true);
      });
      /* the synthetic-click path: screen readers, voice control, and switch systems emit
         clicks, not raw key/pointer events (playtest sr-user, G7). First click arms;
         second lets go. Clicks that follow a real gesture are ignored. */
      btn.addEventListener('click', function () {
        /* an armed hold completes on a DISTINCT activation only: a quick real tap arms via
           pointerup and must not be completed by its own trailing click (reflection,
           visitor seat), while a cross-cancel in this same handler must not block the
           arm that follows it (the audit's armed-seed fix) */
        if (hold && hold.el === btn && hold.armed) {
          if (performance.now() - lastGestureEnd >= 500) holdEnd(true);
          return;
        }
        if (performance.now() - lastGestureEnd < 500) return; /* trailing click of a real gesture */
        /* another seed is held: put it back first (a11y audit, high) */
        if (hold && hold.el !== btn) holdEnd(false);
        if (!hold) {
          holdBegin(btn, species, forGift);
          hold.armed = true;
          btn.setAttribute('data-armed', '1');
          announce('Held. Press again to let go.');
        }
      });
      btn.addEventListener('blur', function () { if (hold && hold.el === btn && !hold.armed) holdEnd(false); });
    });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && hold) holdEnd(false); });
    /* a seed line pasted into an open tab must work (playtest live-driver, About's promise) */
    global.addEventListener('hashchange', function () {
      els.giftView.hidden = true; els.giftView.innerHTML = '';
      handleFragment();
    });

    /* delegated doors */
    doc.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button.door') : null;
      if (!b) return;
      var p = b.dataset.id ? byId(b.dataset.id) : null;
      if (b.classList.contains('ics') && p) download('pothos-' + p.species + '.ics', 'text/calendar', icsFor(p));
      if (b.classList.contains('packet') && p) copyText(packetURL(p), b);
    });
    /* foresee: hold-to-look */
    var lastForeseeGesture = 0;
    doc.addEventListener('pointerdown', function (e) {
      var b = e.target.closest ? e.target.closest('button.foresee') : null;
      if (!b) return;
      var p = byId(b.dataset.id); if (!p) return;
      e.preventDefault();
      foreseeShow(p);
      var up = function () {
        lastForeseeGesture = performance.now();
        foreseeHide(p);
        doc.removeEventListener('pointerup', up); doc.removeEventListener('pointercancel', up);
      };
      doc.addEventListener('pointerup', up); doc.addEventListener('pointercancel', up);
    });
    doc.addEventListener('keydown', function (e) {
      var b = e.target.closest ? e.target.closest('button.foresee') : null;
      if (!b || e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      var p = byId(b.dataset.id); if (!p) return;
      foreseeShow(p);
      var up = function (e2) {
        if (e2.key === 'Enter' || e2.key === ' ') {
          lastForeseeGesture = performance.now();
          foreseeHide(p); doc.removeEventListener('keyup', up);
        }
      };
      doc.addEventListener('keyup', up);
    });
    /* the synthetic-click path for foresee: first click shows the study, second puts it away
       (playtest sr-user: voice-control users could never take the door at all) */
    doc.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button.foresee') : null;
      if (!b) return;
      if (performance.now() - lastForeseeGesture < 500) return;
      var p = byId(b.dataset.id); if (!p) return;
      if (foreseeState && foreseeState[p.id]) foreseeHide(p);
      else foreseeShow(p);
    });

    /* footer: export/import */
    $('export').addEventListener('click', exportGarden);
    $('import').addEventListener('change', function () { if (this.files && this.files[0]) importGarden(this.files[0]); this.value = ''; });

    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) renderGarden(); });
    /* iOS bfcache restores can skip visibilitychange (compat audit) */
    global.addEventListener('pageshow', function (e) { if (e.persisted) renderGarden(); });
    /* cross-tab reconciliation (final-review adversary): if another tab of the same garden writes
       (or clears) storage, reload so this tab's next save cannot clobber the other tab's plants
       with a stale in-memory snapshot. The 'storage' event fires only in the OTHER tabs. */
    global.addEventListener('storage', function (e) {
      if (e.key === GARDEN_KEY || e.key === null) { garden = loadGarden(); renderGarden(); }
    });

    handleFragment();
    renderGarden();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
