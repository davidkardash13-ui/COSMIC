/**
 * Звуки через Web Audio API (без внешних файлов).
 * Первый клик/клавиша «разблокирует» аудиоконтекст в браузере.
 */
var SFX = (function () {
  var ctx = null;
  var master = 0.32;
  var bgm = {
    enabled: true,
    mode: "menu",
    running: false,
    timer: null,
    nextTime: 0,
    gain: null,
    gMenu: null,
    gBattle: null,
  };

  function getCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  }

  function resume() {
    var c = getCtx();
    if (c && c.state === "suspended") c.resume();
    bgmEnsureRunning();
  }

  if (typeof document !== "undefined") {
    document.addEventListener(
      "click",
      function once() {
        resume();
        document.removeEventListener("click", once);
      },
      { capture: true }
    );
    document.addEventListener(
      "keydown",
      function onceK() {
        resume();
        document.removeEventListener("keydown", onceK);
      },
      { capture: true }
    );
  }

  function tone(freq, dur, type, vol, when) {
    var c = getCtx();
    if (!c) return;
    var t0 = when != null ? when : c.currentTime;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    var v = (vol != null ? vol : 0.4) * master;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.04);
  }

  function toneSlide(freqStart, freqEnd, dur, type, vol) {
    var c = getCtx();
    if (!c) return;
    var t0 = c.currentTime;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freqStart, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    var v = (vol != null ? vol : 0.45) * master;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function chord(freqs, dur, vol) {
    var c = getCtx();
    if (!c) return;
    var t0 = c.currentTime;
    for (var i = 0; i < freqs.length; i++) {
      tone(freqs[i], dur, "sine", (vol || 0.35) / freqs.length, t0 + i * 0.012);
    }
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function bgmEnsureNodes() {
    var c = getCtx();
    if (!c) return false;
    if (bgm.gain) return true;
    bgm.gain = c.createGain();
    bgm.gMenu = c.createGain();
    bgm.gBattle = c.createGain();
    bgm.gain.gain.value = 0.0;
    bgm.gMenu.gain.value = 1.0;
    bgm.gBattle.gain.value = 0.0;
    bgm.gMenu.connect(bgm.gain);
    bgm.gBattle.connect(bgm.gain);
    bgm.gain.connect(c.destination);
    return true;
  }

  function bgmSetMode(mode) {
    if (mode !== "menu" && mode !== "battle") mode = "menu";
    bgm.mode = mode;
    var c = getCtx();
    if (!c || !bgmEnsureNodes()) return;
    var t0 = c.currentTime;
    var fade = 0.55;
    var menuTarget = mode === "menu" ? 1 : 0;
    var battleTarget = mode === "battle" ? 1 : 0;
    bgm.gMenu.gain.cancelScheduledValues(t0);
    bgm.gBattle.gain.cancelScheduledValues(t0);
    bgm.gMenu.gain.setValueAtTime(bgm.gMenu.gain.value, t0);
    bgm.gBattle.gain.setValueAtTime(bgm.gBattle.gain.value, t0);
    bgm.gMenu.gain.linearRampToValueAtTime(menuTarget, t0 + fade);
    bgm.gBattle.gain.linearRampToValueAtTime(battleTarget, t0 + fade);
    bgmEnsureRunning();
  }

  function bgmSetEnabled(on) {
    bgm.enabled = !!on;
    if (!bgm.enabled) bgmStop();
    else bgmEnsureRunning();
  }

  function bgmStop() {
    bgm.running = false;
    if (bgm.timer) {
      clearInterval(bgm.timer);
      bgm.timer = null;
    }
    var c = getCtx();
    if (c && bgm.gain) {
      var t0 = c.currentTime;
      bgm.gain.gain.cancelScheduledValues(t0);
      bgm.gain.gain.setValueAtTime(bgm.gain.gain.value, t0);
      bgm.gain.gain.linearRampToValueAtTime(0.0, t0 + 0.2);
    }
  }

  function bgmEnsureRunning() {
    var c = getCtx();
    if (!c) return;
    if (!bgm.enabled) return;
    if (c.state !== "running") return;
    if (!bgmEnsureNodes()) return;

    if (!bgm.running) {
      bgm.running = true;
      bgm.nextTime = c.currentTime + 0.05;
      var t0 = c.currentTime;
      var target = clamp(master * 0.22, 0.06, 0.28);
      bgm.gain.gain.cancelScheduledValues(t0);
      bgm.gain.gain.setValueAtTime(bgm.gain.gain.value, t0);
      bgm.gain.gain.linearRampToValueAtTime(target, t0 + 0.6);
      bgmSetMode(bgm.mode);
      bgm.timer = setInterval(bgmTick, 110);
    }
  }

  function scheduleTone(freq, dur, type, vol, when, busGain) {
    var c = getCtx();
    if (!c || !busGain) return;
    var o = c.createOscillator();
    var g = c.createGain();
    var f = Math.max(30, freq);
    o.type = type || "sine";
    o.frequency.setValueAtTime(f, when);
    var v = (vol != null ? vol : 0.2) * master;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(v, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.00035, when + dur);
    o.connect(g);
    g.connect(busGain);
    o.start(when);
    o.stop(when + dur + 0.04);
  }

  function scheduleNoise(dur, vol, when, busGain) {
    var c = getCtx();
    if (!c || !busGain) return;
    var len = Math.max(1, Math.floor(dur * c.sampleRate));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource();
    src.buffer = buf;
    var hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(1800, when);
    var g = c.createGain();
    var v = (vol != null ? vol : 0.18) * master;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(v, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.00035, when + dur);
    src.connect(hp);
    hp.connect(g);
    g.connect(busGain);
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  function bgmTick() {
    var c = getCtx();
    if (!c || c.state !== "running" || !bgm.running) return;

    var lookAhead = 0.55;
    var tNow = c.currentTime;
    var t = bgm.nextTime;
    if (t < tNow) t = tNow + 0.01;

    var bpm = bgm.mode === "battle" ? 108 : 74;
    var step = 60 / bpm / 2; // 1/8

    while (t < tNow + lookAhead) {
      var idx = Math.floor((t * bpm * 2) % 16);

      if (bgm.mode === "menu") {
        // Спокойная, загадочная: мягкий пад + редкие «искры».
        if (idx === 0 || idx === 8) {
          scheduleTone(110, step * 5.2, "sine", 0.10, t, bgm.gMenu);
          scheduleTone(220, step * 5.2, "triangle", 0.06, t, bgm.gMenu);
          scheduleTone(329.63, step * 5.2, "sine", 0.05, t, bgm.gMenu);
        }
        if (idx === 6 || idx === 14) {
          var s = [523.25, 659.25, 783.99][Math.floor(Math.random() * 3)];
          scheduleTone(s, step * 1.2, "triangle", 0.05, t, bgm.gMenu);
        }
        if (idx === 4) {
          scheduleNoise(step * 0.65, 0.03, t, bgm.gMenu);
        }
      } else {
        // Загадочная, боевая: бас + перкуссия + острые акценты.
        if (idx === 0 || idx === 8) {
          scheduleTone(82.41, step * 1.6, "sawtooth", 0.11, t, bgm.gBattle);
        }
        if (idx === 4 || idx === 12) {
          scheduleTone(98.0, step * 1.2, "square", 0.08, t, bgm.gBattle);
        }
        // хет
        scheduleNoise(step * 0.22, idx % 2 === 0 ? 0.06 : 0.04, t, bgm.gBattle);
        // удар (псевдо-снейр)
        if (idx === 4 || idx === 12) {
          scheduleNoise(step * 0.35, 0.09, t, bgm.gBattle);
        }
        // мистический акцент
        if (idx === 2 || idx === 10) {
          scheduleTone(415.3, step * 0.9, "triangle", 0.05, t, bgm.gBattle);
          scheduleTone(622.25, step * 0.75, "sine", 0.03, t + step * 0.12, bgm.gBattle);
        }
      }

      t += step;
    }

    bgm.nextTime = t;
  }

  return {
    /** Кнопки меню и UI */
    uiClick: function () {
      tone(880, 0.045, "triangle", 0.35);
    },

    uiBack: function () {
      tone(420, 0.06, "sine", 0.3);
    },

    /** Постройка башни */
    towerPlace: function () {
      chord([392, 523.25, 659.25], 0.14, 0.42);
    },

    /** Улучшение башни */
    towerUpgrade: function () {
      var c = getCtx();
      if (!c) return;
      var t0 = c.currentTime;
      tone(523.25, 0.08, "sine", 0.28, t0);
      tone(659.25, 0.08, "sine", 0.28, t0 + 0.06);
      tone(783.99, 0.1, "sine", 0.3, t0 + 0.12);
    },

    /** Не хватило золота / нельзя */
    uiNope: function () {
      var c = getCtx();
      if (!c) return;
      var t0 = c.currentTime;
      tone(180, 0.07, "square", 0.12, t0);
      tone(140, 0.09, "square", 0.1, t0 + 0.05);
    },

    /** Следующая волна */
    waveStart: function () {
      toneSlide(95, 42, 0.38, "sine", 0.55);
      var c = getCtx();
      if (c) tone(330, 0.12, "triangle", 0.22, c.currentTime + 0.28);
    },

    /** Враг убит */
    enemyKill: function (e) {
      var k = e && e.kind;
      if (k === "boss" || k === "titan") {
        tone(110, 0.14, "sine", 0.45);
        var c = getCtx();
        if (c) tone(440, 0.1, "triangle", 0.25, c.currentTime + 0.1);
        if (c) tone(554.37, 0.12, "sine", 0.2, c.currentTime + 0.18);
      } else {
        tone(300 + Math.random() * 90, 0.055, "triangle", 0.28);
      }
    },

    /** Жизнь потеряна */
    lifeLost: function () {
      toneSlide(280, 90, 0.22, "sawtooth", 0.25);
    },

    /** Победа */
    victory: function () {
      var c = getCtx();
      if (!c) return;
      var t0 = c.currentTime;
      var seq = [523.25, 659.25, 783.99, 1046.5];
      for (var i = 0; i < seq.length; i++) {
        tone(seq[i], 0.16, "sine", 0.32 / (1 + i * 0.15), t0 + i * 0.11);
      }
    },

    /** Поражение */
    defeat: function () {
      var c = getCtx();
      if (!c) return;
      var t0 = c.currentTime;
      tone(392, 0.15, "sine", 0.35, t0);
      tone(349.23, 0.18, "sine", 0.32, t0 + 0.14);
      tone(293.66, 0.25, "triangle", 0.35, t0 + 0.3);
    },

    /** Кейс открыт / награда */
    caseReveal: function () {
      var c = getCtx();
      if (!c) return;
      var t0 = c.currentTime;
      tone(660, 0.06, "sine", 0.25, t0);
      tone(880, 0.07, "sine", 0.28, t0 + 0.05);
      tone(1320, 0.1, "triangle", 0.22, t0 + 0.1);
    },

    /** Загрузка завершена */
    loaderReady: function () {
      chord([392, 493.88, 587.33], 0.2, 0.35);
    },

    /** Переключение авто-волны */
    toggle: function (on) {
      if (on) tone(600, 0.06, "sine", 0.25);
      else tone(380, 0.06, "sine", 0.22);
    },

    /** Фоновая музыка */
    bgmSetMode: bgmSetMode,
    bgmStop: bgmStop,
    bgmSetEnabled: bgmSetEnabled,
  };
})();
