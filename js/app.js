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

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function dateKeyLocal() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function monthKeyLocal() {
    return dateKeyLocal().slice(0, 7);
  }

  function weekPeriodKey() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    var day = d.getDay();
    var diff = d.getDate() - day + (day === 0 ? -6 : 1);
    var monday = new Date(d.getFullYear(), d.getMonth(), diff);
    return monday.getFullYear() + "-" + pad2(monday.getMonth() + 1) + "-" + pad2(monday.getDate());
  }

  function ensureQuestPeriods(s) {
    if (!s) return;
    var dk = dateKeyLocal();
    var wk = weekPeriodKey();
    var mk = monthKeyLocal();
    if (s.questsDayKey !== dk) {
      s.questsDayKey = dk;
      s.dailyWins = 0;
      s.dailyCasesOpened = 0;
      s.dailyBestWave = 0;
    }
    if (s.questsWeekKey !== wk) {
      s.questsWeekKey = wk;
      s.weeklyWins = 0;
      s.weeklyBestWave = 0;
      s.weeklyCasesOpened = 0;
    }
    if (s.questsMonthKey !== mk) {
      s.questsMonthKey = mk;
      s.monthlyWins = 0;
      s.monthlyCasesOpened = 0;
    }
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
    ensureQuestPeriods(state);
    processQuestRewards();
    Storage.save(state);
    refreshMenuStats();
    if ($("quests-list-daily")) renderQuests();
  }

  var QUESTS_DAILY = [
    {
      id: "d-win",
      title: "Победа дня",
      desc: "Выиграйте хотя бы один полный забег сегодня (счётчик сбрасывается в полночь по локальному времени).",
      rewardGold: 55,
      rewardGems: 3,
      max: 1,
      cur: function (s) {
        return Math.min(s.dailyWins || 0, 1);
      },
      done: function (s) {
        return (s.dailyWins || 0) >= 1;
      },
    },
    {
      id: "d-cases",
      title: "Сундуки дня",
      desc: "Откройте 2 сундука с героями за сегодня.",
      rewardGold: 55,
      rewardGems: 3,
      max: 2,
      cur: function (s) {
        return Math.min(s.dailyCasesOpened || 0, 2);
      },
      done: function (s) {
        return (s.dailyCasesOpened || 0) >= 2;
      },
    },
    {
      id: "d-wave",
      title: "Волна дня",
      desc: "В любом забеге сегодня дойдите хотя бы до 5-й волны.",
      rewardGold: 70,
      rewardGems: 4,
      max: 5,
      cur: function (s) {
        return Math.min(s.dailyBestWave || 0, 5);
      },
      done: function (s) {
        return (s.dailyBestWave || 0) >= 5;
      },
    },
  ];

  var QUESTS_WEEKLY = [
    {
      id: "w-wins",
      title: "Серия побед",
      desc: "Одолейте все волны в 3 разных забегах за календарную неделю (от понедельника).",
      rewardGold: 140,
      rewardGems: 10,
      max: 3,
      cur: function (s) {
        return Math.min(s.weeklyWins || 0, 3);
      },
      done: function (s) {
        return (s.weeklyWins || 0) >= 3;
      },
    },
    {
      id: "w-wave",
      title: "Глубина недели",
      desc: "За эту неделю в любом забеге достигните 10-й волны (лучший результат недели).",
      rewardGold: 180,
      rewardGems: 14,
      max: 10,
      cur: function (s) {
        return Math.min(s.weeklyBestWave || 0, 10);
      },
      done: function (s) {
        return (s.weeklyBestWave || 0) >= 10;
      },
    },
    {
      id: "w-cases",
      title: "Сундуки недели",
      desc: "Откройте 5 сундуков за неделю.",
      rewardGold: 160,
      rewardGems: 12,
      max: 5,
      cur: function (s) {
        return Math.min(s.weeklyCasesOpened || 0, 5);
      },
      done: function (s) {
        return (s.weeklyCasesOpened || 0) >= 5;
      },
    },
  ];

  var QUESTS_MONTHLY = [
    {
      id: "m-wins",
      title: "Месяц побед",
      desc: "Одолейте все волны в 8 забегах за текущий календарный месяц.",
      rewardGold: 320,
      rewardGems: 28,
      max: 8,
      cur: function (s) {
        return Math.min(s.monthlyWins || 0, 8);
      },
      done: function (s) {
        return (s.monthlyWins || 0) >= 8;
      },
    },
    {
      id: "m-cases",
      title: "Сундуки месяца",
      desc: "Откройте 12 сундуков за месяц.",
      rewardGold: 380,
      rewardGems: 32,
      max: 12,
      cur: function (s) {
        return Math.min(s.monthlyCasesOpened || 0, 12);
      },
      done: function (s) {
        return (s.monthlyCasesOpened || 0) >= 12;
      },
    },
    {
      id: "m-wave",
      title: "Рекордный рубеж",
      desc: "Достигните в одном забеге волны 25 или выше (общий рекорд, не сбрасывается).",
      rewardGold: 450,
      rewardGems: 40,
      max: 25,
      cur: function (s) {
        return Math.min(s.highestWave || 0, 25);
      },
      done: function (s) {
        return (s.highestWave || 0) >= 25;
      },
    },
  ];

  function questClaimKey(period, questId) {
    if (period === "daily") return "daily:" + questId + ":" + dateKeyLocal();
    if (period === "weekly") return "weekly:" + questId + ":" + weekPeriodKey();
    return "monthly:" + questId + ":" + monthKeyLocal();
  }

  function isQuestRewardClaimed(period, questId) {
    var key = questClaimKey(period, questId);
    var arr = state.questRewardClaims || [];
    return arr.indexOf(key) !== -1;
  }

  function processQuestRewards() {
    if (!state.questRewardClaims) state.questRewardClaims = [];
    var claims = state.questRewardClaims;
    function grant(period, list) {
      for (var i = 0; i < list.length; i++) {
        var q = list[i];
        if (!q.done(state)) continue;
        var key = questClaimKey(period, q.id);
        if (claims.indexOf(key) !== -1) continue;
        claims.push(key);
        state.gold += typeof q.rewardGold === "number" ? q.rewardGold : 0;
        state.gems += typeof q.rewardGems === "number" ? q.rewardGems : 0;
      }
    }
    grant("daily", QUESTS_DAILY);
    grant("weekly", QUESTS_WEEKLY);
    grant("monthly", QUESTS_MONTHLY);
  }

  function formatQuestRewardLine(q) {
    var parts = [];
    if (q.rewardGold) parts.push('<span class="quest-reward-gold">' + q.rewardGold + "</span> зол.");
    if (q.rewardGems) parts.push('<span class="quest-reward-gem">' + q.rewardGems + "</span> крист.");
    return parts.length ? parts.join(" · ") : "";
  }

  function renderQuestList(root, meta, period) {
    if (!root || !meta) return;
    root.innerHTML = "";
    for (var i = 0; i < meta.length; i++) {
      var q = meta[i];
      var done = q.done(state);
      var claimed = isQuestRewardClaimed(period, q.id);
      var cur = q.cur(state);
      var max = q.max;
      var pct = max > 0 ? Math.round((Math.min(cur, max) / max) * 100) : 0;
      var rewardHtml = formatQuestRewardLine(q);
      var rewardStatus =
        done && claimed
          ? '<span class="quest-reward-status quest-reward-status--claimed">Награда зачислена</span>'
          : "";
      var card = document.createElement("article");
      card.className =
        "quest-card" +
        (done ? " quest-card--done" : "") +
        (done && claimed ? " quest-card--claimed" : "");
      card.setAttribute("data-quest", q.id);
      card.innerHTML =
        '<div class="quest-card-head">' +
        '<h3 class="quest-title">' +
        q.title +
        "</h3>" +
        (done
          ? '<span class="quest-badge quest-badge--done">Выполнено</span>'
          : '<span class="quest-badge">В процессе</span>') +
        "</div>" +
        '<p class="quest-desc">' +
        q.desc +
        "</p>" +
        (rewardHtml
          ? '<p class="quest-reward">Награда: ' + rewardHtml + "</p>" + rewardStatus
          : "") +
        '<div class="quest-progress" role="progressbar" aria-valuemin="0" aria-valuemax="' +
        max +
        '" aria-valuenow="' +
        Math.min(cur, max) +
        '"' +
        (done ? ' aria-label="Прогресс: выполнено"' : "") +
        ">" +
        '<div class="quest-progress-fill" style="width:' +
        pct +
        '%"></div>' +
        "</div>" +
        '<p class="quest-progress-label">' +
        Math.min(cur, max) +
        " / " +
        max +
        "</p>";
      root.appendChild(card);
    }
  }

  function syncQuestsTabUi() {
    var tab = state.questsTab === "weekly" || state.questsTab === "monthly" ? state.questsTab : "daily";
    var bd = $("tab-quests-daily");
    var bw = $("tab-quests-weekly");
    var bm = $("tab-quests-monthly");
    var pd = $("quests-panel-daily");
    var pw = $("quests-panel-weekly");
    var pm = $("quests-panel-monthly");
    if (bd) {
      bd.classList.toggle("is-active", tab === "daily");
      bd.setAttribute("aria-selected", tab === "daily" ? "true" : "false");
    }
    if (bw) {
      bw.classList.toggle("is-active", tab === "weekly");
      bw.setAttribute("aria-selected", tab === "weekly" ? "true" : "false");
    }
    if (bm) {
      bm.classList.toggle("is-active", tab === "monthly");
      bm.setAttribute("aria-selected", tab === "monthly" ? "true" : "false");
    }
    if (pd) pd.classList.toggle("hidden", tab !== "daily");
    if (pw) pw.classList.toggle("hidden", tab !== "weekly");
    if (pm) pm.classList.toggle("hidden", tab !== "monthly");
  }

  function setQuestsTab(tab) {
    tab = tab === "weekly" ? "weekly" : tab === "monthly" ? "monthly" : "daily";
    state.questsTab = tab;
    persist();
  }

  function renderQuests() {
    ensureQuestPeriods(state);
    renderQuestList($("quests-list-daily"), QUESTS_DAILY, "daily");
    renderQuestList($("quests-list-weekly"), QUESTS_WEEKLY, "weekly");
    renderQuestList($("quests-list-monthly"), QUESTS_MONTHLY, "monthly");
    syncQuestsTabUi();
  }

  function refreshVersionLabels() {
    var v =
      typeof GAME_CONFIG !== "undefined" && GAME_CONFIG.APP_VERSION
        ? String(GAME_CONFIG.APP_VERSION)
        : "0.0.0";
    var label = "V-" + v;
    var el = $("app-version");
    if (el) el.textContent = label;
    var lv = $("loader-version");
    if (lv) lv.textContent = label;
  }

  function bindQuestsTabs() {
    var td = $("tab-quests-daily");
    var tw = $("tab-quests-weekly");
    var tm = $("tab-quests-monthly");
    if (td) td.addEventListener("click", function () { setQuestsTab("daily"); });
    if (tw) tw.addEventListener("click", function () { setQuestsTab("weekly"); });
    if (tm) tm.addEventListener("click", function () { setQuestsTab("monthly"); });
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
        ensureQuestPeriods(state);
        state.dailyCasesOpened = (state.dailyCasesOpened || 0) + 1;
        state.weeklyCasesOpened = (state.weeklyCasesOpened || 0) + 1;
        state.monthlyCasesOpened = (state.monthlyCasesOpened || 0) + 1;
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
      gameMode: opts.gameMode || state.gameMode || "defense",
    });
    gameInstance.setOwnedHeroes(state.ownedHeroes);
    gameInstance.onUiUpdate = function () {
      hudUpdate(gameInstance);
    };
    gameInstance.onEnd = function (res) {
      var waveReached = gameInstance.waveIndex;
      ensureQuestPeriods(state);
      if (typeof waveReached === "number") {
        if (waveReached > (state.dailyBestWave || 0)) state.dailyBestWave = waveReached;
        if (waveReached > (state.weeklyBestWave || 0)) state.weeklyBestWave = waveReached;
      }
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
        state.dailyWins = (state.dailyWins || 0) + 1;
        state.weeklyWins = (state.weeklyWins || 0) + 1;
        state.monthlyWins = (state.monthlyWins || 0) + 1;
        if (waveReached > (state.highestWave || 0)) state.highestWave = waveReached;
        persist();
        if (title) title.textContent = "Победа!";
        if (text) {
          var gm = (gameInstance && gameInstance.gameMode) || state.gameMode || "defense";
          var baseMsg =
            gm === "raid"
              ? "Все 30 волн пройдены. Золото и кристаллы зачислены. В режиме «Рейд» каждая волна — один усиливающийся босс."
              : "Все 30 волн пройдены. Золото и кристаллы зачислены. На волнах 10, 20 и 30 — по два босса.";
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

  function syncGameModeUi() {
    var m = state.gameMode || "defense";
    var chips = document.querySelectorAll(".diff-chip[data-gamemode]");
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle("diff-chip--active", chips[i].getAttribute("data-gamemode") === m);
    }
  }

  function bindDifficulty() {
    var chips = document.querySelectorAll(".diff-chip");
    for (var i = 0; i < chips.length; i++) {
      chips[i].addEventListener("click", function () {
        var gm = this.getAttribute("data-gamemode");
        if (gm) {
          state.gameMode = gm;
          syncGameModeUi();
          persist();
          return;
        }
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
    syncGameModeUi();
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
    var btnQuests = $("btn-quests");
    if (btnQuests) {
      btnQuests.addEventListener("click", function () {
        renderQuests();
        showScreen("screen-quests");
      });
    }
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
    var btnQuestsBack = $("btn-quests-back");
    if (btnQuestsBack) {
      btnQuestsBack.addEventListener("click", function () {
        showScreen("screen-menu");
      });
    }
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
  bindQuestsTabs();
  bindCases();
  refreshVersionLabels();
  ensureQuestPeriods(state);
  processQuestRewards();
  Storage.save(state);
  refreshMenuStats();
  renderCollection();
  renderQuests();
  initAppLoader();
})();
