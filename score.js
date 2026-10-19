/* 苹果指数：各维度在健康区间取满分，过量降分。空着的选填项不计入，权重分给已填项。 */
(function (root) {
  "use strict";

  var LEVELS = [
    { index: 0, name: "你不配叫苹果", line: "字面意思，你无敌了" },
    { index: 1, name: "便秘苹果", line: "喝点水动动，疏通疏通吧" },
    { index: 2, name: "肾虚苹果", line: "多喝点水早点睡吧" },
    { index: 3, name: "哭哭苹果", line: "委屈巴巴" },
    { index: 4, name: "小粉苹果", line: "开始有点样子了，加油" },
    { index: 5, name: "亲亲苹果", line: "开始有气色了，再加加油" },
    { index: 6, name: "大睡苹果", line: "觉睡到位了" },
    { index: 7, name: "小红苹果", line: "红扑扑的" },
    { index: 8, name: "大粉苹果", line: "又大又粉" },
    { index: 9, name: "大红苹果", line: "苹果代言人" },
    { index: 10, name: "散发光芒", line: "库克都没你苹果" }
  ];

  var INDEX_EDGES = [12, 24, 36, 46, 56, 65, 73, 80, 87, 93];

  function clamp(n, a, b) {
    return Math.min(b, Math.max(a, n));
  }

  function lerpScore(value, points) {
    if (value <= points[0][0]) return points[0][1];
    for (var i = 1; i < points.length; i++) {
      var x0 = points[i - 1][0];
      var y0 = points[i - 1][1];
      var x1 = points[i][0];
      var y1 = points[i][1];
      if (value <= x1) {
        var t = (value - x0) / (x1 - x0);
        return y0 + (y1 - y0) * t;
      }
    }
    return points[points.length - 1][1];
  }

  function weighted(items) {
    var total = 0;
    var acc = 0;
    for (var i = 0; i < items.length; i++) {
      total += items[i].weight;
      acc += items[i].score * items[i].weight;
    }
    if (!total) return null;
    return acc / total;
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function targetsFor(weight) {
    var usable = typeof weight === "number" && weight >= 30 && weight <= 200;
    if (!usable) {
      return { waterLow: 1800, waterHigh: 2800, proteinLow: 65, proteinHigh: 130, personalized: false };
    }
    var waterLow = clamp(weight * 30, 1500, 2800);
    var waterHigh = clamp(weight * 40, 2200, 3600);
    if (waterHigh < waterLow + 300) waterHigh = waterLow + 300;
    return {
      waterLow: Math.round(waterLow),
      waterHigh: Math.round(waterHigh),
      proteinLow: Math.round(weight * 1.2),
      proteinHigh: Math.round(weight * 2.0),
      personalized: true
    };
  }

  function toIndex(score) {
    var i = 0;
    for (; i < INDEX_EDGES.length; i++) {
      if (score < INDEX_EDGES[i]) return i;
    }
    return 10;
  }

  function scoreWater(ml, targets) {
    var low = targets.waterLow;
    var high = targets.waterHigh;
    ml = clamp(ml, 0, 8000);
    var score;
    if (ml <= low) {
      score = lerpScore(ml, [
        [0, 0],
        [low * 0.35, 26],
        [low * 0.6, 50],
        [low * 0.85, 76],
        [low, 100]
      ]);
    } else if (ml <= high) {
      score = 100;
    } else {
      score = lerpScore(ml, [
        [high, 100],
        [high + 800, 76],
        [high + 1800, 54],
        [high + 3000, 38]
      ]);
    }
    var state = ml < low * 0.9 ? "low" : ml > high ? "high" : "ok";
    return { score: score, state: state, low: low, high: high, value: ml };
  }

  function scoreSleepHours(hours) {
    return lerpScore(clamp(hours, 0, 16), [
      [0, 0],
      [3, 6],
      [4, 16],
      [5, 34],
      [6, 55],
      [6.5, 70],
      [7, 86],
      [7.5, 100],
      [9, 100],
      [9.5, 88],
      [10.5, 70],
      [12, 50],
      [14, 34],
      [16, 22]
    ]);
  }

  function scoreDeep(min, sleepHours) {
    var byMin = lerpScore(clamp(min, 0, 600), [
      [0, 12],
      [30, 46],
      [50, 74],
      [70, 100],
      [130, 100],
      [170, 78],
      [220, 58]
    ]);
    if (!sleepHours || sleepHours <= 0) return byMin;
    var ratio = min / (sleepHours * 60);
    var byRatio = lerpScore(ratio, [
      [0, 12],
      [0.08, 42],
      [0.13, 78],
      [0.15, 100],
      [0.25, 100],
      [0.32, 76],
      [0.42, 52]
    ]);
    return Math.max(byMin, byRatio);
  }

  function scoreAwake(n) {
    return lerpScore(clamp(n, 0, 30), [
      [0, 100],
      [1, 100],
      [2, 82],
      [3, 64],
      [5, 40],
      [8, 22]
    ]);
  }

  function scoreStrength(min, restDay) {
    if (restDay) return { score: 48, state: "rest", value: null };
    min = clamp(min, 0, 300);
    return {
      score: lerpScore(min, [
        [0, 16],
        [10, 44],
        [20, 74],
        [25, 100],
        [55, 100],
        [80, 84],
        [120, 64],
        [180, 48]
      ]),
      state: min < 20 ? "low" : min > 90 ? "high" : "ok",
      value: min
    };
  }

  function scoreProtein(g, targets) {
    var low = targets.proteinLow;
    var high = targets.proteinHigh;
    g = clamp(g, 0, 300);
    var score;
    if (g <= low) {
      score = lerpScore(g, [
        [0, 6],
        [low * 0.4, 34],
        [low * 0.7, 62],
        [low, 100]
      ]);
    } else if (g <= high) {
      score = 100;
    } else {
      score = lerpScore(g, [
        [high, 100],
        [high + 40, 80],
        [high + 90, 62]
      ]);
    }
    return {
      score: score,
      state: g < low * 0.85 ? "low" : g > high ? "high" : "ok",
      low: low,
      high: high,
      value: g
    };
  }

  function scoreSteps(n) {
    return lerpScore(clamp(n, 0, 80000), [
      [0, 2],
      [2000, 22],
      [4000, 42],
      [6000, 60],
      [8000, 80],
      [10000, 100],
      [14000, 100],
      [18000, 86],
      [25000, 70],
      [40000, 52]
    ]);
  }

  function scoreExercise(min) {
    return lerpScore(clamp(min, 0, 300), [
      [0, 6],
      [10, 36],
      [20, 66],
      [30, 100],
      [60, 100],
      [90, 84],
      [150, 64]
    ]);
  }

  function scoreStand(hours) {
    return lerpScore(clamp(hours, 0, 24), [
      [0, 4],
      [3, 26],
      [6, 52],
      [8, 72],
      [10, 88],
      [12, 100],
      [16, 100],
      [24, 100]
    ]);
  }

  function scoreKcal(kcal) {
    return lerpScore(clamp(kcal, 0, 5000), [
      [0, 6],
      [120, 38],
      [220, 70],
      [300, 100],
      [650, 100],
      [900, 78],
      [1400, 58]
    ]);
  }

  function scoreRhr(hr) {
    return lerpScore(clamp(hr, 30, 220), [
      [30, 50],
      [40, 70],
      [45, 86],
      [50, 100],
      [62, 100],
      [70, 84],
      [78, 64],
      [88, 42],
      [100, 26],
      [120, 12]
    ]);
  }

  function scoreAvgHr(hr) {
    return lerpScore(clamp(hr, 30, 220), [
      [40, 68],
      [55, 100],
      [85, 100],
      [95, 70],
      [110, 42],
      [140, 20]
    ]);
  }

  function scoreSpo2(n) {
    return lerpScore(clamp(n, 70, 100), [
      [85, 8],
      [90, 16],
      [93, 38],
      [95, 70],
      [96, 84],
      [98, 100],
      [100, 100]
    ]);
  }

  function scoreStress(n) {
    return lerpScore(clamp(n, 1, 100), [
      [1, 100],
      [25, 100],
      [40, 82],
      [55, 62],
      [70, 40],
      [85, 24],
      [100, 10]
    ]);
  }

  function scoreVeg(n) {
    return lerpScore(clamp(n, 0, 15), [
      [0, 10],
      [1, 36],
      [2, 60],
      [3, 82],
      [4, 100],
      [7, 100],
      [10, 86]
    ]);
  }

  function scoreSugar(g) {
    return lerpScore(clamp(g, 0, 300), [
      [0, 100],
      [20, 100],
      [35, 80],
      [50, 58],
      [80, 32],
      [120, 14]
    ]);
  }

  function scoreSun(min) {
    return lerpScore(clamp(min, 0, 300), [
      [0, 20],
      [8, 56],
      [15, 100],
      [40, 100],
      [70, 80],
      [120, 60]
    ]);
  }

  function scorePhone(min) {
    return lerpScore(clamp(min, 0, 360), [
      [0, 100],
      [10, 100],
      [25, 80],
      [45, 56],
      [90, 30],
      [180, 14]
    ]);
  }

  function fmtRange(a, b, unit) {
    return Math.round(a) + "–" + Math.round(b) + (unit || "");
  }

  function buildTips(ctx) {
    var tips = [];
    function add(id, score, title, text) {
      tips.push({ id: id, score: score, title: title, text: text });
    }

    if (ctx.water.state === "high") {
      add("water", ctx.water.score, "水已经超量", "大水不是灌水。接下来小口喝，看尿色就好。");
    } else if (ctx.water.score < 80) {
      add("water", ctx.water.score, "水还没到区间", "下一杯先喝 300 毫升。满分区间写在这一项下面。");
    }

    if (ctx.sleepHours < 7) {
      add("sleep", ctx.sleep.score, "觉还不够", "大睡理论里，今晚优先补到 7 小时半，比加练更值。");
    } else if (ctx.sleepHours > 10) {
      add("sleep", ctx.sleep.score, "睡得偏长", "时长已经够了。把起床时间固定住，比继续补觉更有用。");
    } else if (ctx.sleep.score < 80) {
      add("sleep", ctx.sleep.score, "睡眠质量还能抬", "深睡或清醒次数在拖后腿。睡前一小时把屏幕收起来。");
    }

    if (ctx.strength.state === "low") {
      add("strength", ctx.strength.score, "薄肌还差一段力量", "不需要练很久。再做 15 分钟力量，比多跑一段更贴这个理论。");
    } else if (ctx.strength.state === "high") {
      add("strength", ctx.strength.score, "今天练得偏久", "薄肌吃的是质量和恢复。收工，把剩下的时间留给吃饭和睡觉。");
    }

    if (ctx.protein.state === "low") {
      add("protein", ctx.protein.score, "蛋白质还没到平台", "加一份鸡蛋、豆腐、奶或一块掌心肉。");
    } else if (ctx.protein.state === "high") {
      add("protein", ctx.protein.score, "蛋白质已经够了", "再堆不会让苹果更红。把位置留给蔬菜。");
    }

    if (ctx.steps < 8000) {
      add("steps", ctx.stepScore, "步数还没到八千", "饭后走 15 分钟，移动环会自己长一截。");
    }
    if (ctx.exercise < 30) {
      add("exercise", ctx.exerciseScore, "锻炼环还没合上", "快走、爬楼或跟练，凑满 30 分钟中高强度。");
    }
    if (ctx.stand < 10) {
      add("stand", ctx.standScore, "站立小时偏少", "每小时起来站一分钟，比连坐一下午更接近站立环。");
    }
    if (ctx.restingHr != null && ctx.restingHr >= 80) {
      add("rhr", ctx.rhrScore, "静息心率偏高", "多半是睡不够，或身体还没恢复。今天把强度放下。");
    }
    if (ctx.stress != null && ctx.stress >= 60) {
      add("stress", ctx.stressScore, "压力值偏高", "离开屏幕走 10 分钟。这比再刷一小时更能把指数拉回来。");
    }
    if (ctx.veggies != null && ctx.veggies < 3) {
      add("veg", ctx.vegScore, "蔬菜还不够", "下一餐加两个拳头的菜。");
    }
    if (ctx.sugar != null && ctx.sugar > 35) {
      add("sugar", ctx.sugarScore, "添加糖偏多", "下一份甜的换成水果。");
    }
    if (ctx.sun != null && ctx.sun < 15) {
      add("sun", ctx.sunScore, "日照几乎没有", "白天出门 15 分钟。昼夜节律会谢你，觉也会更好睡。");
    }
    if (ctx.phone != null && ctx.phone > 30) {
      add("phone", ctx.phoneScore, "睡前屏幕太长", "定一个放下手机的时间。深睡常常就是被这半小时偷走的。");
    }

    tips.sort(function (a, b) { return a.score - b.score; });
    var picked = [];
    if (ctx.spo2 != null && ctx.spo2 < 95) {
      picked.push({
        id: "spo2",
        score: ctx.spo2Score,
        title: "血氧读数偏低",
        text: "先静坐，重新测一次。若反复低于 95%，请去看医生。指数只作参考。"
      });
    }
    for (var i = 0; i < tips.length && picked.length < 3; i++) {
      picked.push(tips[i]);
    }
    return picked;
  }

  function calculate(input) {
    var missing = [];
    if (input.waterMl == null) missing.push("饮水");
    if (input.sleepHours == null) missing.push("睡眠");
    if (input.proteinG == null) missing.push("蛋白质");
    if (input.steps == null) missing.push("步数");
    if (input.exerciseMin == null) missing.push("中高强度");
    if (input.standHours == null) missing.push("站立");
    if (input.mode !== "train" && input.mode !== "rest") missing.push("今天练了还是休息");
    if (input.mode === "train" && input.strengthMin == null) missing.push("力量训练分钟");
    if (missing.length) {
      return { ready: false, missing: missing, errors: [] };
    }

    var targets = targetsFor(input.weight);
    var water = scoreWater(input.waterMl, targets);
    var sleepHoursScore = scoreSleepHours(input.sleepHours);
    var sleepParts = [{ score: sleepHoursScore, weight: 62 }];
    var deepScore = null;
    var awakeScore = null;
    if (input.deepMin != null) {
      deepScore = scoreDeep(input.deepMin, input.sleepHours);
      sleepParts.push({ score: deepScore, weight: 24 });
    }
    if (input.awakenings != null) {
      awakeScore = scoreAwake(input.awakenings);
      sleepParts.push({ score: awakeScore, weight: 14 });
    }
    var sleepOur = weighted(sleepParts);
    var sleepFinal = input.sleepScore == null
      ? sleepOur
      : sleepOur * 0.62 + clamp(input.sleepScore, 0, 100) * 0.38;

    var strength = scoreStrength(input.strengthMin, input.mode === "rest");
    var protein = scoreProtein(input.proteinG, targets);
    var muscle = weighted([
      { score: strength.score, weight: 58 },
      { score: protein.score, weight: 42 }
    ]);

    var stepScore = scoreSteps(input.steps);
    var exerciseScore = scoreExercise(input.exerciseMin);
    var standScore = scoreStand(input.standHours);
    var activityParts = [
      { score: stepScore, weight: 36 },
      { score: exerciseScore, weight: 36 },
      { score: standScore, weight: 18 }
    ];
    var kcalScore = null;
    if (input.kcal != null) {
      kcalScore = scoreKcal(input.kcal);
      activityParts.push({ score: kcalScore, weight: 10 });
    }
    var activity = weighted(activityParts);

    var vitalParts = [];
    var rhrScore = null;
    var avgScore = null;
    var spo2Score = null;
    var stressScore = null;
    if (input.restingHr != null) {
      rhrScore = scoreRhr(input.restingHr);
      vitalParts.push({ score: rhrScore, weight: 34 });
    }
    if (input.avgHr != null) {
      avgScore = scoreAvgHr(input.avgHr);
      vitalParts.push({ score: avgScore, weight: 12 });
    }
    if (input.spo2 != null) {
      spo2Score = scoreSpo2(input.spo2);
      vitalParts.push({ score: spo2Score, weight: 30 });
    }
    if (input.stress != null) {
      stressScore = scoreStress(input.stress);
      vitalParts.push({ score: stressScore, weight: 24 });
    }
    var vitals = weighted(vitalParts);

    var rhythmParts = [];
    var vegScore = null;
    var sugarScore = null;
    var sunScore = null;
    var phoneScore = null;
    if (input.veggies != null) {
      vegScore = scoreVeg(input.veggies);
      rhythmParts.push({ score: vegScore, weight: 30 });
    }
    if (input.sugarG != null) {
      sugarScore = scoreSugar(input.sugarG);
      rhythmParts.push({ score: sugarScore, weight: 25 });
    }
    if (input.sunMin != null) {
      sunScore = scoreSun(input.sunMin);
      rhythmParts.push({ score: sunScore, weight: 25 });
    }
    if (input.phoneMin != null) {
      phoneScore = scorePhone(input.phoneMin);
      rhythmParts.push({ score: phoneScore, weight: 20 });
    }
    var rhythm = weighted(rhythmParts);

    var pillarInputs = [
      { id: "water", name: "大水", weight: 16, score: water.score, color: "#2a78b8" },
      { id: "sleep", name: "大睡", weight: 20, score: sleepFinal, color: "#3c4f8a" },
      { id: "muscle", name: "薄肌", weight: 18, score: muscle, color: "#2d6a45" },
      { id: "activity", name: "活力", weight: 18, score: activity, color: "#e23b32" }
    ];
    if (vitals != null) {
      pillarInputs.push({ id: "vitals", name: "体征", weight: 14, score: vitals, color: "#a33b55" });
    }
    if (rhythm != null) {
      pillarInputs.push({ id: "rhythm", name: "节律", weight: 14, score: rhythm, color: "#c47b2b" });
    }
    var total = weighted(pillarInputs.map(function (p) {
      return { score: p.score, weight: p.weight };
    }));
    var index = toIndex(total);
    var capped = false;
    var danger = (input.spo2 != null && input.spo2 < 95) ||
      (input.restingHr != null && (input.restingHr >= 100 || input.restingHr < 45));
    if (danger && index > 6) {
      index = 6;
      capped = true;
    }
    var level = LEVELS[index];

    var sleepDetail = input.sleepHours + " 小时";
    if (input.deepMin != null) sleepDetail += " · 深睡 " + input.deepMin + " 分钟";
    if (input.awakenings != null) sleepDetail += " · 清醒 " + input.awakenings + " 次";
    if (input.sleepScore != null) sleepDetail += " · 手环 " + input.sleepScore + " 分";

    var muscleDetail = input.mode === "rest"
      ? "休息日 · 蛋白质 " + protein.value + " g"
      : "力量 " + strength.value + " 分钟 · 蛋白质 " + protein.value + " g";

    var activityDetail = input.steps + " 步 · 锻炼 " + input.exerciseMin + " 分钟 · 站立 " + input.standHours + " 小时";
    if (input.kcal != null) activityDetail += " · " + input.kcal + " 千卡";

    var vitalBits = [];
    if (input.restingHr != null) vitalBits.push("静息 " + input.restingHr);
    if (input.avgHr != null) vitalBits.push("平均 " + input.avgHr);
    if (input.spo2 != null) vitalBits.push("血氧 " + input.spo2 + "%");
    if (input.stress != null) vitalBits.push("压力 " + input.stress);
    var rhythmBits = [];
    if (input.veggies != null) rhythmBits.push("蔬菜 " + input.veggies + " 份");
    if (input.sugarG != null) rhythmBits.push("糖 " + input.sugarG + " g");
    if (input.sunMin != null) rhythmBits.push("日照 " + input.sunMin + " 分钟");
    if (input.phoneMin != null) rhythmBits.push("睡前屏幕 " + input.phoneMin + " 分钟");

    var moveRing = input.kcal == null ? stepScore : (stepScore + kcalScore) / 2;
    var tips = buildTips({
      water: water,
      sleep: { score: sleepFinal },
      sleepHours: input.sleepHours,
      strength: strength,
      protein: protein,
      steps: input.steps,
      stepScore: stepScore,
      exercise: input.exerciseMin,
      exerciseScore: exerciseScore,
      stand: input.standHours,
      standScore: standScore,
      restingHr: input.restingHr,
      rhrScore: rhrScore == null ? 100 : rhrScore,
      stress: input.stress,
      stressScore: stressScore == null ? 100 : stressScore,
      veggies: input.veggies,
      vegScore: vegScore == null ? 100 : vegScore,
      sugar: input.sugarG,
      sugarScore: sugarScore == null ? 100 : sugarScore,
      sun: input.sunMin,
      sunScore: sunScore == null ? 100 : sunScore,
      phone: input.phoneMin,
      phoneScore: phoneScore == null ? 100 : phoneScore,
      spo2: input.spo2,
      spo2Score: spo2Score == null ? 100 : spo2Score
    });

    var cautions = [];
    if (input.spo2 != null && input.spo2 < 95) {
      cautions.push("血氧低于 95% 时，指数只作参考。先静坐复测，反复偏低请看医生。");
    }
    if (input.restingHr != null && (input.restingHr >= 100 || input.restingHr < 45)) {
      cautions.push("静息心率读数不寻常。身体不舒服时，不要用这个指数做判断，去看医生。");
    }

    return {
      ready: true,
      missing: [],
      errors: [],
      score: round1(total),
      index: index,
      capped: capped,
      level: level,
      targets: targets,
      pillars: pillarInputs.map(function (p) {
        var detail = "";
        if (p.id === "water") detail = water.value + " ml · 目标 " + fmtRange(water.low, water.high, " ml");
        if (p.id === "sleep") detail = sleepDetail;
        if (p.id === "muscle") detail = muscleDetail + " · 目标 " + fmtRange(protein.low, protein.high, " g");
        if (p.id === "activity") detail = activityDetail;
        if (p.id === "vitals") detail = vitalBits.join(" · ");
        if (p.id === "rhythm") detail = rhythmBits.join(" · ");
        return {
          id: p.id,
          name: p.name,
          weight: p.weight,
          score: Math.round(p.score),
          color: p.color,
          detail: detail
        };
      }),
      rings: {
        move: Math.round(moveRing),
        exercise: Math.round(exerciseScore),
        stand: Math.round(standScore)
      },
      tips: tips,
      cautions: cautions,
      usedOptional: vitals != null || rhythm != null || input.deepMin != null || input.sleepScore != null
    };
  }

  root.AppleIndex = {
    calculate: calculate,
    toIndex: toIndex,
    targetsFor: targetsFor,
    LEVELS: LEVELS,
    INDEX_EDGES: INDEX_EDGES
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
