var Storage = (function () {
  var KEY = "aether-guard-td-v1";

  function defaultState() {
    return {
      gold: 520,
      gems: 100,
      ownedHeroes: [],
      redeemedPromos: [],
      collectionTab: "heroes",
      highestWave: 0,
      gamesWon: 0,
      difficulty: "normal",
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
        highestWave: typeof s.highestWave === "number" ? s.highestWave : d.highestWave,
        gamesWon: typeof s.gamesWon === "number" ? s.gamesWon : d.gamesWon,
        difficulty:
          s.difficulty === "easy" || s.difficulty === "normal" || s.difficulty === "hard" ? s.difficulty : d.difficulty,
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
