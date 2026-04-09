var TDGame = (function () {
  var GW = 24;
  var GH = 13;
  var TILE = 40;
  var CW = GW * TILE;
  var CH = GH * TILE;
  /** Уровни улучшения: 0 = база, макс. 2 (три визуальных яруса) */
  var TOWER_UPGRADE_MAX = 2;

  /** Запасной фиксированный маршрут, если случайная генерация не удалась */
  function buildPathTilesFallback() {
    var tiles = [];
    var x, y;
    for (x = 0; x <= 11; x++) tiles.push([x, 6]);
    for (y = 5; y >= 2; y--) tiles.push([11, y]);
    for (x = 12; x <= 20; x++) tiles.push([x, 2]);
    for (y = 3; y <= 9; y++) tiles.push([20, y]);
    for (x = 21; x <= 23; x++) tiles.push([x, 9]);
    return tiles;
  }

  function shuffleInPlace(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function appendPathTile(path, x, y) {
    var last = path[path.length - 1];
    if (last && last[0] === x && last[1] === y) return;
    path.push([x, y]);
  }

  function pathHorizontalSegment(path, x0, x1, y) {
    var a = Math.min(x0, x1),
      b = Math.max(x0, x1);
    for (var x = a; x <= b; x++) appendPathTile(path, x, y);
  }

  function pathVerticalSegment(path, x, y0, y1) {
    var a = Math.min(y0, y1),
      b = Math.max(y0, y1);
    for (var y = a; y <= b; y++) appendPathTile(path, x, y);
  }

  /**
   * Случайный ортогональный путь слева направо: горизонтальные участки с «ступеньками»
   * по вертикали между колонками (без самопересечений).
   */
  function randomPathTiles() {
    var rng = Math.random;
    var minLen = 26;
    var maxAttempts = 100;
    var pool = [];
    var px;
    for (px = 2; px <= GW - 3; px++) pool.push(px);

    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      var numSeg = 3 + Math.floor(rng() * 4);
      var interiorCount = numSeg - 1;
      var xs = [0];
      if (interiorCount > 0) {
        var poolCopy = pool.slice();
        shuffleInPlace(poolCopy, rng);
        var take = Math.min(interiorCount, poolCopy.length);
        for (var pi = 0; pi < take; pi++) xs.push(poolCopy[pi]);
      }
      xs.push(GW - 1);
      xs.sort(function (a, b) {
        return a - b;
      });
      var uniq = [xs[0]];
      for (var i = 1; i < xs.length; i++) {
        if (xs[i] > uniq[uniq.length - 1]) uniq.push(xs[i]);
      }
      xs = uniq;
      if (xs[xs.length - 1] !== GW - 1) xs.push(GW - 1);
      if (xs[0] !== 0) xs.unshift(0);
      xs.sort(function (a, b) {
        return a - b;
      });
      uniq = [xs[0]];
      for (var i2 = 1; i2 < xs.length; i2++) {
        if (xs[i2] > uniq[uniq.length - 1]) uniq.push(xs[i2]);
      }
      xs = uniq;

      var k = xs.length - 1;
      if (k < 1) continue;

      var sy = 2 + Math.floor(rng() * (GH - 4));
      var ey = 2 + Math.floor(rng() * (GH - 4));
      var ys = [];
      ys[0] = sy;
      for (var j = 1; j < k; j++) ys[j] = 1 + Math.floor(rng() * (GH - 2));
      ys[k] = ey;

      var path = [];
      for (var seg = 0; seg < k; seg++) {
        pathHorizontalSegment(path, xs[seg], xs[seg + 1], ys[seg]);
        pathVerticalSegment(path, xs[seg + 1], ys[seg], ys[seg + 1]);
      }

      if (path.length < minLen) continue;

      var seen = {};
      var valid = true;
      for (var t = 0; t < path.length; t++) {
        var cell = path[t];
        var key = cell[0] + "," + cell[1];
        if (seen[key]) {
          valid = false;
          break;
        }
        seen[key] = true;
      }
      if (!valid) continue;

      for (t = 1; t < path.length; t++) {
        var dx = Math.abs(path[t][0] - path[t - 1][0]);
        var dy = Math.abs(path[t][1] - path[t - 1][1]);
        if (dx + dy !== 1) {
          valid = false;
          break;
        }
      }
      if (!valid) continue;

      return path;
    }

    return buildPathTilesFallback();
  }

  function validateOrthogonalPath(tiles) {
    if (tiles.length < 2) return true;
    for (var i = 1; i < tiles.length; i++) {
      var dx = Math.abs(tiles[i][0] - tiles[i - 1][0]);
      var dy = Math.abs(tiles[i][1] - tiles[i - 1][1]);
      if (dx + dy !== 1) return false;
    }
    return true;
  }

  function pathHasNoRevisit(tiles) {
    var seen = {};
    for (var i = 0; i < tiles.length; i++) {
      var k = tiles[i][0] + "," + tiles[i][1];
      if (seen[k]) return false;
      seen[k] = true;
    }
    return true;
  }

  /** Префикс от (0, spawnY) к mergeCell, затем хвост основного пути после точки слияния */
  function buildLaneFromSpawn(baseTiles, mergeIdx, spawnY) {
    var mergeCell = baseTiles[mergeIdx];
    var mx = mergeCell[0],
      my = mergeCell[1];
    var prefix = [];
    pathHorizontalSegment(prefix, 0, mx, spawnY);
    if (spawnY !== my) pathVerticalSegment(prefix, mx, spawnY, my);
    var full = prefix.slice();
    for (var i = mergeIdx + 1; i < baseTiles.length; i++) {
      appendPathTile(full, baseTiles[i][0], baseTiles[i][1]);
    }
    return full;
  }

  /**
   * 1–3 полосы: общий «ствол» после первой точки на стартовой строке с x ≥ 3.
   * Каждая полоса — свой ряд входа слева, слияние в mergeCell.
   */
  function buildMultiLanePath(rng) {
    var baseTiles = randomPathTiles();
    var wp0 = pixelWaypointsFromTiles(baseTiles);
    var pm0 = buildPathModel(wp0);
    var singleLane = function () {
      var pk = buildPathKeyFromTiles(baseTiles);
      return finalizeWithCave(baseTiles, pk, [{ waypoints: wp0, pathModel: pm0 }], rng);
    };

    var numLanes = 1 + Math.floor(rng() * 3);
    if (numLanes <= 1) return singleLane();

    var sy0 = baseTiles[0][1];
    var mergeIdx = -1;
    for (var i = 0; i < baseTiles.length; i++) {
      if (baseTiles[i][1] === sy0 && baseTiles[i][0] >= 3) {
        mergeIdx = i;
        break;
      }
    }
    if (mergeIdx < 1) return singleLane();

    var spawnRows = [sy0];
    var guard = 0;
    while (spawnRows.length < numLanes && guard++ < 60) {
      var y = 1 + Math.floor(rng() * (GH - 2));
      if (spawnRows.indexOf(y) === -1) spawnRows.push(y);
    }
    numLanes = spawnRows.length;
    if (numLanes <= 1) return singleLane();

    var lanes = [];
    var allKeys = {};
    for (var L = 0; L < numLanes; L++) {
      var tiles = buildLaneFromSpawn(baseTiles, mergeIdx, spawnRows[L]);
      if (!validateOrthogonalPath(tiles) || !pathHasNoRevisit(tiles)) {
        return singleLane();
      }
      var wp = pixelWaypointsFromTiles(tiles);
      lanes.push({ waypoints: wp, pathModel: buildPathModel(wp) });
      for (var t = 0; t < tiles.length; t++) {
        var c = tiles[t];
        allKeys[c[0] + "," + c[1]] = true;
      }
    }

    return finalizeWithCave(baseTiles, allKeys, lanes, rng);
  }

  /**
   * Ответвление «пещера»: прямой туннель в пустые клетки от точки на основном пути.
   * Враги выходят из глубины пещеры к дороге и дальше по стволу. Редкие спавны — в _spawnOne.
   */
  function tryAddCaveLane(baseTiles, pathKey, rng) {
    if (baseTiles.length < 18) return null;
    var minI = Math.max(5, Math.floor(baseTiles.length * 0.4));
    var maxI = Math.min(baseTiles.length - 5, Math.floor(baseTiles.length * 0.68));
    if (maxI <= minI) return null;
    var attempt, branchIdx, bx, by, di, dx, dy, len, step, nx, ny, spur, walk, ri, ti, wp, pm, caveOnlyKey, si;
    for (attempt = 0; attempt < 45; attempt++) {
      branchIdx = minI + Math.floor(rng() * (maxI - minI + 1));
      bx = baseTiles[branchIdx][0];
      by = baseTiles[branchIdx][1];
      var dirs = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ];
      shuffleInPlace(dirs, rng);
      for (di = 0; di < 4; di++) {
        dx = dirs[di][0];
        dy = dirs[di][1];
        len = 5 + Math.floor(rng() * 3);
        spur = [[bx, by]];
        for (step = 1; step <= len; step++) {
          nx = bx + dx * step;
          ny = by + dy * step;
          if (nx < 1 || ny < 1 || nx >= GW - 1 || ny >= GH - 1) break;
          if (pathKey[nx + "," + ny]) break;
          spur.push([nx, ny]);
        }
        if (spur.length < 6) continue;
        walk = [];
        for (ri = spur.length - 1; ri >= 0; ri--) appendPathTile(walk, spur[ri][0], spur[ri][1]);
        for (ti = branchIdx + 1; ti < baseTiles.length; ti++) appendPathTile(walk, baseTiles[ti][0], baseTiles[ti][1]);
        if (!validateOrthogonalPath(walk) || !pathHasNoRevisit(walk)) continue;
        wp = pixelWaypointsFromTiles(walk);
        pm = buildPathModel(wp);
        caveOnlyKey = {};
        for (si = 1; si < spur.length; si++) caveOnlyKey[spur[si][0] + "," + spur[si][1]] = true;
        return {
          caveLane: { waypoints: wp, pathModel: pm, isCave: true },
          spurTiles: spur,
          caveOnlyKey: caveOnlyKey,
        };
      }
    }
    return null;
  }

  function finalizeWithCave(baseTiles, pathKey, lanes, rng) {
    var caveOut = tryAddCaveLane(baseTiles, pathKey, rng);
    if (!caveOut) {
      return { pathKey: pathKey, lanes: lanes, caveLane: null, caveOnlyKey: {} };
    }
    var ci;
    for (ci = 1; ci < caveOut.spurTiles.length; ci++) {
      var cc = caveOut.spurTiles[ci];
      pathKey[cc[0] + "," + cc[1]] = true;
    }
    return {
      pathKey: pathKey,
      lanes: lanes,
      caveLane: caveOut.caveLane,
      caveOnlyKey: caveOut.caveOnlyKey,
    };
  }

  function buildPathKeyFromTiles(tiles) {
    var pk = {};
    for (var pi = 0; pi < tiles.length; pi++) {
      var p = tiles[pi];
      pk[p[0] + "," + p[1]] = true;
    }
    return pk;
  }

  function pixelWaypointsFromTiles(tiles) {
    var pts = [];
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      pts.push({ x: t[0] * TILE + TILE / 2, y: t[1] * TILE + TILE / 2 });
    }
    return pts;
  }

  function dist(ax, ay, bx, by) {
    var dx = ax - bx,
      dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function distPointToSegment(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1,
      dy = y2 - y1;
    var len2 = dx * dx + dy * dy || 1;
    var t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    var nx = x1 + t * dx,
      ny = y1 + t * dy;
    var ddx = px - nx,
      ddy = py - ny;
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }

  function enemiesNearPoint(game, x, y, rad, exclude) {
    var out = [];
    for (var i = 0; i < game.enemies.length; i++) {
      var e = game.enemies[i];
      if (exclude && e === exclude) continue;
      if (dist(e.x, e.y, x, y) <= rad + e.r) out.push(e);
    }
    out.sort(function (a, b) {
      return dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y);
    });
    return out;
  }

  function findNearestEnemyExcept(game, x, y, maxD, exclude) {
    var best = null,
      bd = maxD;
    for (var i = 0; i < game.enemies.length; i++) {
      var e = game.enemies[i];
      if (e === exclude) continue;
      var d = dist(x, y, e.x, e.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  function buildPathModel(waypoints) {
    var segs = [];
    var total = 0;
    for (var i = 0; i < waypoints.length - 1; i++) {
      var a = waypoints[i],
        b = waypoints[i + 1];
      var len = dist(a.x, a.y, b.x, b.y);
      segs.push({ a: a, b: b, len: len });
      total += len;
    }
    return { segs: segs, total: total };
  }

  function posAtDistance(segs, d) {
    if (!segs.length) return { x: 0, y: 0 };
    var remaining = d;
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      if (remaining <= s.len) {
        var t = s.len > 0 ? remaining / s.len : 0;
        return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
      }
      remaining -= s.len;
    }
    var last = segs[segs.length - 1];
    return { x: last.b.x, y: last.b.y };
  }

  /**
   * Множители к базовым статам башни из heroes.js: чем выше редкость героя, тем сильнее башня в бою (и дороже).
   */
  function towerRarityScale(rarity) {
    var tiers = {
      common: { cost: 1, damage: 1, range: 1, cooldown: 1, splash: 1, slow: 1 },
      rare: { cost: 1.04, damage: 1.06, range: 1.03, cooldown: 0.98, splash: 1.05, slow: 1.04 },
      epic: { cost: 1.08, damage: 1.12, range: 1.06, cooldown: 0.95, splash: 1.1, slow: 1.07 },
      legendary: { cost: 1.12, damage: 1.18, range: 1.09, cooldown: 0.92, splash: 1.14, slow: 1.1 },
      mythical: { cost: 1.16, damage: 1.24, range: 1.12, cooldown: 0.88, splash: 1.18, slow: 1.13 },
      verdant: { cost: 1.2, damage: 1.3, range: 1.15, cooldown: 0.85, splash: 1.22, slow: 1.16 },
    };
    return tiers[rarity] || tiers.common;
  }

  function buildTowerTypes() {
    var out = [];
    for (var i = 0; i < HEROES.length; i++) {
      var h = HEROES[i];
      if (!h.tower) continue;
      var t = h.tower;
      var sc = towerRarityScale(h.rarity || "common");
      var cd = Math.max(12, Math.round(t.cooldown * sc.cooldown));
      var spl = t.splash ? Math.max(0, Math.round(t.splash * sc.splash)) : 0;
      var sl = t.slow ? Math.min(0.92, t.slow * sc.slow) : 0;
      out.push({
        id: h.id,
        heroId: h.id,
        heroRarity: h.rarity || "common",
        name: t.name,
        cost: Math.max(45, Math.round(t.cost * sc.cost)),
        range: Math.max(40, Math.round(t.range * sc.range)),
        damage: Math.max(1, Math.round(t.damage * sc.damage)),
        cooldown: cd,
        color: t.color,
        splash: spl,
        slow: sl,
        mechanic: t.mechanic || "standard",
        mechanicDesc: t.mechanicDesc || "",
      });
    }
    // Экономические башни (фермы): не атакуют, доход за пройденную волну.
    var farmList = [
      {
        id: "farm",
        name: "Ферма",
        cost: 120,
        color: "#22c55e",
        incomePerWave: 18,
        farmStyle: "rhombus",
        desc: "Базовый доход за волну.",
      },
      {
        id: "farm_pond",
        name: "Рыбный пруд",
        cost: 138,
        color: "#0ea5e9",
        incomePerWave: 21,
        farmStyle: "pond",
        desc: "Умеренный доход, компактная постройка.",
      },
      {
        id: "farm_vineyard",
        name: "Виноградник",
        cost: 165,
        color: "#7c3aed",
        incomePerWave: 26,
        farmStyle: "vine",
        desc: "Выше доход за волну.",
      },
      {
        id: "farm_granary",
        name: "Амбар",
        cost: 198,
        color: "#ca8a04",
        incomePerWave: 34,
        farmStyle: "granary",
        desc: "Максимальный пассивный доход.",
      },
    ];
    for (var fi = 0; fi < farmList.length; fi++) {
      var fd = farmList[fi];
      out.push({
        id: fd.id,
        heroId: null,
        alwaysUnlocked: true,
        name: fd.name,
        cost: fd.cost,
        range: 0,
        damage: 0,
        cooldown: 999999,
        color: fd.color,
        splash: 0,
        slow: 0,
        mechanic: "farm",
        mechanicDesc: "Не атакует. +" + fd.incomePerWave + " зол. за пройденную волну (растёт с улучшением). " + fd.desc,
        incomePerWave: fd.incomePerWave,
        farmStyle: fd.farmStyle,
      });
    }
    return out;
  }

  var TOWER_TYPES = buildTowerTypes();

  var ENEMY_KINDS = {
    grunt: { hpMul: 1, speedMul: 1, armorAdd: 0, rewardMul: 1, r: 11, color: "#c084fc", slowResist: 0 },
    runner: { hpMul: 0.52, speedMul: 1.62, armorAdd: 0, rewardMul: 0.88, r: 9, color: "#f472b6", slowResist: 0.12 },
    brute: { hpMul: 1.72, speedMul: 0.66, armorAdd: 0.07, rewardMul: 1.18, r: 14, color: "#94a3b8", slowResist: 0 },
    wraith: { hpMul: 0.82, speedMul: 1.12, armorAdd: 0, rewardMul: 1.02, r: 10, color: "#67e8f9", slowResist: 0.52 },
    plated: { hpMul: 1.38, speedMul: 0.76, armorAdd: 0.2, rewardMul: 1.28, r: 13, color: "#a8a29e", slowResist: 0.08 },
    swarmling: { hpMul: 0.26, speedMul: 1.92, armorAdd: 0, rewardMul: 0.42, r: 7, color: "#86efac", slowResist: 0.05 },
    charger: { hpMul: 0.72, speedMul: 1.48, armorAdd: 0, rewardMul: 0.95, r: 10, color: "#e879f9", slowResist: 0.08 },
    golem: { hpMul: 2.55, speedMul: 0.5, armorAdd: 0.14, rewardMul: 1.35, r: 15, color: "#78716c", slowResist: 0 },
    crystal: { hpMul: 1.12, speedMul: 0.88, armorAdd: 0.26, rewardMul: 1.22, r: 12, color: "#22d3ee", slowResist: 0.18 },
    nightstalker: { hpMul: 0.9, speedMul: 1.38, armorAdd: 0.02, rewardMul: 1.06, r: 10, color: "#6d28d9", slowResist: 0.38 },
    magma: { hpMul: 1.22, speedMul: 1.08, armorAdd: 0.06, rewardMul: 1.12, r: 11, color: "#ea580c", slowResist: 0.1 },
    hollow: { hpMul: 0.22, speedMul: 2.05, armorAdd: 0, rewardMul: 0.38, r: 6, color: "#cbd5e1", slowResist: 0.12 },
    warden: { hpMul: 1.58, speedMul: 0.74, armorAdd: 0.12, rewardMul: 1.2, r: 12, color: "#64748b", slowResist: 0.1 },
    fury: { hpMul: 0.58, speedMul: 1.68, armorAdd: 0, rewardMul: 0.82, r: 9, color: "#ef4444", slowResist: 0.22 },
    marauder: { hpMul: 1.05, speedMul: 1.22, armorAdd: 0.05, rewardMul: 1.04, r: 11, color: "#c2410c", slowResist: 0.06 },
    shade: { hpMul: 0.95, speedMul: 1.18, armorAdd: 0, rewardMul: 1.08, r: 10, color: "#312e81", slowResist: 0.62 },
    leech: { hpMul: 1.15, speedMul: 0.92, armorAdd: 0, rewardMul: 1.1, r: 11, color: "#16a34a", slowResist: 0.15, regen: 7.2 },
    viper: { hpMul: 0.78, speedMul: 1.25, armorAdd: 0, rewardMul: 0.98, r: 10, color: "#65a30d", slowResist: 0.42 },
    frostborn: { hpMul: 1.08, speedMul: 0.96, armorAdd: 0.04, rewardMul: 1.05, r: 11, color: "#7dd3fc", slowResist: 0.55 },
    titan: { hpMul: 4.1, speedMul: 0.62, armorAdd: 0.22, rewardMul: 2.35, r: 18, color: "#b91c1c", slowResist: 0.15 },
    boss: { hpMul: 4.05, speedMul: 0.82, armorAdd: 0.24, rewardMul: 2.35, r: 19, color: "#fb923c", slowResist: 0.3 },
    stalker: { hpMul: 0.68, speedMul: 1.52, armorAdd: 0, rewardMul: 0.92, r: 9, color: "#e11d48", slowResist: 0.18 },
    rustmite: { hpMul: 0.88, speedMul: 1.08, armorAdd: 0.08, rewardMul: 1.0, r: 10, color: "#d97706", slowResist: 0.1 },
    behemoth: { hpMul: 2.1, speedMul: 0.58, armorAdd: 0.16, rewardMul: 1.32, r: 15, color: "#57534e", slowResist: 0.06 },
    veil: { hpMul: 0.92, speedMul: 1.05, armorAdd: 0, rewardMul: 1.04, r: 10, color: "#a855f7", slowResist: 0.48 },
    skitter: { hpMul: 0.34, speedMul: 1.78, armorAdd: 0, rewardMul: 0.48, r: 7, color: "#14b8a6", slowResist: 0.08 },
    drownling: { hpMul: 1.18, speedMul: 0.82, armorAdd: 0.03, rewardMul: 1.08, r: 11, color: "#0ea5e9", slowResist: 0.35 },
    ashbound: { hpMul: 1.45, speedMul: 0.72, armorAdd: 0.1, rewardMul: 1.15, r: 12, color: "#f97316", slowResist: 0.22 },
    lurker: { hpMul: 1.22, speedMul: 0.96, armorAdd: 0.05, rewardMul: 1.12, r: 11, color: "#0d9488", slowResist: 0.28 },
    sporekin: { hpMul: 1.08, speedMul: 0.9, armorAdd: 0.02, rewardMul: 1.14, r: 11, color: "#4d7c0f", slowResist: 0.12, regen: 4.8 },
    gravelord: { hpMul: 2.38, speedMul: 0.54, armorAdd: 0.19, rewardMul: 1.34, r: 15, color: "#44403c", slowResist: 0.08 },
    gloomfang: { hpMul: 0.88, speedMul: 1.2, armorAdd: 0, rewardMul: 1.08, r: 10, color: "#6b21a8", slowResist: 0.52 },
    shardback: { hpMul: 1.42, speedMul: 0.7, armorAdd: 0.21, rewardMul: 1.22, r: 12, color: "#0891b2", slowResist: 0.2 },
    pithound: { hpMul: 1.02, speedMul: 1.32, armorAdd: 0.04, rewardMul: 1.1, r: 10, color: "#9f1239", slowResist: 0.2 },
    cavern_ward: { hpMul: 1.62, speedMul: 0.71, armorAdd: 0.15, rewardMul: 1.24, r: 12, color: "#52525b", slowResist: 0.14 },
    // Новые враги
    siphoner: { hpMul: 1.08, speedMul: 0.98, armorAdd: 0.06, rewardMul: 1.12, r: 11, color: "#10b981", slowResist: 0.28, regen: 11.0 },
    prism: { hpMul: 1.14, speedMul: 0.86, armorAdd: 0.28, rewardMul: 1.24, r: 13, color: "#22c55e", slowResist: 0.22 },
    screecher: { hpMul: 0.62, speedMul: 1.78, armorAdd: 0, rewardMul: 0.9, r: 9, color: "#f43f5e", slowResist: 0.42 },
  };

  /** Подписи для экрана «Коллекция» — враги */
  var ENEMY_UI = {
    grunt: { nameRu: "Грунт", desc: "Обычный противник: средние HP и скорость." },
    runner: { nameRu: "Спринтер", desc: "Мало HP, очень высокая скорость." },
    brute: { nameRu: "Крушитель", desc: "Много HP, медленный, с бронёй." },
    wraith: { nameRu: "Призрак", desc: "Высокая устойчивость к замедлению." },
    plated: { nameRu: "Латник", desc: "Толстая броня, средняя скорость." },
    swarmling: { nameRu: "Роевик", desc: "Крошечный, очень быстрый, слабый." },
    charger: { nameRu: "Рывок", desc: "Быстрый натиск, ромбовидная форма." },
    golem: { nameRu: "Голем", desc: "Квадратный танк, огромный запас HP." },
    crystal: { nameRu: "Кристаллит", desc: "Шестиугольник, бронированный." },
    nightstalker: { nameRu: "Ночной охотник", desc: "Быстрый, устойчив к замедлению." },
    magma: { nameRu: "Магмовый", desc: "Огненный ромб, средняя живучесть." },
    hollow: { nameRu: "Пустотный", desc: "Минимум HP, экстремальная скорость." },
    warden: { nameRu: "Страж", desc: "Тяжёлый боец с бронёй." },
    fury: { nameRu: "Ярость", desc: "Быстрый агрессор, низкое HP." },
    marauder: { nameRu: "Мародёр", desc: "Широкий силуэт, сбалансированные статы." },
    shade: { nameRu: "Тень", desc: "Очень устойчив к замедлению." },
    leech: { nameRu: "Пиявка", desc: "Постепенно восстанавливает здоровье." },
    viper: { nameRu: "Гадюка", desc: "Быстрый, средняя устойчивость к контролю." },
    frostborn: { nameRu: "Морозный отродье", desc: "Устойчив к холоду и замедлению." },
    titan: { nameRu: "Титан", desc: "Редкий гигант: огромные HP и награда." },
    boss: { nameRu: "Босс", desc: "На волнах 10, 20 и 30 — главная угроза." },
    stalker: { nameRu: "Сталкер", desc: "Быстрый охотник, низкое HP." },
    rustmite: { nameRu: "Ржавчина-клещ", desc: "Чуть брони, средняя скорость." },
    behemoth: { nameRu: "Бегемот", desc: "Очень плотный, медленный." },
    veil: { nameRu: "Завеса", desc: "Высокая устойчивость к замедлению." },
    skitter: { nameRu: "Скиттер", desc: "Мелкий, стремительный рой." },
    drownling: { nameRu: "Утопленник", desc: "Средняя живучесть, устойчив к холоду." },
    ashbound: { nameRu: "Пепельный", desc: "Сбалансированный броня/скорость." },
    lurker: { nameRu: "Норный лазутчик", desc: "Чаще встречается в пещерных выходах: ловкий, сопротивляется замедлению." },
    sporekin: { nameRu: "Спорник", desc: "Пещерный носитель спор; медленно восстанавливает HP." },
    gravelord: { nameRu: "Гравелорд", desc: "Тяжёлая глыба из глубин; очень много HP и брони." },
    gloomfang: { nameRu: "Мракозуб", desc: "Фиолетовый хищник пещер; высокая устойчивость к контролю." },
    shardback: { nameRu: "Осколочник", desc: "Кристаллы на спине; плотная броня." },
    pithound: { nameRu: "Яремная гончая", desc: "Агрессивный обитатель расселин; быстрый рывок." },
    cavern_ward: { nameRu: "Страж расселин", desc: "Тяжёлый страж пещерных ходов." },
    siphoner: { nameRu: "Сифонер", desc: "Вампирит эфир: быстро восстанавливает HP." },
    prism: { nameRu: "Призма", desc: "Очень бронированная цель; медленная, но плотная." },
    screecher: { nameRu: "Крикун", desc: "Быстрый и упрямый: высокий анти-замедл." },
  };

  function buildEnemyCatalog() {
    var ids = Object.keys(ENEMY_KINDS);
    ids.sort(function (a, b) {
      if (a === "boss" || b === "boss") return a === "boss" ? 1 : -1;
      if (a === "titan" || b === "titan") return a === "titan" ? 1 : -1;
      return a.localeCompare(b);
    });
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var k = ENEMY_KINDS[id];
      var ui = ENEMY_UI[id] || { nameRu: id, desc: "" };
      out.push({
        id: id,
        nameRu: ui.nameRu,
        desc: ui.desc,
        color: k.color,
        hpMul: k.hpMul,
        speedMul: k.speedMul,
        armorAdd: k.armorAdd,
        slowResist: k.slowResist,
        regen: typeof k.regen === "number" ? k.regen : 0,
      });
    }
    return out;
  }

  var ENEMY_CATALOG = buildEnemyCatalog();

  function pickFromPool(pool) {
    var total = 0;
    for (var i = 0; i < pool.length; i++) total += pool[i].w;
    var r = Math.random() * total;
    var acc = 0;
    for (var j = 0; j < pool.length; j++) {
      acc += pool[j].w;
      if (r <= acc) return pool[j].id;
    }
    return pool[pool.length - 1].id;
  }

  function hexToRgb(hex) {
    if (!hex || hex.charAt(0) !== "#") return { r: 180, g: 180, b: 200 };
    var h = hex.slice(1);
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  function roundRectPath(ctx, x, y, w, h, rad) {
    rad = Math.min(rad, Math.abs(w) / 2, Math.abs(h) / 2);
    if (w < 0) {
      x += w;
      w = -w;
    }
    if (h < 0) {
      y += h;
      h = -h;
    }
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }

  function lightenHex(hex, t) {
    var o = hexToRgb(hex);
    if (!o) return hex;
    var r = Math.min(255, ((o.r + (255 - o.r) * t) | 0));
    var g = Math.min(255, ((o.g + (255 - o.g) * t) | 0));
    var b = Math.min(255, ((o.b + (255 - o.b) * t) | 0));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function drawTower(ctx, tw, animTime) {
    var x = tw.x,
      y = tw.y,
      lvl = tw.upgradeLevel | 0;
    if (tw.def && tw.def.mechanic === "farm") {
      var pulse = 0.9 + 0.1 * Math.sin((animTime || 0) * 0.0028);
      var R = (14 + lvl * 2.1) * pulse;
      var style = tw.def.farmStyle || "rhombus";
      var base = tw.def.color || "#22c55e";
      var oRgb = hexToRgb(base);
      var dark =
        oRgb != null
          ? "rgb(" + ((oRgb.r * 0.35) | 0) + "," + ((oRgb.g * 0.35) | 0) + "," + ((oRgb.b * 0.35) | 0) + ")"
          : "#14532d";
      ctx.save();
      if (style === "pond") {
        ctx.shadowColor = base + "99";
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(x, y, R * 1.05, 0, Math.PI * 2);
        var pg = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, 2, x, y, R * 1.2);
        pg.addColorStop(0, lightenHex(base, 0.35));
        pg.addColorStop(0.55, base);
        pg.addColorStop(1, dark);
        ctx.fillStyle = pg;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.28)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, R * 0.45, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else if (style === "vine") {
        ctx.shadowColor = base + "88";
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.ellipse(x, y, R * 1.05, R * 0.78, Math.sin((animTime || 0) * 0.0015) * 0.12, 0, Math.PI * 2);
        var vg = ctx.createLinearGradient(x - R, y - R, x + R, y + R);
        vg.addColorStop(0, lightenHex(base, 0.25));
        vg.addColorStop(1, dark);
        ctx.fillStyle = vg;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.fillStyle = "rgba(167, 243, 208, 0.45)";
        ctx.beginPath();
        ctx.arc(x - R * 0.35, y, 3 + lvl * 0.4, 0, Math.PI * 2);
        ctx.arc(x + R * 0.4, y - R * 0.2, 2.5 + lvl * 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (style === "granary") {
        var w = R * 1.35,
          h = R * 1.05;
        var gx0 = x - w / 2,
          gy0 = y - h / 2;
        ctx.shadowColor = "rgba(202, 138, 4, 0.45)";
        ctx.shadowBlur = 14;
        var gg = ctx.createLinearGradient(x, gy0, x, gy0 + h);
        gg.addColorStop(0, lightenHex(base, 0.2));
        gg.addColorStop(1, dark);
        ctx.fillStyle = gg;
        ctx.fillRect(gx0, gy0, w, h);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(gx0, gy0, w, h);
        ctx.fillStyle = "rgba(254, 243, 199, 0.5)";
        ctx.fillRect(x - w * 0.35, y - h * 0.15, w * 0.7, h * 0.12);
      } else {
        ctx.shadowColor = (oRgb ? "rgba(" + oRgb.r + "," + oRgb.g + "," + oRgb.b + ",0.55)" : "rgba(34,197,94,0.55)");
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(x, y - R);
        ctx.lineTo(x + R, y);
        ctx.lineTo(x, y + R);
        ctx.lineTo(x - R, y);
        ctx.closePath();
        var g0 = ctx.createLinearGradient(x - R, y - R, x + R, y + R);
        g0.addColorStop(0, base);
        g0.addColorStop(1, dark);
        ctx.fillStyle = g0;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + R * 0.45, y - R * 0.35, 4.6 + lvl * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(251,191,36,0.85)";
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    var c = lvl > 0 ? lightenHex(tw.def.color, 0.11 * lvl) : tw.def.color;
    var pulse = 0.94 + 0.06 * Math.sin((animTime || 0) * 0.0033);
    var sides = lvl >= 2 ? 8 : 6;
    var R = (14 + lvl * 1.85) * pulse;
    var i;
    ctx.save();
    ctx.shadowColor = c;
    ctx.shadowBlur = 14 + lvl * 3;
    ctx.beginPath();
    for (i = 0; i < sides; i++) {
      var a = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
      var px = x + Math.cos(a) * R,
        py = y + Math.sin(a) * R;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    var g = ctx.createRadialGradient(x - 4, y - 4, 1, x, y, R);
    g.addColorStop(0, "rgba(255,255,255,0.65)");
    g.addColorStop(0.45, c);
    g.addColorStop(1, "rgba(15,23,42,0.95)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = lvl >= 2 ? "rgba(251, 191, 36, 0.45)" : "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1.15 + lvl * 0.15;
    ctx.beginPath();
    for (i = 0; i < sides; i++) {
      var a2 = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
      var px2 = x + Math.cos(a2) * R,
        py2 = y + Math.sin(a2) * R;
      if (i === 0) ctx.moveTo(px2, py2);
      else ctx.lineTo(px2, py2);
    }
    ctx.closePath();
    ctx.stroke();

    if (lvl >= 1) {
      ctx.strokeStyle = lvl >= 2 ? "rgba(251, 191, 36, 0.65)" : "rgba(165, 243, 252, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, R + 3.5 + lvl * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    var coreR = 5.2 + lvl * 0.65;
    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.beginPath();
    ctx.arc(x, y, coreR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEnemy(ctx, e) {
    if (e.kind === "boss" || e.kind === "titan") {
      drawBossMultipart(ctx, e);
      return;
    }
    ctx.beginPath();
    enemyShapePath(ctx, e);
    if (e.hitFlash > 0) {
      ctx.fillStyle = "#fecaca";
    } else {
      var o = hexToRgb(e.color);
      var rad = ctx.createRadialGradient(e.x - e.r * 0.35, e.y - e.r * 0.42, e.r * 0.12, e.x, e.y, e.r * 1.2);
      rad.addColorStop(0, "rgba(255,255,255,0.62)");
      rad.addColorStop(0.38, e.color);
      rad.addColorStop(1, "rgba(" + ((o.r * 0.32) | 0) + "," + ((o.g * 0.32) | 0) + "," + ((o.b * 0.32) | 0) + ",1)");
      ctx.fillStyle = rad;
    }
    ctx.fill();
    ctx.strokeStyle = e.fromCave ? "rgba(167, 139, 250, 0.65)" : "rgba(0,0,0,0.4)";
    ctx.lineWidth = e.fromCave ? 2.4 : 2;
    ctx.stroke();
    if ((e.kind === "boss" || e.kind === "titan") && e.hitFlash <= 0) {
      ctx.beginPath();
      enemyShapePath(ctx, e);
      ctx.strokeStyle = "rgba(251, 191, 36, 0.55)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawBossMultipart(ctx, e) {
    var x = e.x, y = e.y;
    var r = e.r || 18;
    var ratio = e.maxHp > 0 ? Math.max(0, Math.min(1, e.hp / e.maxHp)) : 0;
    var t = (e._lifeT || 0) * 0.001;
    var o = hexToRgb(e.color);
    var base = e.color || "#fb923c";

    // Основное ядро
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - r * 0.86, y - r * 0.86, r * 1.72, r * 1.72);
    var rad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.12, x, y, r * 1.25);
    rad.addColorStop(0, "rgba(255,255,255,0.7)");
    rad.addColorStop(0.35, base);
    rad.addColorStop(1, "rgba(" + ((o.r * 0.26) | 0) + "," + ((o.g * 0.26) | 0) + "," + ((o.b * 0.26) | 0) + ",1)");
    ctx.fillStyle = e.hitFlash > 0 ? "#fecaca" : rad;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.42)";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Золотая окантовка как маркер элиты
    if (e.hitFlash <= 0) {
      ctx.beginPath();
      ctx.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8);
      ctx.strokeStyle = "rgba(251, 191, 36, 0.55)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Многочастность: орбиты + сегменты «хвоста» по направлению движения.
    var parts = e.kind === "titan" ? 5 : 4;
    if (ratio < 0.66) parts += 1;
    if (ratio < 0.33) parts += 1;
    parts = Math.max(4, Math.min(7, parts));

    var ang0 = (e._phase || 0) + t * (e.kind === "titan" ? 1.2 : 1.6);
    var orbitR = r * (1.25 + 0.15 * Math.sin(t * 2.3));
    for (var i = 0; i < parts; i++) {
      var a = ang0 + (i * Math.PI * 2) / parts;
      var px = x + Math.cos(a) * orbitR;
      var py = y + Math.sin(a) * orbitR;
      var pr = r * (0.22 + 0.05 * Math.sin(t * 3 + i));
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(165, 243, 252," + (0.18 + 0.12 * ratio).toFixed(3) + ")";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Хвост/сегменты назад по траектории (визуально «многочастный» босс)
    var hx = e._hx != null ? e._hx : x - 1;
    var hy = e._hy != null ? e._hy : y;
    var dx = x - hx, dy = y - hy;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= d; dy /= d;
    var tailN = e.kind === "titan" ? 3 : 2;
    for (var ti = 0; ti < tailN; ti++) {
      var k = (ti + 1) / (tailN + 1);
      var tx = x - dx * r * (1.1 + ti * 0.85);
      var ty = y - dy * r * (1.1 + ti * 0.85);
      var tr = r * (0.34 - ti * 0.07);
      ctx.beginPath();
      ctx.arc(tx, ty, Math.max(3, tr), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(94, 234, 212," + (0.08 + 0.14 * (1 - k) * ratio).toFixed(3) + ")";
      ctx.fill();
    }

    // Эффекты способностей (щит/ярость)
    if (e._shieldT && e._shieldT > 0) {
      ctx.beginPath();
      ctx.arc(x, y, r * 1.55, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.55)";
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
    if (e._enrage && e._enrage > 0) {
      ctx.beginPath();
      ctx.arc(x, y, r * 1.75, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(248, 113, 113, 0.45)";
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }

    ctx.restore();
  }

  function enemyShapePath(ctx, e) {
    var x = e.x,
      y = e.y,
      r = e.r;
    var k = e.kind;
    if (k === "boss" || k === "golem" || k === "titan") {
      ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
    } else if (k === "marauder") {
      ctx.rect(x - r, y - r * 0.55, r * 2, r * 1.1);
    } else if (k === "plated" || k === "brute") {
      ctx.rect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5);
    } else if (k === "runner" || k === "swarmling" || k === "hollow" || k === "fury") {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y + r * 0.65);
      ctx.lineTo(x - r, y + r * 0.65);
      ctx.closePath();
    } else if (k === "charger" || k === "magma") {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.88, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.88, y);
      ctx.closePath();
    } else if (k === "crystal" || k === "warden") {
      for (var i = 0; i < 6; i++) {
        var ang = -Math.PI / 2 + (i * Math.PI) / 3;
        var px = x + Math.cos(ang) * r;
        var py = y + Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (k === "stalker" || k === "skitter") {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y + r * 0.65);
      ctx.lineTo(x - r, y + r * 0.65);
      ctx.closePath();
    } else if (k === "behemoth" || k === "ashbound") {
      ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
    } else if (k === "veil") {
      for (var vi = 0; vi < 6; vi++) {
        var vang = -Math.PI / 2 + (vi * Math.PI) / 3;
        var vx = x + Math.cos(vang) * r * 0.92;
        var vy = y + Math.sin(vang) * r * 0.92;
        if (vi === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
    } else if (k === "rustmite" || k === "drownling" || k === "sporekin") {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.85, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.85, y);
      ctx.closePath();
    } else if (k === "lurker" || k === "pithound") {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y + r * 0.65);
      ctx.lineTo(x - r, y + r * 0.65);
      ctx.closePath();
    } else if (k === "gravelord" || k === "cavern_ward") {
      ctx.rect(x - r * 0.82, y - r * 0.82, r * 1.64, r * 1.64);
    } else if (k === "gloomfang") {
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.88, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.88, y);
      ctx.closePath();
    } else if (k === "shardback") {
      for (var sbi = 0; sbi < 6; sbi++) {
        var sang = -Math.PI / 2 + (sbi * Math.PI) / 3;
        var sxp = x + Math.cos(sang) * r * 0.95;
        var syp = y + Math.sin(sang) * r * 0.95;
        if (sbi === 0) ctx.moveTo(sxp, syp);
        else ctx.lineTo(sxp, syp);
      }
      ctx.closePath();
    } else {
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }

  function Game(canvas, bonuses, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    if (this.ctx.imageSmoothingEnabled !== undefined) this.ctx.imageSmoothingEnabled = true;
    if (this.ctx.imageSmoothingQuality !== undefined) this.ctx.imageSmoothingQuality = "high";
    this.bonuses = bonuses || { damageMul: 1, rangeMul: 1, slowMul: 1, goldMul: 1, rateMul: 1 };
    var diffKey = opts.difficulty || "normal";
    var D =
      typeof GAME_CONFIG !== "undefined" && GAME_CONFIG.DIFFICULTY && GAME_CONFIG.DIFFICULTY[diffKey]
        ? GAME_CONFIG.DIFFICULTY[diffKey]
        : { hpMul: 1, speedMul: 1, livesBonus: 0, goldBonus: 0 };
    this.difficulty = diffKey;
    this._diffHpMul = D.hpMul;
    this._diffSpeedMul = D.speedMul;
    var multi = buildMultiLanePath(Math.random);
    this.pathKey = multi.pathKey;
    this.pathLanes = multi.lanes;
    this.caveLane = multi.caveLane || null;
    this.caveOnlyKey = multi.caveOnlyKey || {};
    this.waypoints = multi.lanes[0].waypoints;
    this.pathModel = multi.lanes[0].pathModel;
    this.lives = GAME_CONFIG.START_LIVES + D.livesBonus;
    this.gold = Math.max(30, GAME_CONFIG.START_GOLD + D.goldBonus);
    this.waveIndex = 0;
    this.maxWaves = GAME_CONFIG.MAX_WAVES;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.waveActive = false;
    this.waveCleared = true;
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.particles = [];
    this.selectedTowerType = null;
    this.hoverCell = null;
    this.ownedHeroIds = {};
    this._lastTs = 0;
    this._spawnedThisWave = 0;
    this._toSpawnThisWave = 0;
    this.running = false;
    this.onUiUpdate = null;
    this.onEnd = null;
    this.runGems = 0;
    this._bossMidSlot = -1;
    this.autoNextWave = false;
    this._autoNextWaveTimer = 0;
    /** Начислено за бой (волны + убийства) для переноса в профиль (сундуки в меню) */
    this.sessionGoldEarned = 0;
    this.animTime = 0;
    this.pendingExplosions = [];
    this.visualBeams = [];
    this._nextTowerUid = 1;
    this._staticLayer = null;
    this._staticLayerCtx = null;
    this._buildStaticLayer();
    this.modifiers = this._rollRunModifiers();
  }

  Game.prototype._rollRunModifiers = function () {
    var list = [
      {
        id: "time_warp",
        name: "Искажение времени",
        desc: "Башни атакуют быстрее, но враги тоже ускорены.",
        towerRateMul: 1.12,
        enemySpeedMul: 1.1,
      },
      {
        id: "gold_vein",
        name: "Золотая жила",
        desc: "Больше наград за волну, но враги прочнее.",
        rewardMul: 1.55,
        enemyHpMul: 1.14,
      },
      {
        id: "ether_fog",
        name: "Эфирный туман",
        desc: "Враги сильнее сопротивляются замедлению.",
        slowResistAdd: 0.18,
      },
      {
        id: "thin_veil",
        name: "Тонкая завеса",
        desc: "Чуть меньше HP врагов, но больше брони.",
        enemyHpMul: 0.92,
        armorAdd: 0.06,
      },
      {
        id: "overcharge",
        name: "Перегрузка",
        desc: "Урон башен выше, но перезарядка чуть дольше.",
        towerDamageMul: 1.12,
        towerCooldownMul: 1.08,
      },
    ];

    var mods = [];
    // Редко: 12% шанс на 1 модификатор, 2% шанс на 2 модификатора.
    var r = Math.random();
    var count = r < 0.02 ? 2 : r < 0.12 ? 1 : 0;
    while (mods.length < count && list.length) {
      var i = (Math.random() * list.length) | 0;
      mods.push(list.splice(i, 1)[0]);
    }
    return mods;
  };

  Game.prototype._modifierMul = function (key, def) {
    var m = def == null ? 1 : def;
    var mods = this.modifiers || [];
    for (var i = 0; i < mods.length; i++) {
      if (typeof mods[i][key] === "number") m *= mods[i][key];
    }
    return m;
  };

  Game.prototype._modifierAdd = function (key, def) {
    var v = def == null ? 0 : def;
    var mods = this.modifiers || [];
    for (var i = 0; i < mods.length; i++) {
      if (typeof mods[i][key] === "number") v += mods[i][key];
    }
    return v;
  };

  Game.prototype._buildStaticLayer = function () {
    try {
      var c = document.createElement("canvas");
      c.width = CW;
      c.height = CH;
      var ctx = c.getContext("2d");
      if (!ctx) return;
      this._staticLayer = c;
      this._staticLayerCtx = ctx;

      // Фоновые градиенты (статично)
      var bg = ctx.createLinearGradient(0, 0, CW, CH);
      bg.addColorStop(0, "#070b14");
      bg.addColorStop(0.45, "#0d1528");
      bg.addColorStop(1, "#12182c");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CW, CH);

      var deep = ctx.createRadialGradient(CW * 0.5, CH * 0.45, 0, CW * 0.5, CH * 0.5, Math.max(CW, CH) * 0.75);
      deep.addColorStop(0, "rgba(56, 189, 248, 0.06)");
      deep.addColorStop(0.55, "rgba(99, 102, 241, 0.04)");
      deep.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = deep;
      ctx.fillRect(0, 0, CW, CH);

      var vign = ctx.createRadialGradient(
        CW * 0.5,
        CH * 0.5,
        Math.min(CW, CH) * 0.18,
        CW * 0.5,
        CH * 0.5,
        Math.max(CW, CH) * 0.78
      );
      vign.addColorStop(0, "rgba(0,0,0,0)");
      vign.addColorStop(1, "rgba(0,0,0,0.52)");
      ctx.fillStyle = vign;
      ctx.fillRect(0, 0, CW, CH);

      // Поле клеток (статично)
      var gx, gy, px, py, onPath, tileGrad;
      for (gy = 0; gy < GH; gy++) {
        for (gx = 0; gx < GW; gx++) {
          px = gx * TILE;
          py = gy * TILE;
          onPath = this.cellOnPath(gx, gy);
          var caveCell = this.caveOnlyKey && this.caveOnlyKey[gx + "," + gy];
          tileGrad = ctx.createLinearGradient(px, py, px + TILE, py + TILE);
          if (onPath && caveCell) {
            tileGrad.addColorStop(0, "rgba(55, 48, 70, 0.99)");
            tileGrad.addColorStop(1, "rgba(30, 24, 42, 0.98)");
          } else if (onPath) {
            tileGrad.addColorStop(0, "rgba(48, 58, 82, 0.98)");
            tileGrad.addColorStop(1, "rgba(32, 40, 62, 0.96)");
          } else if ((gx + gy) % 2 === 0) {
            tileGrad.addColorStop(0, "rgba(30, 42, 68, 0.97)");
            tileGrad.addColorStop(1, "rgba(20, 28, 48, 0.99)");
          } else {
            tileGrad.addColorStop(0, "rgba(24, 34, 56, 0.98)");
            tileGrad.addColorStop(1, "rgba(16, 24, 42, 0.99)");
          }
          ctx.fillStyle = tileGrad;
          ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
          if (onPath) {
            ctx.strokeStyle = caveCell ? "rgba(196, 181, 253, 0.22)" : "rgba(94, 234, 212, 0.16)";
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
          }
        }
      }

      // Линии путей (статично — без dash-анимации)
      var lanes = this.pathLanes || [{ waypoints: this.waypoints }];
      for (var li = 0; li < lanes.length; li++) {
        var wp = lanes[li].waypoints;
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        for (var w = 0; w < wp.length; w++) {
          var pt = wp[w];
          if (w === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = "rgba(45, 212, 191, 0.12)";
        ctx.lineWidth = 11;
        ctx.stroke();
        ctx.strokeStyle = "rgba(165, 243, 252, 0.75)";
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.restore();
      }

      // Пещерная ветка (статично — без dash-анимации)
      if (this.caveLane && this.caveLane.waypoints && this.caveLane.waypoints.length > 1) {
        var cwp = this.caveLane.waypoints;
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        for (var cw = 0; cw < cwp.length; cw++) {
          var cpt = cwp[cw];
          if (cw === 0) ctx.moveTo(cpt.x, cpt.y);
          else ctx.lineTo(cpt.x, cpt.y);
        }
        ctx.strokeStyle = "rgba(124, 58, 237, 0.25)";
        ctx.lineWidth = 12;
        ctx.stroke();
        ctx.strokeStyle = "rgba(251, 191, 36, 0.75)";
        ctx.lineWidth = 2.6;
        ctx.stroke();
        ctx.restore();
      }
    } catch (e) {}
  };

  Game.prototype.cellOnPath = function (gx, gy) {
    return this.pathKey[gx + "," + gy] === true;
  };

  Game.prototype.setOwnedHeroes = function (ids) {
    this.ownedHeroIds = {};
    for (var i = 0; i < ids.length; i++) this.ownedHeroIds[ids[i]] = true;
  };

  Game.prototype.isTowerUnlocked = function (type) {
    if (type && type.alwaysUnlocked) return true;
    var hid = type.heroId != null ? type.heroId : type.id;
    return !!this.ownedHeroIds[hid];
  };

  Game.prototype.effectiveStats = function (base) {
    var b = this.bonuses;
    var cdMul = this._modifierMul("towerCooldownMul", 1);
    var dmgMul = this._modifierMul("towerDamageMul", 1);
    var rateMul = this._modifierMul("towerRateMul", 1);
    return {
      range: base.range * b.rangeMul,
      damage: base.damage * b.damageMul * dmgMul,
      cooldown: Math.max(12, (base.cooldown * cdMul / (b.rateMul * rateMul)) | 0),
      slow: base.slow ? base.slow * b.slowMul : 0,
      splash: base.splash,
    };
  };

  Game.prototype.effectiveStatsForTower = function (tw) {
    var def = tw.def;
    var lvl = tw.upgradeLevel | 0;
    var dmgU = 1 + 0.2 * lvl;
    var rngU = 1 + 0.08 * lvl;
    var cdU = Math.max(0.82, 1 - 0.065 * lvl);
    var splU = 1 + 0.07 * lvl;
    var slowU = def.slow ? 1 + 0.05 * lvl : 0;
    var synthetic = {
      range: def.range * rngU,
      damage: def.damage * dmgU,
      cooldown: def.cooldown * cdU,
      slow: def.slow ? def.slow * slowU : 0,
      splash: def.splash * splU,
    };
    return this.effectiveStats(synthetic);
  };

  Game.prototype.towerAt = function (gx, gy) {
    for (var i = 0; i < this.towers.length; i++) {
      if (this.towers[i].gx === gx && this.towers[i].gy === gy) return this.towers[i];
    }
    return null;
  };

  Game.prototype.getUpgradeCost = function (tw) {
    if ((tw.upgradeLevel | 0) >= TOWER_UPGRADE_MAX) return null;
    var next = (tw.upgradeLevel | 0) + 1;
    return Math.floor(tw.def.cost * (0.42 + next * 0.28));
  };

  Game.prototype.tryUpgradeTower = function (tw) {
    var cost = this.getUpgradeCost(tw);
    if (cost == null || this.gold < cost) return false;
    this.gold -= cost;
    tw.upgradeLevel = (tw.upgradeLevel | 0) + 1;
    this._notifyUi();
    return true;
  };

  Game.prototype.startWave = function () {
    if (this.waveIndex >= this.maxWaves) return;
    if (this.waveActive) return;

    this._autoNextWaveTimer = 0;

    this.waveIndex++;
    this.waveActive = true;
    this.waveCleared = false;
    this._spawnedThisWave = 0;
    var w = this.waveIndex;
    var count = 11 + ((w * 2.95) | 0);
    if (count > 86) count = 86;
    this._toSpawnThisWave = count;
    this.spawnTimer = 0;

    var midSlot = -1;
    if (w === 10 || w === 20 || w === 30) {
      if (count >= 3) {
        midSlot = Math.floor(count * 0.36);
        midSlot = Math.max(1, Math.min(count - 2, midSlot));
      } else if (count === 2) {
        midSlot = 0;
      }
    }
    this._bossMidSlot = midSlot;

    var hpBase = (38 + w * 28 + w * w * 3.65 + ((w * w * w) / 34)) | 0;
    if (w > 18) hpBase = (hpBase * (1 + (w - 18) * 0.028)) | 0;
    hpBase = (hpBase * this._diffHpMul) | 0;
    hpBase = (hpBase * this._modifierMul("enemyHpMul", 1)) | 0;
    var speed = Math.min(2.62, 0.86 + w * 0.044);
    speed = Math.min(2.95, speed * this._diffSpeedMul);
    speed = speed * this._modifierMul("enemySpeedMul", 1);
    var reward = (4 + (w * 0.52) | 0) * this.bonuses.goldMul * this._modifierMul("rewardMul", 1);

    var armorWave = 0;
    if (w > 2) armorWave = 0.035;
    if (w > 5) armorWave = 0.09;
    if (w > 8) armorWave = 0.14;
    if (w > 12) armorWave = 0.19;
    if (w > 16) armorWave = 0.24;
    if (w > 20) armorWave = 0.29;
    if (w > 25) armorWave = 0.33;

    armorWave = Math.min(0.56, armorWave + this._modifierAdd("armorAdd", 0));
    this._waveSpec = { hp: hpBase, speed: speed, reward: reward, armor: armorWave };
    this._notifyUi();
    if (typeof SFX !== "undefined" && SFX.waveStart) SFX.waveStart();
  };

  Game.prototype._pickEnemyKindId = function () {
    var w = this.waveIndex;
    if (w >= 12 && Math.random() * 100 < 5.2) return "titan";
    if (w >= 5 && Math.random() * 100 < 7.5) return "golem";

    var pool;
    if (w <= 3) {
      pool = [
        { id: "grunt", w: 40 },
        { id: "runner", w: 18 },
        { id: "swarmling", w: 16 },
        { id: "hollow", w: 10 },
        { id: "skitter", w: 10 },
        { id: "rustmite", w: 6 },
      ];
    } else if (w <= 7) {
      pool = [
        { id: "grunt", w: 22 },
        { id: "runner", w: 14 },
        { id: "swarmling", w: 9 },
        { id: "brute", w: 12 },
        { id: "fury", w: 10 },
        { id: "charger", w: 10 },
        { id: "hollow", w: 8 },
        { id: "stalker", w: 8 },
        { id: "skitter", w: 7 },
      ];
    } else if (w <= 12) {
      pool = [
        { id: "grunt", w: 16 },
        { id: "runner", w: 9 },
        { id: "brute", w: 10 },
        { id: "plated", w: 10 },
        { id: "wraith", w: 9 },
        { id: "charger", w: 9 },
        { id: "crystal", w: 9 },
        { id: "magma", w: 7 },
        { id: "marauder", w: 5 },
        { id: "leech", w: 4 },
        { id: "screecher", w: 6 },
        { id: "prism", w: 4 },
        { id: "veil", w: 6 },
        { id: "drownling", w: 7 },
      ];
    } else if (w <= 18) {
      pool = [
        { id: "grunt", w: 10 },
        { id: "runner", w: 7 },
        { id: "brute", w: 9 },
        { id: "plated", w: 10 },
        { id: "wraith", w: 9 },
        { id: "warden", w: 9 },
        { id: "crystal", w: 9 },
        { id: "nightstalker", w: 7 },
        { id: "shade", w: 5 },
        { id: "viper", w: 5 },
        { id: "frostborn", w: 5 },
        { id: "leech", w: 5 },
        { id: "siphoner", w: 4 },
        { id: "prism", w: 5 },
        { id: "veil", w: 6 },
        { id: "ashbound", w: 8 },
        { id: "behemoth", w: 5 },
      ];
    } else {
      pool = [
        { id: "grunt", w: 7 },
        { id: "runner", w: 5 },
        { id: "brute", w: 7 },
        { id: "plated", w: 10 },
        { id: "wraith", w: 9 },
        { id: "warden", w: 9 },
        { id: "crystal", w: 9 },
        { id: "nightstalker", w: 7 },
        { id: "shade", w: 8 },
        { id: "viper", w: 5 },
        { id: "frostborn", w: 7 },
        { id: "leech", w: 7 },
        { id: "siphoner", w: 6 },
        { id: "prism", w: 6 },
        { id: "screecher", w: 5 },
        { id: "magma", w: 5 },
        { id: "behemoth", w: 8 },
        { id: "ashbound", w: 8 },
        { id: "veil", w: 6 },
      ];
    }
    return pickFromPool(pool);
  };

  Game.prototype._spawnOne = function () {
    var spec = this._waveSpec;
    var w = this.waveIndex;
    var milestone = w === 10 || w === 20 || w === 30;
    var slot = this._spawnedThisWave;
    var total = this._toSpawnThisWave;
    var endBoss = milestone && slot === total - 1;
    var midBoss = milestone && this._bossMidSlot >= 0 && slot === this._bossMidSlot;
    var isBossSpawn = endBoss || midBoss;
    var useCave =
      !isBossSpawn &&
      this.caveLane &&
      Math.random() < 0.028;
    var kindId = isBossSpawn ? "boss" : useCave ? this._pickCaveEnemyKind() : this._pickEnemyKindId();
    var K = ENEMY_KINDS[kindId] || ENEMY_KINDS.grunt;

    var hp = spec.hp * K.hpMul;
    if (useCave) hp *= 1.88;
    if (kindId === "boss") {
      if (midBoss) {
        if (w === 10) hp *= 1.15;
        if (w === 20) hp *= 1.22;
        if (w === 30) hp *= 1.32;
      }
      if (endBoss) {
        if (w === 10) hp *= 1.25;
        if (w === 20) hp *= 1.45;
        if (w === 30) hp *= 1.85;
      }
    }
    var spd = spec.speed * K.speedMul * (useCave ? 0.9 : 1);
    var arm = Math.min(0.56, (spec.armor || 0) + K.armorAdd + (useCave ? 0.05 : 0));
    var rw = spec.reward * K.rewardMul * (useCave ? 1.38 : 1);

    var lane = useCave
      ? this.caveLane
      : this.pathLanes[Math.floor(Math.random() * this.pathLanes.length)];
    var lanePm = lane.pathModel;
    var laneWp = lane.waypoints;
    var bossVariant = null;
    if (kindId === "boss") {
      bossVariant = w === 10 ? "hydra" : w === 20 ? "warden" : w === 30 ? "reaver" : "boss";
      // Конфигурация способностей (таймеры в мс)
      // hydra: призывает мелочь; warden: периодический щит; reaver: рывок вперёд.
    }
    var titanVariant = null;
    if (kindId === "titan") {
      titanVariant = w >= 20 ? "shatter" : "colossus";
    }
    var e = {
      distAlong: 0,
      pathModel: lanePm,
      x: laneWp[0].x,
      y: laneWp[0].y,
      hp: hp,
      maxHp: hp,
      speed: spd,
      reward: rw,
      armor: arm,
      slowMul: 1,
      slowTimer: 0,
      r: K.r,
      hitFlash: 0,
      color: K.color,
      kind: kindId,
      slowResist: Math.min(0.85, Math.max(0, (K.slowResist || 0) + this._modifierAdd("slowResistAdd", 0))),
      regen: typeof K.regen === "number" ? K.regen : 0,
      fromCave: !!useCave,
      bossVariant: bossVariant,
      titanVariant: titanVariant,
      _lifeT: 0,
      _hx: laneWp[0].x,
      _hy: laneWp[0].y,
      _phase: Math.random() * Math.PI * 2,
      _shieldCd: kindId === "boss" && bossVariant === "warden" ? 1400 : 0,
      _dashCd: kindId === "boss" && bossVariant === "reaver" ? 1800 : 0,
      _summonCd: kindId === "boss" && bossVariant === "hydra" ? 1200 : 0,
      _shieldT: 0,
      _enrage: 0,
    };
    this.enemies.push(e);
    this._spawnedThisWave++;
  };

  Game.prototype._spawnMinionFromEnemy = function (src, kindId, hpMul, spdMul, rewardMul) {
    var spec = this._waveSpec || { hp: 60, speed: 1, reward: 5, armor: 0 };
    var K = ENEMY_KINDS[kindId] || ENEMY_KINDS.grunt;
    var hp = spec.hp * K.hpMul * (hpMul != null ? hpMul : 0.4);
    var spd = spec.speed * K.speedMul * (spdMul != null ? spdMul : 1.05);
    var arm = Math.min(0.56, (spec.armor || 0) + K.armorAdd);
    var rw = spec.reward * K.rewardMul * (rewardMul != null ? rewardMul : 0.35);
    var pm = src.pathModel || this.pathModel;
    var d0 = Math.max(0, (src.distAlong || 0) - 18);
    var pos = posAtDistance(pm.segs, d0);
    this.enemies.push({
      distAlong: d0,
      pathModel: pm,
      x: pos.x,
      y: pos.y,
      hp: hp,
      maxHp: hp,
      speed: spd,
      reward: rw,
      armor: arm,
      slowMul: 1,
      slowTimer: 0,
      r: K.r,
      hitFlash: 0,
      color: K.color,
      kind: kindId,
      slowResist: K.slowResist,
      regen: typeof K.regen === "number" ? K.regen : 0,
      fromCave: !!src.fromCave,
      _lifeT: 0,
      _hx: pos.x,
      _hy: pos.y,
      _phase: Math.random() * Math.PI * 2,
      _shieldCd: 0,
      _dashCd: 0,
      _summonCd: 0,
      _shieldT: 0,
      _enrage: 0,
    });
  };

  Game.prototype._pickCaveEnemyKind = function () {
    var w = this.waveIndex;
    var pool = [
      { id: "brute", w: 11 },
      { id: "plated", w: 11 },
      { id: "golem", w: 9 },
      { id: "warden", w: 9 },
      { id: "behemoth", w: 8 },
      { id: "ashbound", w: 8 },
      { id: "crystal", w: 7 },
      { id: "lurker", w: 10 },
      { id: "sporekin", w: 9 },
      { id: "gravelord", w: 9 },
      { id: "gloomfang", w: 9 },
      { id: "shardback", w: 9 },
      { id: "pithound", w: 8 },
      { id: "cavern_ward", w: 9 },
      { id: "prism", w: 7 },
      { id: "siphoner", w: 6 },
    ];
    if (w >= 6) pool.push({ id: "nightstalker", w: 6 });
    if (w >= 8) pool.push({ id: "shade", w: 5 });
    if (w >= 10) pool.push({ id: "titan", w: 5 });
    if (w >= 12) pool.push({ id: "magma", w: 4 }, { id: "wraith", w: 4 });
    if (w >= 14) pool.push({ id: "veil", w: 6 });
    if (w >= 16) pool.push({ id: "leech", w: 4 });
    return pickFromPool(pool);
  };

  Game.prototype.tick = function (dt) {
    this.animTime = (this.animTime || 0) + dt;
    if (!this.running) return;

    if (
      this.autoNextWave &&
      !this.waveActive &&
      this.waveCleared &&
      this.waveIndex < this.maxWaves &&
      this._autoNextWaveTimer > 0
    ) {
      this._autoNextWaveTimer -= dt;
      if (this._autoNextWaveTimer <= 0) {
        this._autoNextWaveTimer = 0;
        this.startWave();
      }
    }

    if (this.waveActive && this._spawnedThisWave < this._toSpawnThisWave) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this._spawnOne();
        var st = 165 + Math.random() * 175;
        this.spawnTimer = st;
      }
    }

    if (this.waveActive && this._spawnedThisWave >= this._toSpawnThisWave && this.enemies.length === 0) {
      this.waveActive = false;
      this.waveCleared = true;
      var wr = typeof GAME_CONFIG !== "undefined" && GAME_CONFIG.WAVE_REWARD ? GAME_CONFIG.WAVE_REWARD : 0;
      this.gold += wr;
      this.sessionGoldEarned += wr;
      // Пассивный доход ферм за каждую пройденную волну
      var farmGold = 0;
      for (var fi = 0; fi < this.towers.length; fi++) {
        var ft = this.towers[fi];
        if (!ft || !ft.def || ft.def.mechanic !== "farm") continue;
        var baseInc = typeof ft.def.incomePerWave === "number" ? ft.def.incomePerWave : 0;
        var lvl = ft.upgradeLevel | 0;
        farmGold += Math.floor(baseInc * (1 + 0.35 * lvl));
      }
      if (farmGold > 0) {
        this.gold += farmGold;
        this.sessionGoldEarned += farmGold;
      }
      var wi = this.waveIndex;
      if (GAME_CONFIG.GEMS_WAVE_CLEAR) this.runGems += GAME_CONFIG.GEMS_WAVE_CLEAR;
      if (wi % 5 === 0 && GAME_CONFIG.GEMS_EVERY_5_WAVES) this.runGems += GAME_CONFIG.GEMS_EVERY_5_WAVES;
      if (wi === 10 || wi === 20 || wi === 30) this.runGems += GAME_CONFIG.GEMS_MILESTONE_WAVE;
      if (this.waveIndex >= this.maxWaves) {
        this._win();
      } else if (this.autoNextWave) {
        this._autoNextWaveTimer = 900;
      }
      this._notifyUi();
    }

    this._updatePendingExplosions(dt);
    this._updateVisualBeams(dt);
    this._updateEnemies(dt);
    this._updateTowers(dt);
    this._updateProjectiles(dt);
    this._updateParticles(dt);
  };

  Game.prototype._updatePendingExplosions = function (dt) {
    for (var i = this.pendingExplosions.length - 1; i >= 0; i--) {
      var q = this.pendingExplosions[i];
      q.tLeft -= dt;
      if (q.tLeft <= 0) {
        this._impact({
          tx: q.tx,
          ty: q.ty,
          damage: q.damage,
          splash: q.splash,
          slow: q.slow,
          color: q.color,
          mechanic: "standard",
          homing: null,
          towerUid: q.towerUid,
          midas: q.midas,
          armorPierce: 1,
          longshotMul: 1,
        });
        this.pendingExplosions.splice(i, 1);
      }
    }
  };

  Game.prototype._updateVisualBeams = function (dt) {
    for (var i = this.visualBeams.length - 1; i >= 0; i--) {
      this.visualBeams[i].life -= dt;
      if (this.visualBeams[i].life <= 0) this.visualBeams.splice(i, 1);
    }
  };

  Game.prototype._updateEnemies = function (dt) {
    var self = this;
    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i];
      e._lifeT = (e._lifeT || 0) + dt;
      e._hx = e.x;
      e._hy = e.y;
      var pm = e.pathModel || this.pathModel;
      var total = pm.total;
      if (e.slowTimer > 0) {
        e.slowTimer -= dt;
        if (e.slowTimer <= 0) e.slowMul = 1;
      }
      if (e.burnT > 0) {
        e.burnT -= dt;
        e.hp -= e.burnDps * (dt / 1000);
        if (e.hp <= 0) {
          e.hp = 0;
          self._finalizeKill(e);
          continue;
        }
      }
      if (e.poisonT > 0) {
        e.poisonT -= dt;
        e.hp -= e.poisonDps * (dt / 1000);
        if (e.hp <= 0) {
          e.hp = 0;
          self._finalizeKill(e);
          continue;
        }
      }
      var move = e.speed * e.slowMul * (dt / 16) * 1.85;
      e.distAlong += move;
      if (e.distAlong >= total) {
        this.lives--;
        if (typeof SFX !== "undefined" && SFX.lifeLost) SFX.lifeLost();
        this.enemies.splice(i, 1);
        if (this.lives <= 0) this._lose();
        this._notifyUi();
        continue;
      }
      var pos = posAtDistance(pm.segs, e.distAlong);
      e.x = pos.x;
      e.y = pos.y;

      // Способности боссов / титанов.
      if (e.kind === "boss") {
        // Вариант 10: «Гидра» — призыв мелочи
        if (e.bossVariant === "hydra") {
          e._summonCd = (e._summonCd || 0) - dt;
          if (e._summonCd <= 0) {
            e._summonCd = 3200 + Math.random() * 900;
            // 2 миньона рядом с боссом
            self._spawnMinionFromEnemy(e, "swarmling", 0.22, 1.25, 0.22);
            self._spawnMinionFromEnemy(e, "runner", 0.26, 1.15, 0.24);
          }
        }
        // Вариант 20: «Страж» — щит (сильнее против burst)
        if (e.bossVariant === "warden") {
          if (e._shieldT > 0) e._shieldT -= dt;
          e._shieldCd = (e._shieldCd || 0) - dt;
          if (e._shieldCd <= 0) {
            e._shieldCd = 4200 + Math.random() * 700;
            e._shieldT = 1200;
          }
        }
        // Вариант 30: «Жнец» — рывок вперёд
        if (e.bossVariant === "reaver") {
          e._dashCd = (e._dashCd || 0) - dt;
          if (e._dashCd <= 0) {
            e._dashCd = 3600 + Math.random() * 900;
            e.distAlong = Math.min(total - 1, e.distAlong + 90 + Math.random() * 70);
          }
        }
      }

      if (e.kind === "titan") {
        // Титан: ярость на половине HP (скорость + реген)
        var ratio = e.maxHp > 0 ? e.hp / e.maxHp : 1;
        if (ratio < 0.5) {
          e._enrage = 1;
          e.speed *= 1.0009; // мягкое нарастание скорости
          e.regen = Math.max(e.regen || 0, 9.5);
        }
      }

      if (e.regen && e.hp > 0 && e.hp < e.maxHp) {
        e.hp = Math.min(e.maxHp, e.hp + e.regen * (dt / 1000));
      }
      if (e.hitFlash > 0) e.hitFlash -= dt;
    }
  };

  Game.prototype._pushProj = function (tw, def, st, target, o) {
    o = o || {};
    this.projectiles.push({
      x: tw.x,
      y: tw.y,
      tx: target.x,
      ty: target.y,
      damage: o.damage != null ? o.damage : st.damage,
      splash: o.splash != null ? o.splash : st.splash,
      slow: o.slow != null ? o.slow : st.slow,
      color: def.color,
      homing: target,
      speed: o.speed != null ? o.speed : 0.65,
      mechanic: def.mechanic || "standard",
      towerUid: tw.uid,
      midas: def.mechanic === "midas",
      longshotMul: o.longshotMul != null ? o.longshotMul : 1,
      armorPierce: def.mechanic === "armor_pierce" ? 0.42 : 1,
    });
  };

  Game.prototype._fireTowerAttack = function (tw, def, st, target) {
    var mech = def.mechanic || "standard";
    var dratio = dist(tw.x, tw.y, target.x, target.y) / Math.max(1, st.range);
    var longshotMul = mech === "longshot" && dratio > 0.86 ? 1.32 : 1;

    var dmg = st.damage;
    if (mech === "overload") {
      tw.shotCount = (tw.shotCount || 0) + 1;
      if (tw.shotCount % 3 === 0) dmg *= 2;
    }

    var slowUse = st.slow;
    if (mech === "deep_chill") slowUse = 0.44;
    if (mech === "gust_slow") slowUse = 0.38;

    var splashUse = st.splash;
    if (mech === "siege") splashUse = st.splash * 1.28;

    var isExec = mech === "execute";
    var isCres = mech === "crescent";
    var isMidas = mech === "midas";
    var ap = mech === "armor_pierce" ? 0.42 : 1;

    if (mech === "beam") {
      this.visualBeams.push({ x1: tw.x, y1: tw.y, x2: target.x, y2: target.y, color: def.color, life: 160 });
      this._damageEnemy(target, dmg, slowUse, def.color, {
        execute: isExec,
        crescent: isCres,
        armorPierce: ap,
        longshotMul: longshotMul,
        midas: isMidas,
      });
      tw.cooldownLeft = st.cooldown;
      return;
    }

    if (mech === "ray") {
      this.visualBeams.push({ x1: tw.x, y1: tw.y, x2: target.x, y2: target.y, color: def.color, life: 220 });
      for (var ri = 0; ri < this.enemies.length; ri++) {
        var en = this.enemies[ri];
        if (distPointToSegment(en.x, en.y, tw.x, tw.y, target.x, target.y) < en.r + 16) {
          this._damageEnemy(en, dmg * 0.9, 0, def.color, {
            execute: isExec,
            crescent: isCres,
            armorPierce: ap,
            longshotMul: longshotMul,
            midas: isMidas,
          });
        }
      }
      tw.cooldownLeft = st.cooldown;
      return;
    }

    if (mech === "twin") {
      var t2 = findNearestEnemyExcept(this, target.x, target.y, st.range * 1.15, target);
      if (!t2) t2 = target;
      this._pushProj(tw, def, st, target, { damage: dmg * 0.58, splash: splashUse, slow: slowUse, longshotMul: longshotMul });
      this._pushProj(tw, def, st, t2, { damage: dmg * 0.58, splash: splashUse, slow: slowUse, longshotMul: longshotMul });
      tw.cooldownLeft = st.cooldown;
      return;
    }

    if (mech === "volley") {
      for (var v = 0; v < 3; v++) {
        this._pushProj(tw, def, st, target, { damage: dmg * 0.36, splash: 0, slow: slowUse, longshotMul: longshotMul });
      }
      tw.cooldownLeft = st.cooldown;
      return;
    }

    if (mech === "double_tap") {
      this._pushProj(tw, def, st, target, { damage: dmg * 0.88, splash: splashUse, slow: slowUse, longshotMul: longshotMul });
      this._pushProj(tw, def, st, target, { damage: dmg * 0.88, splash: splashUse, slow: slowUse, longshotMul: longshotMul });
      tw.cooldownLeft = st.cooldown;
      return;
    }

    this._pushProj(tw, def, st, target, {
      damage: dmg,
      splash: splashUse,
      slow: slowUse,
      longshotMul: longshotMul,
    });
    tw.cooldownLeft = st.cooldown;
  };

  Game.prototype._updateTowers = function (dt) {
    for (var ti = 0; ti < this.towers.length; ti++) {
      var tw = this.towers[ti];
      var def = tw.def;
      if (def && def.mechanic === "farm") continue;
      var st = this.effectiveStatsForTower(tw);
      tw.cooldownLeft = tw.cooldownLeft || 0;
      tw.cooldownLeft -= dt;
      if (tw.cooldownLeft > 0) continue;

      var target = null,
        best = Infinity;
      for (var ei = 0; ei < this.enemies.length; ei++) {
        var e = this.enemies[ei];
        var d = dist(tw.x, tw.y, e.x, e.y);
        if (d <= st.range && d < best) {
          best = d;
          target = e;
        }
      }
      if (!target) continue;

      this._fireTowerAttack(tw, def, st, target);
    }
  };

  Game.prototype._updateProjectiles = function (dt) {
    for (var i = this.projectiles.length - 1; i >= 0; i--) {
      var p = this.projectiles[i];
      if (p.homing && this.enemies.indexOf(p.homing) >= 0) {
        p.tx = p.homing.x;
        p.ty = p.homing.y;
      }
      var dx = p.tx - p.x,
        dy = p.ty - p.y,
        d = Math.sqrt(dx * dx + dy * dy) || 1;
      var step = p.speed * (dt / 16) * 14;
      if (d < step + 6) {
        this._impact(p);
        this.projectiles.splice(i, 1);
        continue;
      }
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
    }
  };

  Game.prototype._applyHit = function (e, rawDmg, p, slowAmt) {
    var mech = p.mechanic || "standard";
    var dc = dist(e.x, e.y, p.tx, p.ty);
    this._damageEnemy(e, rawDmg, slowAmt, p.color, {
      towerUid: p.towerUid,
      midas: p.midas,
      longshotMul: p.longshotMul || 1,
      armorPierce: p.armorPierce != null ? p.armorPierce : 1,
      execute: mech === "execute",
      crescent: mech === "crescent",
      dotBurn: mech === "burn" && dc < 24 ? { dps: 2.8, t: 2800 } : null,
      dotPoison: mech === "poison" && dc < 24 ? { dps: 3.2, t: 3200 } : null,
    });
  };

  Game.prototype._impact = function (p) {
    var mech = p.mechanic || "standard";
    var tx = p.tx,
      ty = p.ty,
      dmg = p.damage;
    var sx = p.splash || 0;

    if (sx > 0) {
      var i;
      for (i = 0; i < this.enemies.length; i++) {
        var e = this.enemies[i];
        if (dist(e.x, e.y, tx, ty) <= sx) {
          var fall = dist(e.x, e.y, tx, ty) < 18 ? 1 : 0.55;
          var es = null;
          var bdur = 2200;
          if (mech === "corrupt_splash") {
            es = 0.17;
          }
          if (mech === "bloom") {
            es = 0.26;
            bdur = 2800;
          }
          var sl = p.slow && fall >= 0.9 ? p.slow : 0;
          this._damageEnemy(e, dmg * fall, sl, p.color, {
            towerUid: p.towerUid,
            midas: p.midas,
            longshotMul: p.longshotMul || 1,
            armorPierce: p.armorPierce != null ? p.armorPierce : 1,
            execute: mech === "execute",
            crescent: mech === "crescent",
            extraSlow: es,
            bloomDuration: bdur,
            dotBurn: fall >= 0.95 && mech === "burn" ? { dps: 2.8, t: 2800 } : null,
            dotPoison: fall >= 0.95 && mech === "poison" ? { dps: 3.2, t: 3200 } : null,
          });
        }
      }
      if (mech === "shrapnel") {
        var ex = findNearestEnemyExcept(this, tx, ty, 110, null);
        if (ex && dist(ex.x, ex.y, tx, ty) > 24) {
          this._applyHit(ex, dmg * 0.42, p, 0);
        }
      }
      if (mech === "meteor_pair") {
        this.pendingExplosions.push({
          tLeft: 230,
          tx: tx,
          ty: ty,
          damage: dmg * 0.72,
          splash: p.splash,
          slow: p.slow,
          color: p.color,
          towerUid: p.towerUid,
          midas: p.midas,
        });
      }
      return;
    }

    if (mech === "pierce") {
      var hits = enemiesNearPoint(this, tx, ty, 34, null);
      if (hits[0]) this._applyHit(hits[0], dmg, p, p.slow);
      if (hits[1]) this._applyHit(hits[1], dmg * 0.64, p, p.slow * 0.88);
      return;
    }

    var best = null,
      bd = 24;
    for (var j = 0; j < this.enemies.length; j++) {
      var e2 = this.enemies[j];
      var d0 = dist(e2.x, e2.y, tx, ty);
      if (d0 < bd) {
        bd = d0;
        best = e2;
      }
    }
    if (!best) return;
    this._applyHit(best, dmg, p, p.slow);

    if (mech === "chain") {
      var ch = findNearestEnemyExcept(this, best.x, best.y, 135, best);
      if (ch) this._applyHit(ch, dmg * 0.56, p, p.slow * 0.82);
    }
    if (mech === "ricochet") {
      var rc = findNearestEnemyExcept(this, best.x, best.y, 108, best);
      if (rc) this._applyHit(rc, dmg * 0.52, p, p.slow * 0.78);
    }
  };

  Game.prototype._finalizeKill = function (e) {
    var rw = e.reward || 0;
    this.gold += rw;
    this.sessionGoldEarned += rw;
    if (e.kind === "boss" && GAME_CONFIG.GEMS_BOSS_KILL) this.runGems += GAME_CONFIG.GEMS_BOSS_KILL;
    if (e.kind === "titan" && GAME_CONFIG.GEMS_TITAN_KILL) this.runGems += GAME_CONFIG.GEMS_TITAN_KILL;
    var idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
    this._addParticles(e.x, e.y, "#fbbf24", 10);
    if (typeof SFX !== "undefined" && SFX.enemyKill) SFX.enemyKill(e);
    this._notifyUi();
  };

  Game.prototype._damageEnemy = function (e, rawDmg, slowAmt, hitColor, opts) {
    opts = opts || {};
    var raw = rawDmg * (opts.longshotMul != null ? opts.longshotMul : 1);
    if (opts.execute && e.hp / e.maxHp < 0.38) raw *= 1.42;
    if (opts.crescent && e.slowTimer > 0) raw *= 1.18;
    var ap = opts.armorPierce != null ? opts.armorPierce : 1;
    var mit = e.armor ? 1 - e.armor * ap : 1;
    if (mit < 0.12) mit = 0.12;
    var dmg = raw > 0 ? raw * mit : 0;
    // Щит босса-стража: снижает входящий урон
    if (e._shieldT && e._shieldT > 0) dmg *= 0.55;
    var willKill = raw > 0 && e.hp - dmg <= 0;
    if (raw > 0) {
      e.hp -= dmg;
      e.hitFlash = 120;
      this._addParticles(e.x, e.y, hitColor || "#e2e8f0", 4);
    }
    if (slowAmt && slowAmt > 0) {
      var sr = typeof e.slowResist === "number" ? e.slowResist : 0;
      var effSlow = slowAmt * (1 - sr);
      if (effSlow > 0) {
        e.slowMul = Math.min(e.slowMul, 1 - effSlow);
        e.slowTimer = 2200;
      }
    }
    if (opts.extraSlow && opts.extraSlow > 0) {
      var sr2 = typeof e.slowResist === "number" ? e.slowResist : 0;
      var es = opts.extraSlow * (1 - sr2);
      if (es > 0) {
        e.slowMul = Math.min(e.slowMul, 1 - es);
        e.slowTimer = Math.max(e.slowTimer || 0, opts.bloomDuration || 2200);
      }
    }
    if (opts.dotBurn) {
      e.burnDps = opts.dotBurn.dps;
      e.burnT = opts.dotBurn.t;
    }
    if (opts.dotPoison) {
      e.poisonDps = opts.dotPoison.dps;
      e.poisonT = opts.dotPoison.t;
    }
    if (e.hp <= 0 && raw > 0) {
      if (opts.midas && willKill) {
        this.gold += 5;
        this.sessionGoldEarned += 5;
      }
      this._finalizeKill(e);
    }
  };

  Game.prototype._addParticles = function (x, y, color, n) {
    for (var k = 0; k < n; k++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        life: 400 + Math.random() * 300,
        color: color,
      });
    }
  };

  Game.prototype._updateParticles = function (dt) {
    for (var i = this.particles.length - 1; i >= 0; i--) {
      var p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  };

  Game.prototype._win = function () {
    this.running = false;
    if (this.onEnd) this.onEnd({ win: true });
  };

  Game.prototype._lose = function () {
    this.running = false;
    if (this.onEnd) this.onEnd({ win: false });
  };

  Game.prototype._notifyUi = function () {
    if (this.onUiUpdate) this.onUiUpdate();
  };

  Game.prototype.tryPlaceTower = function (gx, gy, typeId) {
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return false;
    if (this.cellOnPath(gx, gy)) return false;
    for (var i = 0; i < this.towers.length; i++) {
      if (this.towers[i].gx === gx && this.towers[i].gy === gy) return false;
    }
    var def = null;
    for (var t = 0; t < TOWER_TYPES.length; t++) {
      if (TOWER_TYPES[t].id === typeId) {
        def = TOWER_TYPES[t];
        break;
      }
    }
    if (!def) return false;
    if (!this.isTowerUnlocked(def)) return false;
    if (this.gold < def.cost) return false;

    this.gold -= def.cost;
    this.towers.push({
      gx: gx,
      gy: gy,
      x: gx * TILE + TILE / 2,
      y: gy * TILE + TILE / 2,
      def: def,
      cooldownLeft: 0,
      upgradeLevel: 0,
      uid: this._nextTowerUid++,
    });
    this._notifyUi();
    return true;
  };

  /** Сумма золота, потраченного на башню (покупка + все улучшения). */
  Game.prototype._towerInvestedGold = function (tw) {
    var def = tw.def;
    if (!def) return 0;
    var total = def.cost | 0;
    var L = tw.upgradeLevel | 0;
    for (var k = 1; k <= L; k++) {
      total += Math.floor(def.cost * (0.42 + k * 0.28));
    }
    return total;
  };

  /**
   * Снять башню с клетки. Возвращает 50% от вложенного золота (округление вниз).
   */
  Game.prototype.tryRemoveTower = function (gx, gy) {
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return false;
    var tw = this.towerAt(gx, gy);
    if (!tw) return false;
    var refund = (this._towerInvestedGold(tw) * 0.5) | 0;
    for (var i = 0; i < this.towers.length; i++) {
      if (this.towers[i].gx === gx && this.towers[i].gy === gy) {
        this.towers.splice(i, 1);
        break;
      }
    }
    this.gold += refund;
    this._notifyUi();
    return true;
  };

  Game.prototype.render = function () {
    var ctx = this.ctx;
    var at = this.animTime || 0;
    ctx.clearRect(0, 0, CW, CH);
    if (!this._staticLayer) this._buildStaticLayer();
    if (this._staticLayer) ctx.drawImage(this._staticLayer, 0, 0);

    // Анимированная подсветка линий путей (только dash-слой; лёгкий)
    var lanes = this.pathLanes || [{ waypoints: this.waypoints }];
    var li, wp, w;
    for (li = 0; li < lanes.length; li++) {
      wp = lanes[li].waypoints;
      var alphaLn = 0.78 + 0.08 * Math.sin(at * 0.002 + li * 0.7);
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (w = 0; w < wp.length; w++) {
        var pt = wp[w];
        if (w === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.setLineDash([14, 12]);
      ctx.lineDashOffset = -(at * 0.052 + li * 6) % 26;
      ctx.strokeStyle = "rgba(45, 212, 191, " + (0.14 * alphaLn) + ")";
      ctx.lineWidth = 11;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Анимированный dash для пещерной ветки (если есть)
    if (this.caveLane && this.caveLane.waypoints && this.caveLane.waypoints.length > 1) {
      var cwp = this.caveLane.waypoints;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (var cw = 0; cw < cwp.length; cw++) {
        var cpt = cwp[cw];
        if (cw === 0) ctx.moveTo(cpt.x, cpt.y);
        else ctx.lineTo(cpt.x, cpt.y);
      }
      ctx.setLineDash([10, 14]);
      ctx.lineDashOffset = -(at * 0.04) % 24;
      ctx.strokeStyle = "rgba(124, 58, 237, 0.25)";
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.setLineDash([]);

      // Вход шахты (кольца + ядро) — вернули после оптимизации
      var cx = cwp[0].x,
        cy = cwp[0].y;
      for (var cri = 0; cri < 4; cri++) {
        ctx.beginPath();
        ctx.arc(cx, cy, 5 + cri * 4 + Math.sin(at * 0.004 + cri) * 2, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(167, 139, 250, " + (0.5 - cri * 0.1) + ")";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      var caveGlow = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 9);
      caveGlow.addColorStop(0, "#faf5ff");
      caveGlow.addColorStop(0.45, "rgba(167, 139, 250, 0.9)");
      caveGlow.addColorStop(1, "rgba(88, 28, 135, 0.45)");
      ctx.fillStyle = caveGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    for (li = 0; li < lanes.length; li++) {
      wp = lanes[li].waypoints;
      var sx = wp[0].x,
        sy = wp[0].y;
      var ri;
      for (ri = 0; ri < 4; ri++) {
        ctx.beginPath();
        ctx.arc(sx, sy, 6 + ri * 5 + Math.sin(at * 0.0038 + ri * 0.9 + li * 0.4) * 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(94, 234, 212, " + (0.42 - ri * 0.09) + ")";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      var spawnCore = ctx.createRadialGradient(sx - 2, sy - 2, 1, sx, sy, 8);
      spawnCore.addColorStop(0, "#ecfeff");
      spawnCore.addColorStop(0.5, "rgba(94, 234, 212, 0.95)");
      spawnCore.addColorStop(1, "rgba(34, 211, 238, 0.5)");
      ctx.fillStyle = spawnCore;
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    wp = this.waypoints;
    var ex = wp[wp.length - 1].x,
      ey = wp[wp.length - 1].y;
    for (ri = 0; ri < 4; ri++) {
      ctx.beginPath();
      ctx.arc(ex, ey, 7 + ri * 5 + Math.sin(at * 0.0042 + ri * 0.85) * 2.5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(248, 113, 113, " + (0.38 - ri * 0.08) + ")";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    var endCore = ctx.createRadialGradient(ex - 2, ey - 2, 1, ex, ey, 10);
    endCore.addColorStop(0, "#fecaca");
    endCore.addColorStop(0.45, "rgba(248, 113, 113, 0.95)");
    endCore.addColorStop(1, "rgba(185, 28, 28, 0.55)");
    ctx.fillStyle = endCore;
    ctx.beginPath();
    ctx.arc(ex, ey, 7, 0, Math.PI * 2);
    ctx.fill();

    var vb;
    for (vb = 0; vb < this.visualBeams.length; vb++) {
      var bm = this.visualBeams[vb];
      ctx.save();
      ctx.globalAlpha = Math.min(1, ((bm.life != null ? bm.life : 120) / 200) * 0.95);
      ctx.strokeStyle = bm.color;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = bm.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(bm.x1, bm.y1);
      ctx.lineTo(bm.x2, bm.y2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    var ti;
    for (ti = 0; ti < this.towers.length; ti++) {
      drawTower(ctx, this.towers[ti], at);
    }

    var ei, e, bw, bh, ratio, barX, barY;
    for (ei = 0; ei < this.enemies.length; ei++) {
      e = this.enemies[ei];
      drawEnemy(ctx, e);
      bw = e.r * 1.65;
      bh = 5;
      barX = e.x - bw / 2;
      barY = e.y - e.r - 12;
      roundRectPath(ctx, barX - 1, barY - 1, bw + 2, bh + 2, 2.5);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fill();
      ratio = e.maxHp > 0 ? Math.max(0, Math.min(1, e.hp / e.maxHp)) : 0;
      var hpGrad = ctx.createLinearGradient(barX, 0, barX + bw * ratio, 0);
      hpGrad.addColorStop(0, "#15803d");
      hpGrad.addColorStop(0.5, "#22c55e");
      hpGrad.addColorStop(1, "#86efac");
      roundRectPath(ctx, barX, barY, bw * ratio, bh, 2);
      ctx.fillStyle = hpGrad;
      ctx.fill();
    }

    var pi, pr;
    for (pi = 0; pi < this.projectiles.length; pi++) {
      pr = this.projectiles[pi];
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.shadowColor = pr.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 10;
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(pr.x - 1.5, pr.y - 1.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    var pj, pp, pa;
    for (pj = 0; pj < this.particles.length; pj++) {
      pp = this.particles[pj];
      pa = Math.min(1, pp.life / 400);
      ctx.globalAlpha = pa;
      ctx.fillStyle = pp.color;
      ctx.shadowColor = pp.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    if (this.hoverCell) {
      var hx = this.hoverCell.gx,
        hy = this.hoverCell.gy;
      var def = this.hoverCell.def;
      if (hx >= 0 && hy >= 0 && hx < GW && hy < GH && def) {
        var occTw = this.towerAt(hx, hy);
        var ucHover = occTw ? this.getUpgradeCost(occTw) : null;
        var st = occTw ? this.effectiveStatsForTower(occTw) : this.effectiveStats(def);
        var cx = hx * TILE + TILE / 2,
          cy = hy * TILE + TILE / 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, st.range, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(94, 234, 212, 0.12)";
        ctx.lineWidth = 14;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, st.range, 0, Math.PI * 2);
        ctx.setLineDash([8, 10]);
        ctx.lineDashOffset = -(at * 0.04) % 18;
        ctx.strokeStyle = "rgba(165, 243, 252, 0.55)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        var hxPx = hx * TILE + 2,
          hyPx = hy * TILE + 2,
          twPx = TILE - 4,
          thPx = TILE - 4;
        var hovGrad = ctx.createLinearGradient(hxPx, hyPx, hxPx + twPx, hyPx + thPx);
        if (occTw) {
          var canUp = ucHover != null && this.gold >= ucHover;
          if (canUp) {
            hovGrad.addColorStop(0, "rgba(250, 204, 21, 0.2)");
            hovGrad.addColorStop(1, "rgba(59, 130, 246, 0.12)");
          } else if (ucHover == null) {
            hovGrad.addColorStop(0, "rgba(148, 163, 184, 0.18)");
            hovGrad.addColorStop(1, "rgba(71, 85, 105, 0.1)");
          } else {
            hovGrad.addColorStop(0, "rgba(248, 113, 113, 0.22)");
            hovGrad.addColorStop(1, "rgba(185, 28, 28, 0.1)");
          }
        } else {
          var okPlace = !this.cellOnPath(hx, hy) && this.gold >= def.cost;
          if (okPlace) {
            hovGrad.addColorStop(0, "rgba(94, 234, 212, 0.22)");
            hovGrad.addColorStop(1, "rgba(45, 212, 191, 0.1)");
          } else {
            hovGrad.addColorStop(0, "rgba(248, 113, 113, 0.28)");
            hovGrad.addColorStop(1, "rgba(185, 28, 28, 0.12)");
          }
        }
        ctx.fillStyle = hovGrad;
        roundRectPath(ctx, hxPx, hyPx, twPx, thPx, 4);
        ctx.fill();
        var strokeOk = occTw
          ? ucHover == null || this.gold >= ucHover
          : !this.cellOnPath(hx, hy) && this.gold >= def.cost;
        ctx.strokeStyle = strokeOk
          ? occTw && ucHover != null
            ? "rgba(250, 204, 21, 0.5)"
            : "rgba(94, 234, 212, 0.45)"
          : "rgba(248, 113, 113, 0.5)";
        ctx.lineWidth = 1.5;
        roundRectPath(ctx, hxPx + 0.5, hyPx + 0.5, twPx - 1, thPx - 1, 3.5);
        ctx.stroke();
      }
    }
  };

  Game.prototype.screenToGrid = function (mx, my) {
    var rect = this.canvas.getBoundingClientRect();
    var scaleX = CW / rect.width;
    var scaleY = CH / rect.height;
    var x = (mx - rect.left) * scaleX;
    var y = (my - rect.top) * scaleY;
    var gx = (x / TILE) | 0;
    var gy = (y / TILE) | 0;
    return { gx: gx, gy: gy, x: x, y: y };
  };

  Game.prototype.loop = function (ts) {
    var self = this;
    if (!this._lastTs) this._lastTs = ts;
    var dt = ts - this._lastTs;
    this._lastTs = ts;
    if (dt > 80) dt = 80;
    this.tick(dt);
    this.render();
    if (this.running) this._raf = requestAnimationFrame(function (t) {
      self.loop(t);
    });
  };

  Game.prototype.start = function () {
    this.running = true;
    this._lastTs = 0;
    var self = this;
    this._raf = requestAnimationFrame(function (t) {
      self.loop(t);
    });
  };

  Game.prototype.stop = function () {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  };

  return {
    Game: Game,
    TOWER_TYPES: TOWER_TYPES,
    ENEMY_CATALOG: ENEMY_CATALOG,
    TILE: TILE,
    TOWER_UPGRADE_MAX: TOWER_UPGRADE_MAX,
    canvasW: CW,
    canvasH: CH,
    GW: GW,
    GH: GH,
  };
})();
