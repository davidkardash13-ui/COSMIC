var Storage = (function () {
  var KEY = "aether-guard-td-v1";

  function defaultState() {
    return {
      gold: 520,
      gems: 100,
      ownedHeroes: [],
      redeemedPromos: [],
      collectionTab: "heroes",
      questsTab: "daily",
      highestWave: 0,
      gamesWon: 0,
      difficulty: "normal",
      questsDayKey: "",
      questsWeekKey: "",
      questsMonthKey: "",
      dailyWins: 0,
      dailyCasesOpened: 0,
      dailyBestWave: 0,
      weeklyWins: 0,
      weeklyBestWave: 0,
      weeklyCasesOpened: 0,
      monthlyWins: 0,
      monthlyCasesOpened: 0,
      questRewardClaims: [],
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      var s = JSON.parse(raw);
      var d = defaultState();
      return {
        gold: typeof s.gold === "number" ? s.gold : d.gold,
        gems: typeof s.gems === "number" ? s.gems : d.gems,
        ownedHeroes: Array.isArray(s.ownedHeroes) ? s.ownedHeroes : d.ownedHeroes,
        redeemedPromos: Array.isArray(s.redeemedPromos) ? s.redeemedPromos : d.redeemedPromos,
        collectionTab: s.collectionTab === "enemies" ? "enemies" : d.collectionTab,
        questsTab:
          s.questsTab === "weekly" || s.questsTab === "monthly" || s.questsTab === "daily" ? s.questsTab : d.questsTab,
        highestWave: typeof s.highestWave === "number" ? s.highestWave : d.highestWave,
        gamesWon: typeof s.gamesWon === "number" ? s.gamesWon : d.gamesWon,
        difficulty:
          s.difficulty === "easy" || s.difficulty === "normal" || s.difficulty === "hard" ? s.difficulty : d.difficulty,
        questsDayKey: typeof s.questsDayKey === "string" ? s.questsDayKey : d.questsDayKey,
        questsWeekKey: typeof s.questsWeekKey === "string" ? s.questsWeekKey : d.questsWeekKey,
        questsMonthKey: typeof s.questsMonthKey === "string" ? s.questsMonthKey : d.questsMonthKey,
        dailyWins: typeof s.dailyWins === "number" ? s.dailyWins : d.dailyWins,
        dailyCasesOpened: typeof s.dailyCasesOpened === "number" ? s.dailyCasesOpened : d.dailyCasesOpened,
        dailyBestWave: typeof s.dailyBestWave === "number" ? s.dailyBestWave : d.dailyBestWave,
        weeklyWins: typeof s.weeklyWins === "number" ? s.weeklyWins : d.weeklyWins,
        weeklyBestWave: typeof s.weeklyBestWave === "number" ? s.weeklyBestWave : d.weeklyBestWave,
        weeklyCasesOpened: typeof s.weeklyCasesOpened === "number" ? s.weeklyCasesOpened : d.weeklyCasesOpened,
        monthlyWins: typeof s.monthlyWins === "number" ? s.monthlyWins : d.monthlyWins,
        monthlyCasesOpened: typeof s.monthlyCasesOpened === "number" ? s.monthlyCasesOpened : d.monthlyCasesOpened,
        questRewardClaims: Array.isArray(s.questRewardClaims) ? s.questRewardClaims : d.questRewardClaims,
      };
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function reset() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {}
  }

  return { load: load, save: save, reset: reset, defaultState: defaultState };
})();
