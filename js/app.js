(function () {
  var state = Storage.load();
  var gameInstance = null;
  var pendingGameOpts = null;
  var pendingDifficultyCancelScreen = null;

  var DIFF_MODAL_DESC_DEFAULT =
    "Выберите сложность перед началом игры. Можно изменить при каждом запуске.";

  function $(id) {
    return document.getElementById(id);
  }

  function showScreen(id) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.remove("screen-active");
    }
    var el = $(id);
    if (el) el.classList.add("screen-active");
    var isGame = id === "screen-game";
    document.body.classList.toggle("view-game", isGame);
    if (typeof SFX !== "undefined" && SFX.bgmSetMode) {
      SFX.bgmSetMode(isGame ? "battle" : "menu");
    }
  }

  function refreshMenuStats() {
    var g = $("menu-gold");
    var m = $("menu-gems");
    if (g) g.textContent = String(Math.floor(state.gold));
    if (m) m.textContent = String(Math.floor(state.gems));
  }

  function persist() {
    Storage.save(state);
    refreshMenuStats();
  }

  function initParticles() {
    var root = $("particles");
    if (!root) return;
    root.innerHTML = "";
    var n = 72;
    for (var i = 0; i < n; i++) {
      var s = document.createElement("span");
      s.style.left = Math.random() * 100 + "%";
      s.style.top = Math.random() * 100 + "%";
      s.style.animationDelay = Math.random() * 10 + "s";
      s.style.animationDuration = 7 + Math.random() * 11 + "s";
      var roll = Math.random();
      if (roll > 0.78) s.classList.add("particle--lg");
      else if (roll > 0.55) s.classList.add("particle--gem");
      else if (roll > 0.35) s.classList.add("particle--soft");
      root.appendChild(s);
    }
  }

  function rarityClass(r) {
    return "rarity-" + r;
  }

  function rarityLabelRu(r) {
    if (r === "common") return "Обычный";
    if (r === "rare") return "Редкий";
    if (r === "epic") return "Эпический";
    if (r === "legendary") return "Легендарный";
    if (r === "mythical") return "Мифический";
    if (r === "verdant") return "Древний";
    return r;
  }

  function setCollectionTab(tab) {
    tab = tab === "enemies" ? "enemies" : "heroes";
    state.collectionTab = tab;
    persist();

    var btnH = $("tab-heroes");
    var btnE = $("tab-enemies");
    var panelH = $("collection-panel-heroes");
    var panelE = $("collection-panel-enemies");
    if (btnH) {
      btnH.classList.toggle("is-active", tab === "heroes");
      btnH.setAttribute("aria-selected", tab === "heroes" ? "true" : "false");
    }
    if (btnE) {
      btnE.classList.toggle("is-active", tab === "enemies");
      btnE.setAttribute("aria-selected", tab === "enemies" ? "true" : "false");
    }
    if (panelH) panelH.classList.toggle("hidden", tab !== "heroes");
    if (panelE) panelE.classList.toggle("hidden", tab !== "enemies");
  }

  function renderCollection() {
    var grid = $("collection-grid");
    if (!grid) return;
    grid.innerHTML = "";
    var owned = {};
    for (var o = 0; o < state.ownedHeroes.length; o++) owned[state.ownedHeroes[o]] = true;

    for (var i = 0; i < HEROES.length; i++) {
      var h = HEROES[i];
      var slot = document.createElement("div");
      var isOwned = !!owned[h.id];
      slot.className = "hero-slot " + (isOwned ? "owned" : "locked");
      slot.innerHTML =
        '<span class="rarity-badge ' +
        rarityClass(h.rarity) +
        '">' +
        rarityLabelRu(h.rarity) +
        "</span>" +
        '<div class="mini-portrait" style="background-image:linear-gradient(180deg,rgba(0,0,0,0.2),rgba(0,0,0,0.85)),' +
        h.gradient +
        '"></div>' +
        '<div class="slot-name">' +
        h.name +
        (isOwned ? "" : " — ???") +
        "</div>";
      grid.appendChild(slot);
    }

    var enemyRoot = $("collection-enemies");
    if (enemyRoot && typeof TDGame !== "undefined" && TDGame.ENEMY_CATALOG) {
      enemyRoot.innerHTML = "";
      var catalog = TDGame.ENEMY_CATALOG;
      for (var ei = 0; ei < catalog.length; ei++) {
        var e = catalog[ei];
        var card = document.createElement("article");
        card.className = "enemy-slot";
        var regenLine =
          e.regen > 0
            ? '<span class="enemy-stat">♻ +' + e.regen.toFixed(1) + " HP/с</span>"
            : "";
        var slowPct = Math.round(e.slowResist * 100);
        card.innerHTML =
          '<div class="enemy-icon" style="--enemy-c:' +
          e.color +
          ';box-shadow:0 0 24px ' +
          e.color +
          '55"></div>' +
          '<div class="enemy-body">' +
          '<div class="enemy-name">' +
          e.nameRu +
          "</div>" +
          '<p class="enemy-desc">' +
          e.desc +
          "</p>" +
          '<div class="enemy-stats">' +
          '<span class="enemy-stat">HP ×' +
          e.hpMul.toFixed(2) +
          "</span>" +
          '<span class="enemy-stat">Скорость ×' +
          e.speedMul.toFixed(2) +
          "</span>" +
          '<span class="enemy-stat">Броня +' +
          Math.round(e.armorAdd * 100) +
          "%</span>" +
          '<span class="enemy-stat">Анти-замедл. ' +
          slowPct +
          "%</span>" +
          regenLine +
          "</div></div>";
        enemyRoot.appendChild(card);
      }
    }

    setCollectionTab(state.collectionTab || "heroes");
  }

  function setupCaseOverlay() {
    var overlay = $("case-overlay");
    var box = $("case-box");
    var wrap = $("reveal-card-wrap");
    var status = $("reveal-status");
    var btn = $("reveal-close");
    var card = $("reveal-hero-card");
    var glow = $("reveal-glow");
    var portrait = $("reveal-portrait");
    var rarityEl = $("reveal-rarity");
    var nameEl = $("reveal-name");
    var roleEl = $("reveal-role");

    function close() {
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
      wrap.classList.add("hidden");
      btn.classList.add("hidden");
      box.classList.remove("opening");
      persist();
    }

    btn.addEventListener("click", close);

    window.__openCaseAnimation = function (result, onDone, theme) {
      if (!result || !result.hero) return;
      overlay.classList.remove("hidden");
      overlay.setAttribute("aria-hidden", "false");
      wrap.classList.add("hidden");
      btn.classList.add("hidden");
      box.classList.remove("opening");
      status.textContent = "Открываем…";
      status.classList.remove("error");

      var hero = result.hero;
      card.className =
        "hero-card " +
        (hero.rarity === "verdant"
          ? "verdant"
          : hero.rarity === "mythical"
          ? "mythical"
          : hero.rarity === "legendary"
            ? "legendary"
            : hero.rarity === "epic"
              ? "epic"
              : hero.rarity === "rare"
                ? "rare"
                : hero.rarity === "common"
                  ? "common"
                  : "");
      portrait.style.backgroundImage = "linear-gradient(180deg,rgba(15,23,42,0.1),#0f172a)," + hero.gradient;
      rarityEl.textContent = rarityLabelRu(hero.rarity);
      nameEl.textContent = hero.name;
      if (result.duplicate) {
        roleEl.textContent =
          "Дубликат! +" +
          result.compensation +
          (result.compensationType === "gems" ? " кристаллов" : " золота");
      } else {
        roleEl.textContent = hero.role;
      }

      void box.offsetWidth;
      box.classList.add("opening");

      setTimeout(function () {
        wrap.classList.remove("hidden");
        status.textContent = result.duplicate ? "Уже в коллекции — компенсация начислена." : "Новый герой добавлен в коллекцию!";
        btn.classList.remove("hidden");
        if (typeof SFX !== "undefined" && SFX.caseReveal) SFX.caseReveal();
        if (onDone) onDone();
      }, 1100);
    };
  }

  function bindCases() {
    var buttons = document.querySelectorAll(".btn-open");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function () {
        var caseType = this.getAttribute("data-open");
        if (!Cases.canAfford(state, caseType)) {
          alert("Недостаточно валюты.");
          return;
        }
        var ownedSet = {};
        for (var j = 0; j < state.ownedHeroes.length; j++) ownedSet[state.ownedHeroes[j]] = true;
        var next = Cases.pay(state, caseType);
        var result = Cases.open(caseType, ownedSet);
        state = next;
        if (!result.duplicate) {
          state.ownedHeroes.push(result.hero.id);
        } else {
          if (result.compensationType === "gems") state.gems += result.compensation;
          else state.gold += result.compensation;
        }
        persist();
        window.__openCaseAnimation(result, null, null);
      });
    }
  }

  function buildTowerPanel(game) {
    var list = $("tower-list");
    var hint = $("panel-hint");
    if (!list) return;
    list.innerHTML = "";
    var types = TDGame.TOWER_TYPES.slice();
    types.sort(function (a, b) {
      return a.cost - b.cost;
    });
    var any = false;
    for (var i = 0; i < types.length; i++) {
      (function (def) {
        if (!game.isTowerUnlocked(def)) return;
        any = true;
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tower-btn";
        btn.dataset.towerId = def.id;
        var h = getHeroById(def.id);
        var titleLine = h ? h.name + " — " + def.name : def.name;
        var rarityHtml = "";
        if (def.heroRarity) {
          rarityHtml =
            '<span class="rarity-badge tower-rarity-pill ' +
            rarityClass(def.heroRarity) +
            '">' +
            rarityLabelRu(def.heroRarity) +
            "</span> ";
        }
        var mechHint =
          h && h.tower && h.tower.mechanicDesc
            ? '<br/><small class="tower-mech">' +
              h.tower.mechanicDesc +
              "</small>"
            : "";
        var statHint =
          def.damage > 0
            ? '<br/><small class="tower-stats-hint">Урон ' +
              def.damage +
              " · дальн. " +
              def.range +
              " · CD " +
              def.cooldown +
              "</small>"
            : "";
        btn.innerHTML =
          '<span class="tower-icon" style="background:linear-gradient(145deg,' +
          def.color +
          ',#0f172a)"></span><span>' +
          rarityHtml +
          "<strong>" +
          titleLine +
          "</strong><br/><small>" +
          def.cost +
          " зол.</small>" +
          statHint +
          mechHint +
          "</span>";
        btn.addEventListener("click", function () {
          var prev = list.querySelector(".selected");
          if (prev) prev.classList.remove("selected");
          btn.classList.add("selected");
          game.selectedTowerType = def.id;
        });
        list.appendChild(btn);
      })(types[i]);
    }
    var first = list.querySelector(".tower-btn");
    if (first) {
      first.classList.add("selected");
      game.selectedTowerType = first.dataset.towerId;
    } else {
      game.selectedTowerType = null;
    }
    if (hint) {
      hint.textContent = any
        ? "Пустая клетка — построить выбранную башню. ЛКМ — улучшение, ПКМ — снять (50% золота). Чем выше редкость героя, тем сильнее его башня (урон, дальность, скорость атаки; выше цена)."
        : "Нет героев — откройте кейсы в главном меню.";
    }
  }

  function hudUpdate(game) {
    var lives = $("hud-lives");
    var wave = $("hud-wave");
    var maxw = $("hud-max-waves");
    var hg = $("hud-gold");
    var hgm = $("hud-gems");
    if (lives) lives.textContent = String(game.lives);
    if (wave) wave.textContent = String(game.waveIndex);
    if (maxw) maxw.textContent = String(game.maxWaves);
    if (hg) hg.textContent = String(Math.floor(game.gold));
    if (hgm) {
      var banked = typeof state.gems === "number" ? state.gems : 0;
      var run = game && typeof game.runGems === "number" ? game.runGems : 0;
      hgm.textContent = String(Math.floor(banked + run));
    }
    var autoBtn = $("btn-auto-wave");
    if (autoBtn && game) {
      var on = !!game.autoNextWave;
      autoBtn.classList.toggle("is-on", on);
      autoBtn.setAttribute("aria-pressed", on ? "true" : "false");
    }

    // Модификаторы забега (редкие эффекты)
    var modsRoot = $("hud-mods");
    if (modsRoot) {
      var mods = game && Array.isArray(game.modifiers) ? game.modifiers : [];
      if (!mods.length) {
        modsRoot.classList.remove("hidden");
        modsRoot.innerHTML =
          '<span class="mod-pill mod-pill--empty" title="Иногда в начале забега включаются редкие эффекты." aria-label="Модификаторы: нет">' +
          '<span class="mod-dot" aria-hidden="true"></span>' +
          '<span class="mod-name">Модификаторов нет</span>' +
          "</span>";
      } else {
        modsRoot.classList.remove("hidden");
        var html = "";
        for (var mi = 0; mi < mods.length; mi++) {
          var m = mods[mi];
          var name = m && m.name ? String(m.name) : "Модификатор";
          var desc = m && m.desc ? String(m.desc) : "";
          html +=
            '<span class="mod-pill" title="' +
            desc.replace(/"/g, "&quot;") +
            '" aria-label="' +
            name.replace(/"/g, "&quot;") +
            '">' +
            '<span class="mod-dot" aria-hidden="true"></span>' +
            '<span class="mod-name">' +
            name +
            "</span></span>";
        }
        modsRoot.innerHTML = html;
      }
    }
  }

  function bankRunGemsFromGame() {
    if (gameInstance && typeof gameInstance.runGems === "number" && gameInstance.runGems > 0) {
      state.gems += gameInstance.runGems;
      gameInstance.runGems = 0;
    }
  }

  function bankSessionGoldFromGame() {
    if (gameInstance && typeof gameInstance.sessionGoldEarned === "number" && gameInstance.sessionGoldEarned > 0) {
      state.gold += gameInstance.sessionGoldEarned;
      gameInstance.sessionGoldEarned = 0;
    }
  }

  function startGame(opts) {
    opts = opts || {};
    if (!state.ownedHeroes || state.ownedHeroes.length === 0) {
      alert("Сначала откройте кейс и получите хотя бы одного героя — башни доступны только через коллекцию.");
      return;
    }
    showScreen("screen-game");
    var canvas = $("game-canvas");
    var overlay = $("game-overlay");
    if (overlay) overlay.classList.add("hidden");

    var sg = $("screen-game");
    if (sg) sg.classList.remove("screen-game--easter-trial");

    var bonuses = aggregateBonuses(state.ownedHeroes);
    if (gameInstance) {
      gameInstance.stop();
      gameInstance = null;
    }

    gameInstance = new TDGame.Game(canvas, bonuses, {
      difficulty: opts.difficulty || state.difficulty || "normal",
    });
    gameInstance.setOwnedHeroes(state.ownedHeroes);
    gameInstance.onUiUpdate = function () {
      hudUpdate(gameInstance);
    };
    gameInstance.onEnd = function (res) {
      gameInstance.stop();
      if (overlay) overlay.classList.remove("hidden");
      var title = $("overlay-title");
      var text = $("overlay-text");
      bankRunGemsFromGame();
      bankSessionGoldFromGame();
      if (res.win) {
        if (typeof SFX !== "undefined" && SFX.victory) SFX.victory();
        state.gold += 520;
        state.gems += typeof GAME_CONFIG.GEMS_VICTORY_BONUS === "number" ? GAME_CONFIG.GEMS_VICTORY_BONUS : 28;
        state.gamesWon = (state.gamesWon || 0) + 1;
        if (gameInstance.waveIndex > (state.highestWave || 0)) state.highestWave = gameInstance.waveIndex;
        persist();
        if (title) title.textContent = "Победа!";
        if (text) {
          var baseMsg =
            "Все 30 волон пройдены. Золото и кристаллы зачислены. На волнах 10, 20 и 30 — по два босса.";
          text.textContent = baseMsg;
        }
      } else {
        if (typeof SFX !== "undefined" && SFX.defeat) SFX.defeat();
        persist();
        if (title) title.textContent = "Поражение";
        if (text)
          text.textContent =
            "Враги прорвались. Кристаллы, заработанные в этом бою, сохранены. Попробуйте другую расстановку.";
      }
    };

    buildTowerPanel(gameInstance);
    hudUpdate(gameInstance);

    canvas.onclick = function (ev) {
      if (!gameInstance || !gameInstance.running) return;
      var g = gameInstance.screenToGrid(ev.clientX, ev.clientY);
      var existing = gameInstance.towerAt(g.gx, g.gy);
      if (existing) {
        if (gameInstance.tryUpgradeTower(existing)) {
          if (typeof SFX !== "undefined") SFX.towerUpgrade();
        } else if (typeof SFX !== "undefined") {
          SFX.uiNope();
        }
        return;
      }
      if (!gameInstance.selectedTowerType) return;
      if (gameInstance.tryPlaceTower(g.gx, g.gy, gameInstance.selectedTowerType)) {
        if (typeof SFX !== "undefined") SFX.towerPlace();
      } else if (typeof SFX !== "undefined") {
        SFX.uiNope();
      }
    };
    canvas.oncontextmenu = function (ev) {
      ev.preventDefault();
      if (!gameInstance || !gameInstance.running) return;
      var g = gameInstance.screenToGrid(ev.clientX, ev.clientY);
      if (gameInstance.towerAt(g.gx, g.gy)) {
        if (gameInstance.tryRemoveTower(g.gx, g.gy)) {
          if (typeof SFX !== "undefined" && SFX.towerPlace) SFX.towerPlace();
        }
      }
    };
    canvas.onmousemove = function (ev) {
      if (!gameInstance || !gameInstance.running) return;
      var g = gameInstance.screenToGrid(ev.clientX, ev.clientY);
      var def = null;
      var sid = gameInstance.selectedTowerType;
      if (sid) {
        for (var i = 0; i < TDGame.TOWER_TYPES.length; i++) {
          if (TDGame.TOWER_TYPES[i].id === sid) {
            def = TDGame.TOWER_TYPES[i];
            break;
          }
        }
      }
      gameInstance.hoverCell = { gx: g.gx, gy: g.gy, def: def };
    };
    canvas.onmouseleave = function () {
      if (gameInstance) gameInstance.hoverCell = null;
    };

    gameInstance.start();
  }

  function hideDifficultyOverlay() {
    var ov = $("difficulty-overlay");
    if (ov) {
      ov.classList.add("hidden");
      ov.setAttribute("aria-hidden", "true");
    }
  }

  function openDifficultyPicker(opts) {
    opts = opts || {};
    pendingGameOpts = {};
    pendingDifficultyCancelScreen = opts.cancelScreen || null;

    var desc = $("difficulty-modal-desc");
    if (desc) desc.textContent = DIFF_MODAL_DESC_DEFAULT;
    var startBtn = $("btn-diff-start");
    if (startBtn) startBtn.textContent = "Начать игру";

    var ov = $("difficulty-overlay");
    if (ov) {
      ov.classList.remove("hidden");
      ov.setAttribute("aria-hidden", "false");
    }
    syncDifficultyUi();
  }

  function confirmDifficultyAndStart() {
    hideDifficultyOverlay();
    var po = pendingGameOpts || {};
    pendingGameOpts = null;
    pendingDifficultyCancelScreen = null;
    startGame(Object.assign({ difficulty: state.difficulty || "normal" }, po));
  }

  function cancelDifficultyPicker() {
    var cs = pendingDifficultyCancelScreen;
    pendingGameOpts = null;
    pendingDifficultyCancelScreen = null;
    hideDifficultyOverlay();
    if (cs) showScreen(cs);
  }

  function syncDifficultyUi() {
    var d = state.difficulty || "normal";
    var chips = document.querySelectorAll(".diff-chip");
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle("diff-chip--active", chips[i].getAttribute("data-difficulty") === d);
    }
  }

  function bindDifficulty() {
    var chips = document.querySelectorAll(".diff-chip");
    for (var i = 0; i < chips.length; i++) {
      chips[i].addEventListener("click", function () {
        var d = this.getAttribute("data-difficulty");
        if (!d) return;
        state.difficulty = d;
        syncDifficultyUi();
        persist();
      });
    }
    var startBtn = $("btn-diff-start");
    if (startBtn) startBtn.addEventListener("click", confirmDifficultyAndStart);
    var cancelBtn = $("btn-diff-cancel");
    if (cancelBtn) cancelBtn.addEventListener("click", cancelDifficultyPicker);
    var dov = $("difficulty-overlay");
    if (dov) {
      dov.addEventListener("click", function (ev) {
        if (ev.target === dov) cancelDifficultyPicker();
      });
    }
    syncDifficultyUi();
  }

  function bindNav() {
    $("btn-play").addEventListener("click", function () {
      if (!state.ownedHeroes || state.ownedHeroes.length === 0) {
        alert("Сначала откройте кейс и получите хотя бы одного героя — башни доступны только через коллекцию.");
        return;
      }
      openDifficultyPicker({});
    });
    $("btn-cases").addEventListener("click", function () {
      showScreen("screen-cases");
    });
    $("btn-collection").addEventListener("click", function () {
      renderCollection();
      showScreen("screen-collection");
    });
    var resetBtn = $("btn-reset-progress");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        var ok = confirm(
          "Сбросить весь прогресс?\n\nЭто удалит золото, кристаллы, коллекцию героев, рекорды и активированные промокоды."
        );
        if (!ok) return;
        if (gameInstance) {
          try {
            gameInstance.stop();
          } catch (e) {}
          gameInstance = null;
        }
        if (typeof Storage !== "undefined" && Storage.reset) Storage.reset();
        state = typeof Storage !== "undefined" && Storage.defaultState ? Storage.defaultState() : { gold: 0, gems: 0, ownedHeroes: [] };
        persist();
        renderCollection();
        showScreen("screen-menu");
        if (typeof SFX !== "undefined" && SFX.uiBack) SFX.uiBack();
      });
    }
    $("btn-cases-back").addEventListener("click", function () {
      showScreen("screen-menu");
    });
    $("btn-collection-back").addEventListener("click", function () {
      showScreen("screen-menu");
    });
    $("btn-game-exit").addEventListener("click", function () {
      if (gameInstance) {
        bankRunGemsFromGame();
        bankSessionGoldFromGame();
        gameInstance.stop();
      }
      showScreen("screen-menu");
      persist();
    });
    $("btn-wave").addEventListener("click", function () {
      if (gameInstance) gameInstance.startWave();
    });
    var autoWaveBtn = $("btn-auto-wave");
    if (autoWaveBtn) {
      autoWaveBtn.addEventListener("click", function () {
        if (!gameInstance) return;
        gameInstance.autoNextWave = !gameInstance.autoNextWave;
        if (!gameInstance.autoNextWave) gameInstance._autoNextWaveTimer = 0;
        if (typeof SFX !== "undefined") SFX.toggle(!!gameInstance.autoNextWave);
        hudUpdate(gameInstance);
      });
    }
    $("overlay-btn").addEventListener("click", function () {
      showScreen("screen-menu");
    });
  }

  function bindCollectionTabs() {
    var th = $("tab-heroes");
    var te = $("tab-enemies");
    if (th) th.addEventListener("click", function () { setCollectionTab("heroes"); });
    if (te) te.addEventListener("click", function () { setCollectionTab("enemies"); });
  }

  function bindUiSounds() {
    var app = $("app");
    if (!app) return;
    app.addEventListener("click", function (ev) {
      if (typeof SFX === "undefined") return;
      var t = ev.target.closest("button, .diff-chip, .tower-btn");
      if (!t) return;
      if (t.id === "btn-auto-wave") return;
      SFX.uiClick();
    });
  }

  function bindPromoCodes() {
    var openBtn = $("btn-promocodes");
    var ov = $("promo-overlay");
    var input = $("promo-input");
    var status = $("promo-status");
    var cancel = $("btn-promo-cancel");
    var apply = $("btn-promo-apply");
    if (!ov || !input || !status || !cancel || !apply || !openBtn) return;

    function setStatus(msg, isError) {
      status.textContent = msg || "";
      status.style.color = isError ? "rgba(248, 113, 113, 0.95)" : "rgba(226, 232, 240, 0.92)";
    }

    function open() {
      ov.classList.remove("hidden");
      ov.setAttribute("aria-hidden", "false");
      setStatus("");
      input.value = "";
      setTimeout(function () {
        input.focus();
        input.select();
      }, 0);
    }

    function close() {
      ov.classList.add("hidden");
      ov.setAttribute("aria-hidden", "true");
      setStatus("");
    }

    function normCode(v) {
      return String(v || "")
        .trim()
        .replace(/\s+/g, "")
        .toUpperCase()
        .slice(0, 32);
    }

    function ensurePromoState() {
      if (!state.redeemedPromos || !Array.isArray(state.redeemedPromos)) state.redeemedPromos = [];
    }

    function applyCode() {
      ensurePromoState();
      var code = normCode(input.value);
      if (!code) {
        setStatus("Введите промокод.", true);
        return;
      }
      var book = (typeof GAME_CONFIG !== "undefined" && GAME_CONFIG.PROMO_CODES) ? GAME_CONFIG.PROMO_CODES : null;
      var entry = book ? book[code] : null;
      if (!entry) {
        setStatus("Промокод не найден или уже недействителен.", true);
        if (typeof SFX !== "undefined" && SFX.uiNope) SFX.uiNope();
        return;
      }
      if (state.redeemedPromos.indexOf(code) >= 0) {
        setStatus("Этот промокод уже активирован.", true);
        if (typeof SFX !== "undefined" && SFX.uiNope) SFX.uiNope();
        return;
      }

      var gold = typeof entry.gold === "number" ? entry.gold : 0;
      var gems = typeof entry.gems === "number" ? entry.gems : 0;
      if (gold > 0) state.gold += gold;
      if (gems > 0) state.gems += gems;
      state.redeemedPromos.push(code);
      persist();

      var title = entry.title ? String(entry.title) : code;
      var msg = "Активировано: " + title + ".";
      var rewards = [];
      if (gold > 0) rewards.push(gold + " золота");
      if (gems > 0) rewards.push(gems + " кристаллов");
      if (rewards.length) msg += " Получено: " + rewards.join(", ") + ".";
      setStatus(msg, false);
      if (typeof SFX !== "undefined" && SFX.caseReveal) SFX.caseReveal();
    }

    openBtn.addEventListener("click", open);
    cancel.addEventListener("click", close);
    apply.addEventListener("click", applyCode);
    ov.addEventListener("click", function (ev) {
      if (ev.target === ov) close();
    });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") applyCode();
      if (ev.key === "Escape") close();
    });
  }

  function initAppLoader() {
    var loader = $("app-loader");
    var minMs = 4200;
    var start = Date.now();
    var hints = [
      "Синхронизация эфира…",
      "Настройка решётки мира…",
      "Калибровка путей врагов…",
      "Почти готово…",
    ];
    var hi = 0;
    var hintEl = $("loader-hint");
    var hintTimer = setInterval(function () {
      hi = (hi + 1) % hints.length;
      if (hintEl) hintEl.textContent = hints[hi];
    }, 1100);

    function finish() {
      clearInterval(hintTimer);
      var elapsed = Date.now() - start;
      var wait = Math.max(0, minMs - elapsed);
      setTimeout(function () {
        document.body.classList.remove("is-loading");
        document.body.classList.add("app-ready");
        if (loader) {
          loader.classList.add("app-loader--done");
          loader.setAttribute("aria-busy", "false");
          loader.setAttribute("aria-hidden", "true");
          var bar = $("loader-bar");
          if (bar) bar.setAttribute("aria-valuenow", "100");
        }
        if (typeof SFX !== "undefined" && SFX.loaderReady) SFX.loaderReady();
        if (typeof SFX !== "undefined" && SFX.bgmSetMode) SFX.bgmSetMode("menu");
        var menu = $("screen-menu");
        if (menu && menu.classList.contains("screen-active")) {
          menu.classList.add("menu-intro");
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              menu.classList.add("menu-intro--play");
            });
          });
          setTimeout(function () {
            menu.classList.remove("menu-intro");
            menu.classList.remove("menu-intro--play");
          }, 2600);
        }
      }, wait);
    }

    if (document.readyState === "complete") {
      finish();
    } else {
      window.addEventListener("load", finish);
    }
  }

  initParticles();
  setupCaseOverlay();
  bindDifficulty();
  bindNav();
  bindUiSounds();
  bindPromoCodes();
  bindCollectionTabs();
  bindCases();
  refreshMenuStats();
  renderCollection();
  initAppLoader();
})();
