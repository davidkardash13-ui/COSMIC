var Cases = (function () {
  function weightedPick(weights) {
    var total = 0;
    for (var i = 0; i < weights.length; i++) total += weights[i].w;
    var r = Math.random() * total;
    var acc = 0;
    for (var j = 0; j < weights.length; j++) {
      acc += weights[j].w;
      if (r <= acc) return weights[j].id;
    }
    return weights[weights.length - 1].id;
  }

  function rollRarity(caseType) {
    if (caseType === "common") {
      return weightedPick([
        { id: "common", w: 58 },
        { id: "rare", w: 32 },
        { id: "epic", w: 8 },
        { id: "legendary", w: 2 },
      ]);
    }
    if (caseType === "rare") {
      return weightedPick([
        { id: "rare", w: 45 },
        { id: "epic", w: 40 },
        { id: "legendary", w: 15 },
      ]);
    }
    if (caseType === "legendary") {
      return weightedPick([
        { id: "epic", w: 35 },
        { id: "legendary", w: 65 },
      ]);
    }
    return "common";
  }

  function heroesOfRarity(r) {
    var out = [];
    for (var i = 0; i < HEROES.length; i++) {
      if (HEROES[i].rarity === r) out.push(HEROES[i]);
    }
    return out;
  }

  function randomHeroOfRarity(r) {
    var list = heroesOfRarity(r);
    if (!list.length) return null;
    return list[(Math.random() * list.length) | 0];
  }

  /**
   * Для legendary кейса гарантируем минимум rare если выпала только common (не должно)
   */
  function open(caseType, ownedSet) {
    var rarity;
    var hero;

    rarity = rollRarity(caseType);
    if (caseType === "legendary" && rarity === "common") rarity = "rare";
    hero = randomHeroOfRarity(rarity);
    if (!hero) {
      rarity = "common";
      hero = randomHeroOfRarity("common");
    }

    if (!hero) {
      rarity = "common";
      hero = randomHeroOfRarity("common");
    }

    if (!hero) {
      return {
        hero: null,
        duplicate: false,
        compensation: 0,
        compensationType: "gold",
      };
    }

    var duplicate = ownedSet[hero.id];
    var compensation = 0;
    var compensationType = "gold";

    if (duplicate) {
      if (hero.rarity === "legendary") {
        compensation = 80;
        compensationType = "gems";
      } else if (hero.rarity === "epic") {
        compensation = 35;
        compensationType = "gems";
      } else if (hero.rarity === "rare") {
        compensation = 60;
        compensationType = "gold";
      } else {
        compensation = 25;
        compensationType = "gold";
      }
    }

    return {
      hero: hero,
      duplicate: duplicate,
      compensation: compensation,
      compensationType: compensationType,
    };
  }

  function canAfford(state, caseType) {
    if (caseType === "common") return state.gold >= 150;
    if (caseType === "rare") return state.gems >= 40;
    if (caseType === "legendary") return state.gems >= 120;
    return false;
  }

  function pay(state, caseType) {
    var next = {
      gold: state.gold,
      gems: state.gems,
      ownedHeroes: state.ownedHeroes.slice(),
      highestWave: state.highestWave,
      gamesWon: state.gamesWon,
    };
    if (caseType === "common") next.gold -= 150;
    else if (caseType === "rare") next.gems -= 40;
    else if (caseType === "legendary") next.gems -= 120;
    return next;
  }

  return { open: open, canAfford: canAfford, pay: pay };
})();
