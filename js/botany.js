/* POTHOS — botany.js
 * The pure heart. Everything here is a deterministic function of
 * (seed, species, sowAt, bloomAt, now) — no storage, no clock reads, no visitor facts.
 * The desire-fidelity audit greps this file for
 * localStorage|witnessedAt|foreseenAt|givenIn|acceptedAt|Math.random|Date.now|performance.now —
 * all must be absent (INV-01, INV-02). (describePressed receives a caller-supplied
 * "what you saw" mode string; it never reads the facts itself.)
 *
 * seed (uint32): top 6 bits = hold bucket (monotonic from hold duration — the one legible,
 * disclosed gene: a longer hold sows a taller plant); low 26 bits = millisecond scraps of
 * the release instant, finer where the browser allows ("the grain the moment chose").
 * Genome mapping version gv=1, frozen.
 */
(function (global) {
  'use strict';

  /* ---------- species (all times fixed ms; ADR-014) ---------- */
  var SPECIES = {
    rehearsal: { wait: 150000,      window: 90000,     label: 'Rehearsal' },
    day:       { wait: 86400000,    window: 21600000,  label: 'Day' },
    week:      { wait: 604800000,   window: 86400000,  label: 'Week' },
    season:    { wait: 7776000000,  window: 259200000, label: 'Season' }
  };
  var STAGE_COUNT = { rehearsal: 6, day: 6, week: 8, season: 12 };

  /* ---------- deterministic PRNG (mulberry32) ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* the sowing gesture -> seed. holdMs clamped 150..2500 (nothing is grindable);
   * fine = sub-ms scraps of the release instant. */
  function makeSeed(holdMs, fineSource) {
    var h = Math.max(150, Math.min(2500, holdMs));
    var norm = (h - 150) / 2350;
    var eased = 1 - (1 - norm) * (1 - norm); /* easeOutQuad */
    var bucket = Math.min(63, Math.floor(eased * 64));
    var fine = (fineSource >>> 0) & 0x3FFFFFF; /* 26 bits */
    return (((bucket << 26) | fine) >>> 0);
  }

  /* ---------- blueprint: seed -> named genes, ONE fixed draw order (INV: versioned) ---------- */
  var HUE_BANDS = [
    /* name, hue range, sat range, light range, color phrases per light tercile */
    { name: 'moon-white',  h: [48, 60],   s: [8, 18],  l: [78, 88],
      phrase: ['moonlit chalk', 'a pale chalk-white', 'a warm chalk-white'] },
    { name: 'dusk-violet', h: [265, 290], s: [30, 45], l: [62, 74],
      phrase: ['the deep violet of last light', 'the color of late dusk', 'a pale washed violet'] },
    { name: 'deep-rose',   h: [332, 350], s: [35, 55], l: [55, 66],
      phrase: ['a dark rose, nearly wine', 'a dark rose', 'a quiet rose'] },
    { name: 'glass-green', h: [158, 176], s: [25, 40], l: [66, 76],
      phrase: ['a deep glass-green', 'a pale glass-green', 'a pale sea-glass green'] },
    { name: 'blue-hour',   h: [214, 236], s: [30, 48], l: [64, 75],
      phrase: ['the blue of the hour after sunset', 'a dusk blue', 'a pale evening blue'] }
  ];
  var LEAF_FAMILIES = ['lanceolate', 'ovate', 'linear', 'lobed', 'needle'];
  var BLOOM_FAMILIES = ['corolla', 'iris', 'bell', 'spike', 'umbel'];

  function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }
  function range(r, a, b) { return a + r() * (b - a); }

  function buildBlueprint(seed, species) {
    var bucket = (seed >>> 26) & 63;
    var r = mulberry32((seed ^ 0x9E3779B9) >>> 0);
    /* FIXED DRAW ORDER — never reorder without a genome-version bump (gv=1 frozen). */
    var stemLean = range(r, -0.10, 0.10);                       /* 1 */
    var stemC1 = range(r, -0.07, 0.07);                          /* 2 */
    var stemC2 = range(r, -0.07, 0.07);                          /* 3 */
    var nodeCount = 3 + Math.floor(r() * 4);                     /* 4: 3..6 */
    var rhythm = range(r, 0.8, 1.4);                             /* 5 */
    var leafFamily = pick(r, LEAF_FAMILIES);                     /* 6 */
    var leafLen = range(r, 0.11, 0.20);                          /* 7 */
    var leafAspect = range(r, 0.22, 0.45);                       /* 8 */
    var leafAngle = range(r, 0.55, 1.05);                        /* 9 */
    var leafCurl = range(r, 0, 0.30);                            /* 10 */
    /* 11: bloom family — weighted; Season leans to many-floret forms (character, not rank).
       Umbel is the remainder (the final else); its weight is 1 minus the rest, so no
       explicit wUmbel is read — the panel's dead-variable catch (gv=1 frozen; weights
       unchanged so no seed's bloom shifts). */
    var wSpike = species === 'season' ? 0.24 : 0.16;
    var wCorolla = species === 'season' ? 0.18 : 0.30;
    var roll = r(), bloomFamily;
    if (roll < wCorolla) bloomFamily = 'corolla';
    else if (roll < wCorolla + 0.20) bloomFamily = 'iris';
    else if (roll < wCorolla + 0.20 + 0.18) bloomFamily = 'bell';
    else if (roll < wCorolla + 0.20 + 0.18 + wSpike) bloomFamily = 'spike';
    else bloomFamily = 'umbel';
    var petalCount;                                              /* 12 */
    if (bloomFamily === 'corolla') petalCount = [5, 5, 6, 6, 7, 7, 8, 9][Math.floor(r() * 8)];
    else if (bloomFamily === 'iris') petalCount = 6;
    else if (bloomFamily === 'bell') petalCount = 5;
    else if (bloomFamily === 'spike') petalCount = 12 + Math.floor(r() * 13);
    else petalCount = 5 + Math.floor(r() * 5);                   /* umbel rays */
    var petalLen = range(r, 0.11, 0.19);                         /* 13 */
    var petalWidth = range(r, 0.30, 0.62);                       /* 14 */
    var petalTip = r();                                          /* 15: rounded->pointed */
    var petalRecurve = range(r, 0, 0.35);                        /* 16 */
    var bloomTilt = range(r, -0.35, 0.35);                       /* 17 */
    var band = pick(r, HUE_BANDS);                               /* 18 */
    var hue = range(r, band.h[0], band.h[1]);                    /* 19 */
    var sat = range(r, band.s[0], band.s[1]);                    /* 20 */
    var light = range(r, band.l[0], band.l[1]);                  /* 21 */
    var jitterSeed = Math.floor(r() * 4294967296);               /* 22: per-petal jitter stream */
    var pressTilt = range(r, -4, 4);                             /* 23: degrees, pressing tilt */
    return {
      gv: 1, seed: seed >>> 0, species: species,
      stature: 0.55 + 0.30 * (bucket / 63),  /* the legible gene */
      stemLean: stemLean, stemC1: stemC1, stemC2: stemC2,
      nodeCount: nodeCount, rhythm: rhythm,
      leafFamily: leafFamily, leafLen: leafLen, leafAspect: leafAspect,
      leafAngle: leafAngle, leafCurl: leafCurl,
      bloomFamily: bloomFamily, petalCount: petalCount, petalLen: petalLen,
      petalWidth: petalWidth, petalTip: petalTip, petalRecurve: petalRecurve,
      bloomTilt: bloomTilt,
      band: band.name, bandPhrases: band.phrase, hue: hue, sat: sat, light: light,
      jitterSeed: jitterSeed, pressTilt: pressTilt
    };
  }

  function colorOf(bp, quiet) {
    var s = quiet ? bp.sat * 0.5 : bp.sat;
    var l = quiet ? Math.min(88, bp.light + 6) : bp.light;
    return 'hsl(' + bp.hue.toFixed(0) + ' ' + s.toFixed(0) + '% ' + l.toFixed(0) + '%)';
  }

  /* ---------- growth state: pure f(species, sowAt, bloomAt, now) ---------- */
  /* phases: sown -> growing (staged) -> open -> seeded */
  function stateAt(species, sowAt, bloomAt, now) {
    var sp = SPECIES[species];
    var closeAt = bloomAt + sp.window;
    if (now >= closeAt) return { phase: 'seeded', u: 1, stage: STAGE_COUNT[species], closeAt: closeAt };
    if (now >= bloomAt) return { phase: 'open', u: 1, stage: STAGE_COUNT[species], closeAt: closeAt };
    var u = (now - sowAt) / (bloomAt - sowAt);
    if (u < 0) u = 0; /* a gift from a fast clock: it begins now */
    var N = STAGE_COUNT[species];
    var stage = Math.min(N - 1, Math.floor(u * N));
    return { phase: 'growing', u: u, uQ: stage / N, stage: stage, stageCount: N, closeAt: closeAt };
  }

  /* stage label from quantized position (shared ladder, scaled per species) */
  function stageLabel(species, stage) {
    var N = STAGE_COUNT[species];
    var f = stage / N;
    if (f < 0.13) return 'sown';
    if (f < 0.3) return 'germinating';
    if (f < 0.45) return 'a sprout';
    if (f < 0.62) return 'first leaves';
    if (f < 0.78) return 'leafing';
    if (f < 0.9) return 'in bud';
    return 'the bud swelling';
  }

  /* derived growth notes — computed, never stored (ADR-019) */
  function growthNotes(species, sowAt, bloomAt, now) {
    var N = STAGE_COUNT[species];
    var notes = [];
    var last = '';
    for (var i = 0; i < N; i++) {
      var t = sowAt + (i / N) * (bloomAt - sowAt);
      if (t > now) break;
      var lab = stageLabel(species, i);
      if (lab === last) continue; /* only stage-name changes become notes */
      last = lab;
      notes.push({ label: lab, at: t });
    }
    return notes;
  }

  /* ---------- geometry helpers ---------- */
  function fmt(n) { return (Math.round(n * 100) / 100).toString(); }
  /* cubic bezier point + tangent (de Casteljau) */
  function bez(p0, p1, p2, p3, t) {
    var mt = 1 - t;
    var x = mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0];
    var y = mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1];
    var dx = 3 * mt * mt * (p1[0] - p0[0]) + 6 * mt * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
    var dy = 3 * mt * mt * (p1[1] - p0[1]) + 6 * mt * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: x, y: y, tx: dx / len, ty: dy / len };
  }
  /* truncate a cubic at t (de Casteljau split), return path string from p0 */
  function bezSplitPath(p0, p1, p2, p3, t) {
    var a = lerpP(p0, p1, t), b = lerpP(p1, p2, t), c = lerpP(p2, p3, t);
    var d = lerpP(a, b, t), e = lerpP(b, c, t);
    var f = lerpP(d, e, t);
    return 'M ' + fmt(p0[0]) + ' ' + fmt(p0[1]) +
      ' C ' + fmt(a[0]) + ' ' + fmt(a[1]) + ', ' + fmt(d[0]) + ' ' + fmt(d[1]) + ', ' + fmt(f[0]) + ' ' + fmt(f[1]);
  }
  function lerpP(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }

  /* leaf path at stem point, side +-1 */
  function leafPath(pt, side, bp, scale) {
    var L = bp.leafLen * 170 * scale;
    var W = L * bp.leafAspect;
    var nx = pt.x, ny = pt.y;
    /* midrib direction */
    var mx = side * Math.sin(bp.leafAngle), my = -Math.cos(bp.leafAngle) * 0.55;
    var norm = Math.sqrt(mx * mx + my * my) || 1; mx /= norm; my /= norm;
    var tx = nx + mx * L, ty = ny + my * L + bp.leafCurl * L * 0.5;
    /* perpendicular for width */
    var px = -my, py = mx;
    if (bp.leafFamily === 'needle') {
      var t2x = nx + mx * L * 0.8, t2y = ny + my * L * 0.8 + 3;
      return '<path d="M ' + fmt(nx) + ' ' + fmt(ny) + ' Q ' + fmt(nx + mx * L * 0.5 + px * 1.5) + ' ' + fmt(ny + my * L * 0.5 + py * 1.5) + ' ' + fmt(tx) + ' ' + fmt(ty) + '" />' +
             '<path d="M ' + fmt(nx) + ' ' + fmt(ny) + ' Q ' + fmt(nx + mx * L * 0.4 - px * 1.5) + ' ' + fmt(ny + my * L * 0.4 - py * 1.5) + ' ' + fmt(t2x) + ' ' + fmt(t2y) + '" />';
    }
    if (bp.leafFamily === 'lobed') {
      var out = '';
      for (var k = -1; k <= 1; k++) {
        var la = bp.leafAngle + k * 0.5;
        var lmx = side * Math.sin(la), lmy = -Math.cos(la) * 0.55;
        var ln = Math.sqrt(lmx * lmx + lmy * lmy) || 1; lmx /= ln; lmy /= ln;
        var ll = L * (k === 0 ? 1 : 0.62);
        var ltx = nx + lmx * ll, lty = ny + lmy * ll;
        var lpx = -lmy, lpy = lmx;
        out += '<path d="M ' + fmt(nx) + ' ' + fmt(ny) +
          ' Q ' + fmt(nx + lmx * ll * 0.5 + lpx * W * 0.5) + ' ' + fmt(ny + lmy * ll * 0.5 + lpy * W * 0.5) + ' ' + fmt(ltx) + ' ' + fmt(lty) +
          ' Q ' + fmt(nx + lmx * ll * 0.5 - lpx * W * 0.5) + ' ' + fmt(ny + lmy * ll * 0.5 - lpy * W * 0.5) + ' ' + fmt(nx) + ' ' + fmt(ny) + '" />';
      }
      return out;
    }
    var wf = bp.leafFamily === 'linear' ? 0.35 : (bp.leafFamily === 'ovate' ? 1.25 : 1.0);
    return '<path d="M ' + fmt(nx) + ' ' + fmt(ny) +
      ' Q ' + fmt(nx + mx * L * 0.5 + px * W * wf * 0.6) + ' ' + fmt(ny + my * L * 0.5 + py * W * wf * 0.6) + ' ' + fmt(tx) + ' ' + fmt(ty) +
      ' Q ' + fmt(nx + mx * L * 0.5 - px * W * wf * 0.4) + ' ' + fmt(ny + my * L * 0.5 - py * W * wf * 0.4) + ' ' + fmt(nx) + ' ' + fmt(ny) + '" />';
  }

  /* deterministic per-petal jitter (anti-mandala; council NOT-KALÓN rule) */
  function jitter(bp, i) {
    var r = mulberry32((bp.jitterSeed + i * 2654435761) >>> 0);
    return { len: 0.96 + r() * 0.08, ang: (r() - 0.5) * 0.10 };
  }

  /* bloom in ELEVATION view at apex; openF 0..1 (bud->open) */
  function bloomPaths(bp, apex, openF, colored, hue) {
    var L = bp.petalLen * 170;
    var out = '';
    var fill = colored ? ' fill="' + hue + '" fill-opacity="0.16"' : ' fill="none"';
    var stroke = colored ? ' stroke="' + hue + '"' : '';
    var tilt = bp.bloomTilt;
    function pt(ang, len) {
      return [apex.x + Math.sin(ang + tilt) * len, apex.y - Math.cos(ang + tilt) * len];
    }
    if (bp.bloomFamily === 'corolla') {
      /* fanned profile: petals across an arc facing up-and-outward, never a face-on mandala */
      var n = bp.petalCount;
      var arc = 2.4; /* radians of fan */
      for (var i = 0; i < n; i++) {
        var j = jitter(bp, i);
        var a = (-arc / 2) + arc * (i / (n - 1)) + j.ang;
        var len = L * j.len * (1 - bp.petalRecurve * Math.abs(a) / arc) * openF;
        var tipP = pt(a, len);
        var w = L * bp.petalWidth * 0.4 * openF;
        var m = pt(a, len * 0.55);
        var pxp = Math.cos(a + tilt), pyp = Math.sin(a + tilt);
        out += '<path' + fill + stroke + ' d="M ' + fmt(apex.x) + ' ' + fmt(apex.y) +
          ' Q ' + fmt(m[0] + pxp * w) + ' ' + fmt(m[1] + pyp * w) + ' ' + fmt(tipP[0]) + ' ' + fmt(tipP[1]) +
          ' Q ' + fmt(m[0] - pxp * w * (0.5 + bp.petalTip * 0.5)) + ' ' + fmt(m[1] - pyp * w * (0.5 + bp.petalTip * 0.5)) + ' ' + fmt(apex.x) + ' ' + fmt(apex.y) + '" />';
      }
    } else if (bp.bloomFamily === 'bell') {
      /* a hanging bell: handedness follows the stem's lean; the mouth flares with petalTip;
         the whole bloom takes its tilt (playtest gen-art seat: character per seed) */
      var hand = bp.stemLean >= 0 ? 1 : -1;
      var bl = L * 1.1 * openF, bw = L * bp.petalWidth * (0.7 + 0.4 * openF);
      var flare = 1 + bp.petalTip * 0.55;
      var px2 = apex.x + hand * 8, py2 = apex.y + 4;
      var tiltDeg = (bp.bloomTilt * 40).toFixed(1);
      out += '<g transform="rotate(' + tiltDeg + ' ' + fmt(px2) + ' ' + fmt(py2) + ')">';
      out += '<path fill="none" d="M ' + fmt(apex.x) + ' ' + fmt(apex.y) + ' Q ' + fmt(apex.x + hand * 7) + ' ' + fmt(apex.y - 2) + ' ' + fmt(px2) + ' ' + fmt(py2) + '" />';
      out += '<path' + fill + stroke + ' d="M ' + fmt(px2) + ' ' + fmt(py2) +
        ' C ' + fmt(px2 - bw) + ' ' + fmt(py2 + bl * 0.35) + ', ' + fmt(px2 - bw * 0.8) + ' ' + fmt(py2 + bl) + ', ' + fmt(px2 - bw * flare) + ' ' + fmt(py2 + bl) +
        ' M ' + fmt(px2) + ' ' + fmt(py2) +
        ' C ' + fmt(px2 + bw) + ' ' + fmt(py2 + bl * 0.35) + ', ' + fmt(px2 + bw * 0.8) + ' ' + fmt(py2 + bl) + ', ' + fmt(px2 + bw * flare) + ' ' + fmt(py2 + bl) +
        ' M ' + fmt(px2 - bw * flare) + ' ' + fmt(py2 + bl) + ' Q ' + fmt(px2) + ' ' + fmt(py2 + bl + (3 + bp.petalTip * 4) * openF) + ' ' + fmt(px2 + bw * flare) + ' ' + fmt(py2 + bl) + '" />';
      /* the clapper: one short stroke past the mouth */
      out += '<path fill="none" d="M ' + fmt(px2) + ' ' + fmt(py2 + bl * 0.55) + ' l 0 ' + fmt(bl * 0.5 + 2) + '" />';
      out += '</g>';
    } else if (bp.bloomFamily === 'spike') {
      /* micro-florets on alternating pedicels, the column scaled to the plant
         (playtest gen-art seat: the most-weighted Season family must be worth its wait) */
      var n2 = bp.petalCount;
      var colH = (Math.min(52, 20 + bp.petalLen * 170 * 1.1)) * openF + 6;
      for (var s = 0; s < n2; s++) {
        var f = n2 > 1 ? s / (n2 - 1) : 0;
        var j2 = jitter(bp, s);
        var side = (s % 2 === 0) ? -1 : 1;
        var y = apex.y + colH * (1 - f);
        var ped = (3.2 + j2.len * 3.5) * openF;
        var fx = apex.x + side * ped;
        out += '<path fill="none" d="M ' + fmt(apex.x) + ' ' + fmt(y) + ' Q ' + fmt(apex.x + side * ped * 0.6) + ' ' + fmt(y - 1) + ' ' + fmt(fx) + ' ' + fmt(y - 2) + '" />';
        var fl = (2.2 + bp.petalWidth * 2.8) * j2.len * openF;
        for (var a3 = -1; a3 <= 1; a3++) {
          var aa = side * 0.5 + a3 * 0.55 + j2.ang;
          out += '<path' + fill + stroke + ' d="M ' + fmt(fx) + ' ' + fmt(y - 2) + ' l ' + fmt(Math.sin(aa) * fl) + ' ' + fmt(-Math.cos(aa) * fl) + '" />';
        }
      }
    } else if (bp.bloomFamily === 'umbel') {
      var rays = bp.petalCount;
      for (var u2 = 0; u2 < rays; u2++) {
        var j3 = jitter(bp, u2);
        var a2 = -1.1 + 2.2 * (u2 / (rays - 1)) + j3.ang;
        var len2 = L * 1.05 * j3.len * openF;
        var e = pt(a2, len2);
        out += '<path fill="none" d="M ' + fmt(apex.x) + ' ' + fmt(apex.y) + ' Q ' + fmt((apex.x + e[0]) / 2 + 2) + ' ' + fmt((apex.y + e[1]) / 2) + ' ' + fmt(e[0]) + ' ' + fmt(e[1]) + '" />';
        out += '<circle' + fill + stroke + ' cx="' + fmt(e[0]) + '" cy="' + fmt(e[1]) + '" r="' + fmt(2.1 * openF + 0.5) + '" />';
      }
    } else { /* iris */
      var upl = L * 1.05 * openF, dnl = L * 0.85 * openF, w2 = L * bp.petalWidth * 0.35 * openF;
      var angsUp = [-0.45, 0, 0.45], angsDn = [-0.9, 0.9];
      for (var q = 0; q < angsUp.length; q++) {
        var jq = jitter(bp, q);
        var aU = angsUp[q] + jq.ang;
        var tU = pt(aU, upl * jq.len);
        var mU = pt(aU, upl * 0.5);
        var pxu = Math.cos(aU + tilt), pyu = Math.sin(aU + tilt);
        out += '<path' + fill + stroke + ' d="M ' + fmt(apex.x) + ' ' + fmt(apex.y) +
          ' Q ' + fmt(mU[0] + pxu * w2) + ' ' + fmt(mU[1] + pyu * w2) + ' ' + fmt(tU[0]) + ' ' + fmt(tU[1]) +
          ' Q ' + fmt(mU[0] - pxu * w2) + ' ' + fmt(mU[1] - pyu * w2) + ' ' + fmt(apex.x) + ' ' + fmt(apex.y) + '" />';
      }
      for (var q2 = 0; q2 < angsDn.length; q2++) {
        var jq2 = jitter(bp, q2 + 3);
        var side2 = angsDn[q2] > 0 ? 1 : -1;
        var ex = apex.x + side2 * dnl * 0.75 * jq2.len, ey = apex.y + dnl * 0.6;
        out += '<path' + fill + stroke + ' d="M ' + fmt(apex.x) + ' ' + fmt(apex.y) +
          ' C ' + fmt(apex.x + side2 * dnl * 0.5) + ' ' + fmt(apex.y - 2) + ', ' + fmt(ex + side2 * 3) + ' ' + fmt(ey - dnl * 0.3) + ', ' + fmt(ex) + ' ' + fmt(ey) +
          ' C ' + fmt(ex - side2 * w2 * 1.6) + ' ' + fmt(ey - dnl * 0.28) + ', ' + fmt(apex.x + side2 * dnl * 0.22) + ' ' + fmt(apex.y + 3) + ', ' + fmt(apex.x) + ' ' + fmt(apex.y) + '" />';
      }
    }
    return out;
  }

  /* the seed-head (gone-to-seed): silvered forms, never rot */
  function seedheadPaths(bp, apex) {
    var out = '', L = bp.petalLen * 170;
    if (bp.bloomFamily === 'corolla') {
      var rays = 22;
      for (var i = 0; i < rays; i++) {
        var a = (Math.PI * 2 * i) / rays;
        /* an orb of hairline rays — drawn in profile it reads as a globe seed-head */
        out += '<line x1="' + fmt(apex.x) + '" y1="' + fmt(apex.y) + '" x2="' + fmt(apex.x + Math.cos(a) * L * 0.7) + '" y2="' + fmt(apex.y + Math.sin(a) * L * 0.7) + '" />';
        out += '<circle fill="none" cx="' + fmt(apex.x + Math.cos(a) * L * 0.7) + '" cy="' + fmt(apex.y + Math.sin(a) * L * 0.7) + '" r="0.7" />';
      }
    } else if (bp.bloomFamily === 'bell') {
      out += '<path fill="none" d="M ' + fmt(apex.x) + ' ' + fmt(apex.y) + ' q 7 2 8 6" />';
      out += '<ellipse fill="none" cx="' + fmt(apex.x + 8) + '" cy="' + fmt(apex.y + 12) + '" rx="3.4" ry="6" />';
    } else if (bp.bloomFamily === 'spike') {
      for (var s = 0; s < 8; s++) {
        var y = apex.y + 30 - s * 4.2;
        out += '<rect fill="none" x="' + fmt(apex.x - 1.6) + '" y="' + fmt(y) + '" width="3.2" height="2.6" />';
      }
    } else if (bp.bloomFamily === 'umbel') {
      var rays2 = bp.petalCount;
      for (var u = 0; u < rays2; u++) {
        var a2 = -1.1 + 2.2 * (u / (rays2 - 1));
        var ex = apex.x + Math.sin(a2) * L, ey = apex.y - Math.cos(a2) * L;
        out += '<line x1="' + fmt(apex.x) + '" y1="' + fmt(apex.y) + '" x2="' + fmt(ex) + '" y2="' + fmt(ey) + '" />';
      }
    } else {
      for (var p = -1; p <= 1; p++) {
        out += '<ellipse fill="none" cx="' + fmt(apex.x + p * 4) + '" cy="' + fmt(apex.y - 6) + '" rx="2" ry="7" transform="rotate(' + (p * 12) + ' ' + fmt(apex.x + p * 4) + ' ' + fmt(apex.y - 6) + ')" />';
      }
    }
    return out;
  }

  /* ---------- the renderer: one pure draw for every surface ----------
   * mode: 'live' | 'sketch' (rehearsal + foresee study) | 'pressed' (witnessed)
   *       | 'pressed-study' (missed-but-foreseen) | 'pressed-unseen' (seed-head record)
   * Returns inner SVG markup for a 200x260 viewBox; soil line at y=244.
   */
  function renderPlant(bp, state, mode) {
    var H = bp.stature * 170;
    var baseX = 100, baseY = 244;
    var p0 = [baseX, baseY];
    var p1 = [baseX + bp.stemC1 * 170, baseY - H * 0.35];
    var p2 = [baseX + bp.stemC2 * 170 + bp.stemLean * 60, baseY - H * 0.7];
    var p3 = [baseX + bp.stemLean * 170, baseY - H];
    var colored = mode === 'live' || mode === 'pressed';
    var quiet = mode === 'pressed';
    var hue = colorOf(bp, quiet);
    var out = '';

    if (mode === 'pressed-unseen') {
      /* the record of what remained: stem + the seed-head, ink only */
      var apexU = bez(p0, p1, p2, p3, 1);
      out += '<path fill="none" d="' + bezSplitPath(p0, p1, p2, p3, 1) + '" />';
      out += seedheadPaths(bp, apexU);
      return out;
    }

    var phase = state.phase;
    var growF; /* how much of the plant exists */
    if (phase === 'growing') growF = state.uQ !== undefined ? state.uQ : state.u;
    else growF = 1;

    /* stem: revealed by growth (seed mound below ground line at growF 0). The stem tapers —
       thicker at the soil, finer toward the apex, the way a real stem carries its own weight
       (da Vinci's craft note). Two wider overlays on the lower stem give the taper without
       leaving the group's stroke color, so forced-colors and the light-mode floor still hold. */
    var stemF = Math.max(0.06, Math.min(1, growF / 0.78));
    var base = Math.min(stemF, 0.36), mid = Math.min(stemF, 0.66);
    out += '<path fill="none" stroke-width="2.1" d="' + bezSplitPath(p0, p1, p2, p3, base) + '" />';
    out += '<path fill="none" stroke-width="1.6" d="' + bezSplitPath(p0, p1, p2, p3, mid) + '" />';
    out += '<path fill="none" d="' + bezSplitPath(p0, p1, p2, p3, stemF) + '" />';

    /* seed mound at the base, always */
    out += '<circle fill="none" cx="' + fmt(baseX) + '" cy="' + fmt(baseY) + '" r="2.2" />';

    /* leaves: node i appears when growF passes its threshold */
    if (growF > 0.30) {
      for (var i = 0; i < bp.nodeCount; i++) {
        var fi = 0.30 + 0.48 * Math.pow(i / Math.max(1, bp.nodeCount - 1), bp.rhythm);
        if (growF < fi + 0.06) continue;
        var stemT = Math.min(stemF, fi / 0.78);
        var ptOn = bez(p0, p1, p2, p3, stemT * (0.35 + 0.6 * (i / Math.max(1, bp.nodeCount - 1))));
        var scale = Math.min(1, (growF - fi) / 0.15);
        out += leafPath(ptOn, i % 2 === 0 ? -1 : 1, bp, scale);
      }
    }

    var apex = bez(p0, p1, p2, p3, stemF);
    if (phase === 'growing') {
      if (growF > 0.80) {
        /* the bud: swells with growth; a seam of the hue in the LAST stage, live mode.
           Gate on the stage index, not a raw fraction: every species' final growing stage
           is (N-1)/N — 0.83 for Day, 0.88 for Week, 0.92 for Season — so a >=0.9 threshold
           only ever fired for Season. Keying to the last stage makes the disclosed seam
           reachable for all three real species (game-masters + visual-arts panels). */
        var budR = 2 + (growF - 0.80) / 0.20 * 4.5;
        out += '<ellipse fill="none" cx="' + fmt(apex.x) + '" cy="' + fmt(apex.y - budR * 0.6) + '" rx="' + fmt(budR * 0.62) + '" ry="' + fmt(budR) + '" />';
        var lastStage = state.stageCount !== undefined && state.stage === state.stageCount - 1;
        if (lastStage && mode === 'live') {
          out += '<path stroke="' + hue + '" stroke-opacity="0.6" fill="none" d="M ' + fmt(apex.x) + ' ' + fmt(apex.y - budR * 1.55) + ' q 1.2 1.4 0 2.8" />';
        }
      }
    } else if (phase === 'open') {
      /* openF: the ceremony parameter — a visitor present at opensAt watches this play 0→1 */
      var openF = state.openF === undefined ? 1 : Math.max(0.1, Math.min(1, state.openF));
      out += bloomPaths(bp, apex, openF, colored, hue);
    } else if (phase === 'seeded') {
      out += seedheadPaths(bp, apex);
    }
    if (mode === 'pressed' || mode === 'pressed-study') {
      /* pressing tilt is applied by the caller via transform on the group */
    }
    return out;
  }

  /* ---------- the describer: same blueprint, zero randomness (INV: sentence==picture) ---------- */
  function countWord(n) {
    var words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
    return n < words.length ? words[n] : String(n);
  }
  function colorPhrase(bp) {
    var terc = bp.light < (66) ? 0 : (bp.light < 76 ? 1 : 2);
    return bp.bandPhrases[terc];
  }
  function petalAdj(bp) {
    var a = [];
    a.push(bp.petalWidth > 0.48 ? 'broad' : 'narrow');
    if (bp.petalTip > 0.62) a.push('tapering');
    else if (bp.petalTip < 0.3) a.push('rounded');
    if (bp.petalRecurve > 0.24) a.push('curled back');
    return a.join(', ');
  }
  function statureWord(bp) {
    return bp.stature < 0.65 ? 'low' : (bp.stature < 0.76 ? 'of middle height' : 'tall');
  }
  function bearingWord(bp) {
    var lean = Math.abs(bp.stemLean);
    return lean < 0.03 ? 'upright' : (lean < 0.07 ? 'leaning a little to one side' : 'arched to one side');
  }
  /* the bloom's form, one clause; tense: 'future' | 'present' | 'past' */
  function bloomClause(bp, tense) {
    var v = tense === 'future' ? 'will open as' : (tense === 'present' ? 'is open:' : 'opened as');
    var c = colorPhrase(bp);
    if (bp.bloomFamily === 'corolla') {
      return v + ' ' + countWord(bp.petalCount) + ' ' + petalAdj(bp) + ' petals, ' + c;
    }
    if (bp.bloomFamily === 'iris') {
      return v + ' an iris form — three petals standing, two falling — ' + c;
    }
    if (bp.bloomFamily === 'bell') {
      return v + ' a single hanging bell, ' + c;
    }
    if (bp.bloomFamily === 'spike') {
      return v + ' a spike of ' + countWord(bp.petalCount) + ' small florets, ' + c;
    }
    return v + ' an umbel of ' + countWord(bp.petalCount) + ' rays, each ending in a small floret, ' + c;
  }
  /* full state sentence for SR + captions. dates supplied by the caller (formatted). */
  function describe(bp, state, speciesLabel) {
    var base = 'A ' + speciesLabel.toLowerCase() + ' plant, ' + statureWord(bp) + ', ' + bearingWord(bp) +
      ', with ' + bp.leafFamily + ' leaves.';
    if (state.phase === 'growing') {
      return base + ' It is ' + stageLabel(bp.species, state.stage) + '.';
    }
    if (state.phase === 'open') {
      return base + ' It ' + bloomClause(bp, 'present') + '.';
    }
    return base + ' It ' + bloomClause(bp, 'past') + '. A silvered seed-head stands where the bloom was.';
  }
  /* the pressed-record sentence: past tense, matched to what the pressing shows (ADR-011);
     the words always carry the whole bloom, whatever the image withheld */
  function describePressed(bp, speciesLabel, saw) {
    var base = 'A ' + speciesLabel.toLowerCase() + ' plant, ' + statureWord(bp) + ', ' + bearingWord(bp) +
      ', with ' + bp.leafFamily + ' leaves.';
    if (saw === 'witnessed') return base + ' It ' + bloomClause(bp, 'past') + '. Pressed open-faced, its color quieted.';
    if (saw === 'foreseen') return base + ' It ' + bloomClause(bp, 'past') + '. Pressed as the drawing that was seen early; the color was never shown.';
    if (saw === 'rehearsal') return base + ' Pressed as the drawing it always was; a rehearsal is drawn in line only.';
    return base + ' It ' + bloomClause(bp, 'past') + '. A silvered seed-head stands where the bloom was.';
  }

  /* the foresee study sentence — form only, color withheld and said so */
  function describeStudy(bp) {
    var noColor = bloomClause(bp, 'future');
    /* strip the trailing color phrase honestly: rebuild without color */
    var v = 'will open as';
    var form;
    if (bp.bloomFamily === 'corolla') form = countWord(bp.petalCount) + ' ' + petalAdj(bp) + ' petals';
    else if (bp.bloomFamily === 'iris') form = 'an iris form — three petals standing, two falling';
    else if (bp.bloomFamily === 'bell') form = 'a single hanging bell';
    else if (bp.bloomFamily === 'spike') form = 'a spike of ' + countWord(bp.petalCount) + ' small florets';
    else form = 'an umbel of ' + countWord(bp.petalCount) + ' rays';
    return 'A drawing, not the bloom: it ' + v + ' ' + form + '. The color is not shown.';
  }

  global.POTHOS_BOTANY = {
    SPECIES: SPECIES,
    STAGE_COUNT: STAGE_COUNT,
    makeSeed: makeSeed,
    buildBlueprint: buildBlueprint,
    stateAt: stateAt,
    stageLabel: stageLabel,
    growthNotes: growthNotes,
    renderPlant: renderPlant,
    describe: describe,
    describePressed: describePressed,
    describeStudy: describeStudy,
    colorOf: colorOf,
    mulberry32: mulberry32
  };
})(window);
