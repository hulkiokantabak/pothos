/* POTHOS — evaluation.js
 * The lab bench: renders the variety evidence (full, colored blooms from fixed seeds) with the
 * same pure function the garden uses. This page is the disclosed opt-in door to seeing color
 * without waiting (ADR-013).
 */
(function () {
  'use strict';
  var B = window.POTHOS_BOTANY;
  var list = document.getElementById('variety');
  if (!list || !B) return;

  /* WCAG contrast, computed here so the genome colour floor is MEASURED in the sweep below,
     not hand-typed into the table (round-2 final-panel honesty finding). Matches colorOf's
     full (non-quiet) stroke exactly: hue/sat/light each rounded as toFixed(0) does. */
  function hslRgb(h, s, l) {
    s /= 100; l /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r, g, b;
    if (h < 60) { r = c; g = x; b = 0; } else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; } else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; } else { r = c; g = 0; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function lum(c) { return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]); }
  function contrast(a, b) { var la = lum(a), lb = lum(b), hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05); }
  /* The full-saturation genome stroke only ever renders in 'live' mode (garden blooms + these
     plates); the witnessed pressings on --raise use a LIGHTER quieted colour, so --raise is not
     the floor (a round-2 Tufte catch). The worst case a live bloom faces is the LIGHTEST ground
     the garden actually paints — the h-day hour tint #101410 (pothos.css:30) — since a
     lighter ground lowers a light stroke's contrast. Measure against that. */
  var LIGHTEST_GROUND = [16, 20, 16]; /* #101410, the h-day tint — lightest of the --ground family */
  var seeds = [];
  for (var i = 0; i < 24; i++) seeds.push((((i * 40503 + 7) * 2654435761) ^ (i << 9)) >>> 0);
  var speciesCycle = ['day', 'week', 'season', 'day'];
  var html = '';
  for (var j = 0; j < seeds.length; j++) {
    var sp = speciesCycle[j % 4];
    var bp = B.buildBlueprint(seeds[j], sp);
    var inner = B.renderPlant(bp, { phase: 'open', u: 1 }, 'live');
    var desc = B.describe(bp, { phase: 'open', u: 1 }, B.SPECIES[sp].label);
    html += '<li><figure><svg viewBox="0 0 200 260" role="img" aria-label="' +
      desc.replace(/"/g, '&quot;') + '">' + inner + '</svg>' +
      '<figcaption>' + bp.bloomFamily + ' · ' + bp.band + '</figcaption></figure></li>';
  }
  list.innerHTML = html;

  /* the live census (visual-arts panel, Tufte): measurement replaces assertion. Sweeps the
     same pure botany.js over every seed in the visitor's own browser and prints fresh counts
     with the composition stated — computation, not animation; ADR-013 holds (no color needed
     to count geometry); nothing is stored, nothing is sent. */
  var btn = document.getElementById('census-run');
  var out = document.getElementById('census-out');
  if (btn && out) {
    btn.addEventListener('click', function () {
      btn.disabled = true; out.hidden = false;
      /* chunk the sweep across frames so a 4,000-render census never freezes a weak phone's
         main thread (round-2 compatibility audit); the counts are identical either way */
      var SPECIES = ['day', 'week', 'season', 'rehearsal'];
      var PER = 1000, CHUNK = 250, n = 0, degenerate = 0, mismatch = 0, si = 0, ii = 0;
      var fams = {}, bands = {}, hueFloor = Infinity;
      var COUNTW = { three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
      function step() {
        var done = 0;
        while (si < SPECIES.length && done < CHUNK) {
          var seed = (((ii * 2654435761) ^ (ii << 13) ^ (si * 2654435761)) >>> 0);
          var bp = B.buildBlueprint(seed, SPECIES[si]);
          fams[bp.bloomFamily] = (fams[bp.bloomFamily] || 0) + 1;
          bands[bp.band] = (bands[bp.band] || 0) + 1;
          var cf = contrast(hslRgb(Math.round(bp.hue), Math.round(bp.sat), Math.round(bp.light)), LIGHTEST_GROUND);
          if (cf < hueFloor) hueFloor = cf;
          var m = B.renderPlant(bp, { phase: 'open', u: 1 }, 'live');
          n++;
          if (m.indexOf('NaN') >= 0 || m.length < 200) degenerate++;
          else if (bp.bloomFamily === 'corolla' || bp.bloomFamily === 'spike' || bp.bloomFamily === 'umbel') {
            var d = B.describe(bp, { phase: 'open', u: 1 }, 'Day'), ok = false;
            for (var w in COUNTW) { if (d.indexOf(w) >= 0 && COUNTW[w] === bp.petalCount) { ok = true; break; } }
            if (!ok && d.indexOf(' ' + bp.petalCount + ' ') >= 0) ok = true; /* counts >12 as digits */
            if (!ok) mismatch++;
          }
          done++; ii++;
          if (ii >= PER) { ii = 0; si++; }
        }
        if (si < SPECIES.length) {
          out.textContent = 'Running… ' + n.toLocaleString() + ' of ' + (PER * SPECIES.length).toLocaleString();
          setTimeout(step, 0);
          return;
        }
        function rows(o) {
          var keys = Object.keys(o).sort(), r = '';
          for (var k = 0; k < keys.length; k++) r += '<tr><td>' + keys[k] + '</td><td>' + o[keys[k]] + '</td></tr>';
          return r;
        }
        out.innerHTML =
          '<p>' + n.toLocaleString() + ' plants swept — ' + PER.toLocaleString() + ' seeds × ' +
          SPECIES.length + ' species, rendered at open. <strong>' + degenerate + '</strong> degenerate (empty / off-frame / NaN); <strong>' +
          mismatch + '</strong> where the sentence\'s petal count disagreed with the drawing. ' +
          'Lowest bloom-colour contrast in this sweep: <strong>' + hueFloor.toFixed(2) + ' : 1</strong> ' +
          'against the lightest ground the garden paints (non-text needs 3; the darkest reachable genome, deep-rose, is 4.24).</p>' +
          '<div class="census-tables"><table><tr><th>bloom family</th><th>count</th></tr>' + rows(fams) + '</table>' +
          '<table><tr><th>colour band</th><th>count</th></tr>' + rows(bands) + '</table></div>';
        btn.textContent = 'Run it again';
        btn.disabled = false;
      }
      setTimeout(step, 0);
    });
  }
})();
