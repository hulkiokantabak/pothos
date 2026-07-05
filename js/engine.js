/* POTHOS — engine.js
 * The governed spine (series pattern, adapted from LEXIS): a motion/visibility governor
 * (reduced-motion + background-tab safety) and a tiny asset-free WebAudio synth.
 * No dependencies, no network. One global: window.POTHOS_ENGINE.
 */
(function (global) {
  'use strict';

  /* ---------- motion / visibility governor ---------- */
  var mq = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var Motion = {
    reduced: !!(mq && mq.matches),
    tabHidden: !!document.hidden,
    _listeners: [],
    shouldAnimate: function () { return !this.reduced && !this.tabHidden; },
    onChange: function (fn) { this._listeners.push(fn); }
  };
  document.addEventListener('visibilitychange', function () {
    Motion.tabHidden = document.hidden;
    Motion._listeners.forEach(function (fn) { try { fn(); } catch (x) {} });
  });
  function onMQChange(e) {
    Motion.reduced = e.matches;
    Motion._listeners.forEach(function (fn) { try { fn(); } catch (x) {} });
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', onMQChange);
  else if (mq && mq.addListener) mq.addListener(onMQChange); /* legacy Safari */

  /* ---------- tiny synth (asset-free) ----------
   * Three utterances only (council spec): a dry sow pluck; the witness cadence — the piece's
   * single resolving chord, deterministic per seed, identical every play; a barely-audible
   * hold tone as gesture feedback. No sad tones. Master gain low. Gesture-gated; iOS unlock.
   */
  var Audio = {
    ctx: null, master: null, enabled: true, _started: false,
    ensure: function () {
      if (!this.enabled) return false;
      if (!this._started) {
        try {
          var AC = global.AudioContext || global.webkitAudioContext;
          if (!AC) return false;
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.14;
          this.master.connect(this.ctx.destination);
          this._started = true;
          /* iOS unlock: one silent sample inside the gesture */
          var b = this.ctx.createBuffer(1, 1, 22050);
          var s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.ctx.destination); s.start(0);
        } catch (e) { return false; }
      }
      if (this.ctx && this.ctx.state !== 'running') {
        try { var pr = this.ctx.resume(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
      }
      return !!this.ctx;
    },
    /* audio is truly available only when the context runs (autoplay policy gates it
       until a user gesture); callers that must not fire-and-forget check this */
    running: function () { return !!(this.ctx && this.ctx.state === 'running'); },
    _tone: function (type, freq, t0, dur, peak, freqEnd) {
      var c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + dur + 0.04);
    },
    /* the sow pluck: one dry note, no tail */
    sow: function () {
      if (!this.ensure()) return;
      var t = this.ctx.currentTime;
      this._tone('triangle', 196.0, t, 0.18, 0.22, 174.6);
    },
    /* the witness cadence: sus4 resolving to major, root from the seed — deterministic,
     * identical on every witnessed viewing (never first-time-only). The piece's one resolve.
     * Returns true only if it actually sounded (context running). */
    witness: function (seed) {
      if (!this.ensure()) return false;
      if (!this.running()) return false;
      var semis = (seed >>> 0) % 12;
      var root = 220 * Math.pow(2, semis / 12); /* A3..G#4 */
      var t = this.ctx.currentTime;
      /* sus4 voicing */
      this._tone('sine', root, t, 1.6, 0.10);
      this._tone('sine', root * 4 / 3, t, 0.9, 0.07);          /* the 4th */
      this._tone('sine', root * 3 / 2, t, 1.6, 0.07);
      /* resolve: the 4th falls to the major 3rd */
      this._tone('sine', root * 5 / 4, t + 0.9, 1.4, 0.08);
      this._tone('sine', root * 2, t + 0.9, 1.4, 0.04);
      return true;
    },
    /* gesture feedback while holding: barely audible, steady, stops on release */
    _hold: null,
    holdStart: function () {
      if (!this.ensure()) return;
      try {
        var c = this.ctx, o = c.createOscillator(), g = c.createGain();
        o.type = 'triangle'; o.frequency.value = 82.4; /* E2 */
        g.gain.value = 0.0001;
        g.gain.exponentialRampToValueAtTime(0.03, c.currentTime + 0.25);
        o.connect(g); g.connect(this.master); o.start();
        this._hold = { o: o, g: g };
      } catch (e) {}
    },
    holdEnd: function () {
      if (!this._hold) return;
      try {
        var c = this.ctx, h = this._hold;
        h.g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.12);
        h.o.stop(c.currentTime + 0.2);
      } catch (e) {}
      this._hold = null;
    }
  };

  global.POTHOS_ENGINE = { Motion: Motion, Audio: Audio };
})(window);
