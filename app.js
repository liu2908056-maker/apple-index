(function () {
  "use strict";

  var RANGES = {
    weight: [30, 200, "请填 30 到 200 公斤，或留空。"],
    waterMl: [0, 8000, "请填 0 到 8000 毫升。"],
    sleepHours: [0, 16, "请填 0 到 16 小时。如果这是分钟，8 小时请填 8。"],
    deepMin: [0, 600, "深睡请填 0 到 600 分钟。"],
    awakenings: [0, 30, "清醒次数请填 0 到 30。"],
    sleepScore: [0, 100, "睡眠评分请填 0 到 100。"],
    strengthMin: [0, 300, "力量训练请填 0 到 300 分钟。"],
    proteinG: [0, 300, "蛋白质请填 0 到 300 克。"],
    steps: [0, 80000, "步数请填 0 到 80000。"],
    exerciseMin: [0, 300, "中高强度请填 0 到 300 分钟。"],
    standHours: [0, 24, "站立请填 0 到 24 小时。"],
    kcal: [0, 5000, "活动消耗请填 0 到 5000 千卡。"],
    restingHr: [30, 220, "静息心率请填 30 到 220。"],
    avgHr: [30, 220, "平均心率请填 30 到 220。"],
    spo2: [70, 100, "血氧请填 70 到 100。"],
    stress: [1, 100, "压力请填 1 到 100。"],
    veggies: [0, 15, "蔬菜请填 0 到 15 份。"],
    sugarG: [0, 300, "添加糖请填 0 到 300 克。"],
    sunMin: [0, 300, "日照请填 0 到 300 分钟。"],
    phoneMin: [0, 360, "睡前屏幕请填 0 到 360 分钟。"]
  };

  var OPTIONAL = [
    "weight", "deepMin", "awakenings", "sleepScore", "kcal",
    "restingHr", "avgHr", "spo2", "stress",
    "veggies", "sugarG", "sunMin", "phoneMin"
  ];

  var DRAFT_KEY = "apple-index-draft-v1";
  var HISTORY_KEY = "apple-index-history-v1";
  var mode = null;
  var lastResult = null;

  var $ = function (id) { return document.getElementById(id); };

  function todayKey(date) {
    var d = date || new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function num(id) {
    var el = $(id);
    if (!el || el.value.trim() === "") return null;
    var n = Number(el.value);
    return Number.isFinite(n) ? n : null;
  }

  function readInput() {
    return {
      weight: num("weight"),
      waterMl: num("waterMl"),
      sleepHours: num("sleepHours"),
      deepMin: num("deepMin"),
      awakenings: num("awakenings"),
      sleepScore: num("sleepScore"),
      mode: mode,
      strengthMin: num("strengthMin"),
      proteinG: num("proteinG"),
      steps: num("steps"),
      exerciseMin: num("exerciseMin"),
      standHours: num("standHours"),
      kcal: num("kcal"),
      restingHr: num("restingHr"),
      avgHr: num("avgHr"),
      spo2: num("spo2"),
      stress: num("stress"),
      veggies: num("veggies"),
      sugarG: num("sugarG"),
      sunMin: num("sunMin"),
      phoneMin: num("phoneMin")
    };
  }

  function showError(id, message) {
    var el = $("err-" + id);
    var input = $(id);
    if (input) input.classList.toggle("bad", Boolean(message));
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
  }

  function clearErrors() {
    Object.keys(RANGES).forEach(function (id) { showError(id, ""); });
    showError("mode", "");
  }

  function validate(input) {
    var ok = true;
    clearErrors();
    Object.keys(RANGES).forEach(function (id) {
      var value = input[id];
      if (value == null) return;
      var range = RANGES[id];
      if (value < range[0] || value > range[1]) {
        showError(id, range[2]);
        ok = false;
      }
    });
    if (input.waterMl != null && input.waterMl > 0 && input.waterMl <= 10) {
      showError("waterMl", "这里填毫升。2 升请写成 2000。");
      ok = false;
    }
    if (input.proteinG != null && input.proteinG > 0 && input.proteinG < 5) {
      showError("proteinG", "这里填今天的总克数，不是每公斤。例如 80。");
      ok = false;
    }
    return ok;
  }

  function missingCount() {
    var input = readInput();
    var n = 0;
    if (input.waterMl == null) n += 1;
    if (input.sleepHours == null) n += 1;
    if (input.proteinG == null) n += 1;
    if (input.steps == null) n += 1;
    if (input.exerciseMin == null) n += 1;
    if (input.standHours == null) n += 1;
    if (input.mode !== "train" && input.mode !== "rest") n += 1;
    else if (input.mode === "train" && input.strengthMin == null) n += 1;
    return n;
  }

  function updateFillNote() {
    var n = missingCount();
    $("fill-note").textContent = n === 0 ? "必填已经齐了" : "必填还差 " + n + " 项";
    if (!lastResult) {
      $("dock-text").textContent = n === 0 ? "可以计算了" : "还差 " + n + " 项必填";
    }
  }

  function updateHints() {
    var targets = AppleIndex.targetsFor(num("weight"));
    var water = "满分大约 " + targets.waterLow + "–" + targets.waterHigh + " 毫升。再多不会更高。";
    var protein = "满分大约 " + targets.proteinLow + "–" + targets.proteinHigh + " 克。";
    if (targets.personalized) {
      $("targetHint").textContent = "按这个体重，饮水满分 " + targets.waterLow + "–" + targets.waterHigh + " 毫升，蛋白质满分 " + targets.proteinLow + "–" + targets.proteinHigh + " 克。";
    } else {
      $("targetHint").textContent = "不填就用通用目标：饮水 1800–2800 毫升，蛋白质 65–130 克。";
    }
    $("waterHint").textContent = water + " 2 升请写成 2000。白水、茶、黑咖啡都算。";
    $("proteinHint").textContent = protein + " 一只鸡蛋大约 6 克，一杯牛奶大约 8 克。";
  }

  function setMode(next) {
    mode = next;
    $("mode-train").setAttribute("aria-pressed", String(next === "train"));
    $("mode-rest").setAttribute("aria-pressed", String(next === "rest"));
    var strength = $("strengthMin");
    var resting = next === "rest";
    strength.disabled = resting;
    $("strength-wrap").style.opacity = resting ? "0.55" : "1";
    if (resting) showError("strengthMin", "");
    updateFillNote();
    saveDraft();
  }

  function mix(a, b, t) {
    var pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
    var pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
    var c = pa.map(function (v, i) { return Math.round(v + (pb[i] - v) * t); });
    return "rgb(" + c.join(",") + ")";
  }

  function paintApple(index) {
    var t = (index == null ? 0.35 : index / 10);
    $("apple-body").setAttribute("fill", mix("#8b9468", "#c4372c", Math.min(1, t * 1.12)));
    $("apple-leaf").setAttribute("fill", mix("#8aa06a", "#2d6a45", t));
    $("apple-gloss").setAttribute("opacity", String(0.18 + t * 0.55));
    $("dock-apple").style.background = mix("#c9c3a4", "#c4372c", Math.min(1, t * 1.12));
  }

  function ringCirc(r) {
    return 2 * Math.PI * r;
  }

  function setRing(id, pct) {
    var el = $(id);
    var r = Number(el.getAttribute("r"));
    var c = ringCirc(r);
    var p = Math.max(0, Math.min(100, pct)) / 100;
    el.style.strokeDasharray = String(c);
    el.style.strokeDashoffset = String(c * (1 - p));
  }

  var photoToken = 0;
  function animateAppleStage() {
    var stage = document.querySelector(".apple-stage");
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    stage.classList.remove("is-updating");
    void stage.offsetWidth;
    stage.classList.add("is-updating");
    window.setTimeout(function () { stage.classList.remove("is-updating"); }, 820);
  }

  function loadApplePhoto(index) {
    var img = $("apple-photo");
    var svg = $("apple-svg");
    var token = ++photoToken;
    animateAppleStage();
    var base = new URL("images/apple-" + index + ".b64", document.baseURI);
    img.alt = "苹果指数 " + index + " 对应的苹果图片";
    img.hidden = true;
    svg.hidden = false;
    img.removeAttribute("src");

    fetch(base.href, { cache: "force-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("Apple image unavailable: " + res.status);
        return res.text();
      })
      .then(function (encoded) {
        if (token !== photoToken) return;
        var clean = encoded.replace(/^data:image\\/[a-zA-Z0-9.+-]+;base64,/, "").replace(/\\s/g, "");
        if (!clean || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) throw new Error("Invalid encoded image");
        img.onload = function () {
          if (token !== photoToken) return;
          img.hidden = false;
          svg.hidden = true;
        };
        img.onerror = function () {
          if (token !== photoToken) return;
          img.hidden = true;
          svg.hidden = false;
          img.removeAttribute("src");
        };
        img.src = "data:image/jpeg;base64," + clean;
      })
      .catch(function () {
        if (token !== photoToken) return;
        img.hidden = true;
        img.removeAttribute("src");
        svg.hidden = false;
      });
  }
  function renderEmpty(message, detail) {
    $("index-num").textContent = "—";
    $("level-name").textContent = message;
    $("level-line").textContent = detail || "";
    $("fine-score").textContent = "";
    $("rings").hidden = true;
    $("meters").hidden = true;
    $("tips").hidden = true;
    $("cautions").hidden = true;
    $("result-actions").hidden = true;
    $("compare").hidden = true;
    $("apple-photo").hidden = true;
    $("apple-svg").hidden = false;
    paintApple(null);
  }

  function renderResult(result) {
    lastResult = result;
    $("index-num").textContent = String(result.index);
    $("level-name").textContent = result.level.name;
    $("level-line").textContent = result.level.line;
    var fine = "苹果分 <b>" + result.score.toFixed(1) + "</b>";
    fine += result.capped
      ? " · 体征读数把指数停在 6，苹果分仍是原来的生活分"
      : " · 指数看苹果，分数看同一颗里面的进步";
    $("fine-score").innerHTML = fine;
    paintApple(result.index);
    loadApplePhoto(result.index);

    $("rings").hidden = false;
    setRing("ring-move", result.rings.move);
    setRing("ring-exercise", result.rings.exercise);
    setRing("ring-stand", result.rings.stand);
    $("ring-move-n").textContent = result.rings.move;
    $("ring-exercise-n").textContent = result.rings.exercise;
    $("ring-stand-n").textContent = result.rings.stand;

    var meters = $("meters");
    meters.hidden = false;
    meters.innerHTML = result.pillars.map(function (p) {
      return '<li><span class="name">' + p.name + '</span><span class="bar"><i style="width:' + p.score + "%;background:" + p.color + '"></i></span><b>' + p.score + '</b><span class="detail">' + p.detail + "</span></li>";
    }).join("");

    var cautions = $("cautions");
    cautions.hidden = result.cautions.length === 0;
    cautions.innerHTML = result.cautions.map(function (text) {
      return '<p class="caution">' + text + "</p>";
    }).join("");

    var tips = $("tips");
    var tipItems = result.tips.slice();
    if (!tipItems.length) {
      tipItems = [{ title: "今天没有明显短板", text: "保持这个区间，比再加量更重要。" }];
    }
    tips.hidden = false;
    tips.innerHTML = tipItems.map(function (tip) {
      return '<p class="tip"><strong>' + tip.title + "</strong>" + tip.text + "</p>";
    }).join("");

    $("result-actions").hidden = false;
    $("dock-text").textContent = "苹果指数 " + result.index + " · " + result.level.name;
    renderCompare(result.index);
    renderHistory();
  }

  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function renderCompare(index) {
    var history = loadHistory();
    var y = new Date();
    y.setDate(y.getDate() - 1);
    var prev = history[todayKey(y)];
    var el = $("compare");
    if (!prev || typeof prev.index !== "number") {
      el.hidden = true;
      return;
    }
    var delta = index - prev.index;
    el.hidden = false;
    if (delta > 0) el.textContent = "比昨天的苹果 +" + delta + "。";
    else if (delta < 0) el.textContent = "比昨天低 " + Math.abs(delta) + "。看看今天最弱的那一项。";
    else el.textContent = "和昨天一样，是 " + index + "。苹果分还能在同一颗里面往上走。";
  }

  function renderHistory() {
    var history = loadHistory();
    var list = $("history-list");
    var wrap = $("history");
    var keys = Object.keys(history).sort();
    if (!keys.length) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    list.innerHTML = days.map(function (d) {
      var key = todayKey(d);
      var item = history[key];
      var label = (d.getMonth() + 1) + "/" + d.getDate();
      var today = key === todayKey() ? " today" : "";
      if (!item) {
        return '<li class="empty' + today + '"><div class="bar"><span style="height:4px"></span></div><span>' + label + "</span></li>";
      }
      var h = Math.max(8, Math.round((item.score / 100) * 46));
      return '<li class="' + today.trim() + '"><div class="bar"><span style="height:' + h + 'px"></span></div><span>' + item.index + "</span></li>";
    }).join("");
  }

  function saveDraft() {
    var data = { date: todayKey(), mode: mode, values: {} };
    Object.keys(RANGES).forEach(function (id) {
      data.values[id] = $(id).value;
    });
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  }

  function restoreDraft() {
    var raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      var data = JSON.parse(raw);
      if (!data || data.date !== todayKey() || !data.values) return;
      Object.keys(data.values).forEach(function (id) {
        if ($(id) && data.values[id] != null) $(id).value = data.values[id];
      });
      if (data.mode === "train" || data.mode === "rest") setMode(data.mode);
    } catch (e) {
      localStorage.removeItem(DRAFT_KEY);
    }
  }

  function calculateAndRender(scroll) {
    var input = readInput();
    if (!validate(input)) {
      renderEmpty("有一项数字出了范围", "按红字改完再计算。");
      return;
    }
    var result = AppleIndex.calculate(input);
    if (!result.ready) {
      renderEmpty("还差几项必填", "请补上：" + result.missing.join("、") + "。");
      $("dock-text").textContent = "还差 " + result.missing.length + " 项";
      return;
    }
    renderResult(result);
    if (scroll) {
      $("result").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }


  function clearForm() {
    Object.keys(RANGES).forEach(function (id) { $(id).value = ""; });
    setMode(null);
    mode = null;
    $("mode-train").setAttribute("aria-pressed", "false");
    $("mode-rest").setAttribute("aria-pressed", "false");
    $("strengthMin").disabled = false;
    $("strength-wrap").style.opacity = "1";
    lastResult = null;
    clearErrors();
    localStorage.removeItem(DRAFT_KEY);
    renderEmpty("填完必填项，算出今天的苹果", "必填是饮水、睡眠、练或休息、蛋白质、步数、中高强度、站立。手环和饮食空着也能算。");
    updateHints();
    updateFillNote();
    renderHistory();
  }

  function saveToday() {
    if (!lastResult) return;
    var history = loadHistory();
    history[todayKey()] = {
      index: lastResult.index,
      score: lastResult.score,
      name: lastResult.level.name,
      savedAt: new Date().toISOString()
    };
    var keys = Object.keys(history).sort();
    keys.slice(0, Math.max(0, keys.length - 30)).forEach(function (key) { delete history[key]; });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    $("save-note").hidden = false;
    $("save-note").textContent = "已记下今天的 " + lastResult.index + " · " + lastResult.level.name;
    renderHistory();
    renderCompare(lastResult.index);
  }

  function copyResult() {
    if (!lastResult) return;
    var lines = [
      "苹果指数 " + lastResult.index + "/10 · " + lastResult.level.name,
      "苹果分 " + lastResult.score.toFixed(1)
    ];
    lastResult.pillars.forEach(function (p) {
      lines.push(p.name + " " + p.score);
    });
    var text = lines.join("\n");
    var done = function () {
      $("save-note").hidden = false;
      $("save-note").textContent = "结果已复制，可以贴到聊天里。";
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    var area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    done();
  }

  function syncChips() {
    document.querySelectorAll(".chips button").forEach(function (btn) {
      var id = btn.getAttribute("data-set");
      var pressed = $(id) && $(id).value === btn.getAttribute("data-value");
      btn.setAttribute("aria-pressed", String(pressed));
    });
  }

  document.querySelectorAll("[data-set]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-set");
      $(id).value = btn.getAttribute("data-value");
      $(id).dispatchEvent(new Event("input", { bubbles: true }));
    });
  });

  $("mode-train").addEventListener("click", function () { setMode("train"); });
  $("mode-rest").addEventListener("click", function () { setMode("rest"); });
  $("quiz").addEventListener("submit", function (event) {
    event.preventDefault();
    calculateAndRender(true);
  });

  $("clear-btn").addEventListener("click", clearForm);
  $("save-btn").addEventListener("click", saveToday);
  $("copy-btn").addEventListener("click", copyResult);
  $("dock-btn").addEventListener("click", function () {
    if (missingCount() === 0) calculateAndRender(true);
    else $("quiz").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("quiz").addEventListener("input", function () {
    updateHints();
    updateFillNote();
    syncChips();
    saveDraft();
  });

  ["ring-move", "ring-exercise", "ring-stand"].forEach(function (id) { setRing(id, 0); });
  paintApple(null);
  restoreDraft();
  updateHints();
  updateFillNote();
  syncChips();
  renderHistory();
})();