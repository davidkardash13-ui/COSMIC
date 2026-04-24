/* eslint-disable no-unused-vars */
var GAME_CONFIG = {
  /** Семантическая версия (показ V-x.y.z в меню). */
  APP_VERSION: "1.0.6",
  /** Должно совпадать с ?v= у link/script в index.html (сброс кэша CSS/JS). */
  ASSET_VERSION: "21",
  MAX_WAVES: 30,
  START_LIVES: 12,
  START_GOLD: 140,
  WAVE_REWARD: 16,
  TILE: 40,
  /**
   * Случайный размер карты на каждый заход (клетки).
   * Форма: случайно «широкая», «высокая» или без явного уклона.
   */
  MAP_GRID: {
    W_MIN: 18,
    W_MAX: 32,
    H_MIN: 9,
    H_MAX: 18,
  },
  /** Порталы — доп. проходы врагов; башни разрушают их по HP. */
  ENEMY_BURROW: {
    // Отключено: дополнительные проходы (порталы) не появляются.
    MAX_ACTIVE: 0,
    ATTEMPT_INTERVAL_MS_MIN: 4200,
    ATTEMPT_INTERVAL_MS_MAX: 8800,
    SPAWN_CHANCE: 0,
  },
  /** Кристаллы за убийство босса (волны 10 / 20 / 30) */
  GEMS_BOSS_KILL: 5,
  /** За завершение любой волны */
  GEMS_WAVE_CLEAR: 1,
  /** Дополнительно каждые 5 волн (5, 10, 15…) */
  GEMS_EVERY_5_WAVES: 2,
  /** Бонус за завершение волны-босса 10 / 20 / 30 */
  GEMS_MILESTONE_WAVE: 4,
  /** За убийство титана (редкий враг) */
  GEMS_TITAN_KILL: 2,
  /** Награда за полную победу (дополнительно к накопленному в бою) */
  GEMS_VICTORY_BONUS: 28,

  /** Множители сложности (применяются к HP и скорости волн; бонусы — к старту) */
  DIFFICULTY: {
    easy: { hpMul: 0.78, speedMul: 0.88, livesBonus: 4, goldBonus: 55, label: "Лёгкая" },
    normal: { hpMul: 1, speedMul: 1, livesBonus: 0, goldBonus: 0, label: "Обычная" },
    hard: { hpMul: 1.32, speedMul: 1.12, livesBonus: -4, goldBonus: -35, label: "Сложная" },
    // «Невозможно» должна ощущаться сурово, но оставаться честно проходимой (это не "чит").
    impossible: { hpMul: 1.38, speedMul: 1.08, livesBonus: -3, goldBonus: -20, label: "Невозможно" },
  },

  /** Промокоды (регистр не важен). Можно добавлять свои. */
  PROMO_CODES: {
    WELCOME: { gold: 250, gems: 25, title: "Стартовый набор" },
    AETHER: { gold: 400, gems: 15, title: "Эфирный бонус" },
    MYSTERY: { gold: 180, gems: 40, title: "Загадочный подарок" },
    DIAMOND280: { gold: 0, gems: 280, title: "280 кристаллов" },
  },
};
