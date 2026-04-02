/**
 * Сезонные события: весеннее окно (март–май) для пасхального меню.
 * Даты считаются по локальному времени устройства.
 */
var SeasonEvents = (function () {
  var MONTHS_RU = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];

  /** Пасха (западный расчёт) */
  function easterSundayWestern(year) {
    var a = year % 19;
    var b = (year / 100) | 0;
    var c = year % 100;
    var d = (b / 4) | 0;
    var e = b % 4;
    var f = ((b + 8) / 25) | 0;
    var g = ((b - f + 1) / 3) | 0;
    var h = (19 * a + b - d - g + 15) % 30;
    var i = (c / 4) | 0;
    var k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = ((a + 11 * h + 22 * l) / 451) | 0;
    var month = ((h + l - 7 * m + 114) / 31) | 0;
    var day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  /** Метеорологическая весна: 1 марта — 31 мая */
  function isSpringSeason() {
    var d = new Date();
    var m = d.getMonth();
    return m === 2 || m === 3 || m === 4;
  }

  function getEventDescription() {
    var y = new Date().getFullYear();
    var e = easterSundayWestern(y);
    var ed = e.getDate();
    var em = MONTHS_RU[e.getMonth()];
    return (
      "Событие доступно каждую весну (март — май) и скрывается летом, осенью и зимой. " +
      "В " +
      y +
      " году Пасха — " +
      ed +
      " " +
      em +
      "."
    );
  }

  return {
    isSpringSeason: isSpringSeason,
    easterSundayWestern: easterSundayWestern,
    getEventDescription: getEventDescription,
  };
})();
