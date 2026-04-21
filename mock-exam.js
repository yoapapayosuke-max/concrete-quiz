(function () {
  'use strict';

  function getAllQuestions() {
    try {
      if (typeof window !== 'undefined' && Array.isArray(window.QUESTIONS)) {
        return window.QUESTIONS.slice();
      }
    } catch (e) {}
    return [];
  }

  function uniqueArray(arr) {
    return Array.from(new Set(arr));
  }

  function sortByConfiguredYearsAndId(list, orderedYears) {
    var yearRank = {};
    orderedYears.forEach(function (year, index) {
      yearRank[String(year)] = index;
    });

    return list.slice().sort(function (a, b) {
      var ay = String(a.year || '');
      var by = String(b.year || '');

      var ar = Object.prototype.hasOwnProperty.call(yearRank, ay) ? yearRank[ay] : 999;
      var br = Object.prototype.hasOwnProperty.call(yearRank, by) ? yearRank[by] : 999;

      if (ar !== br) return ar - br;

      var aid = String(a.id || '');
      var bid = String(b.id || '');
      if (aid < bid) return -1;
      if (aid > bid) return 1;
      return 0;
    });
  }

  function rotateArray(arr, offset) {
    if (!arr.length) return arr.slice();
    var safeOffset = ((offset % arr.length) + arr.length) % arr.length;
    return arr.slice(safeOffset).concat(arr.slice(0, safeOffset));
  }

  function buildPatternIds(config, patternName) {
    var all = getAllQuestions();
    if (!all.length) return [];

    var pattern = config.patterns[patternName];
    if (!pattern) return [];

    if (Array.isArray(pattern.questionIds) && pattern.questionIds.length) {
      return pattern.questionIds.slice();
    }

    var orderedYears = uniqueArray([config.selectedYear].concat(config.fallbackYears || []));
    var selectedIds = [];
    var usedIds = new Set();

    Object.keys(config.distribution).forEach(function (categoryKey) {
      var needCount = Number(config.distribution[categoryKey]) || 0;
      if (needCount <= 0) return;

      var pool = all.filter(function (q) {
        return !q.excluded && q.category === categoryKey;
      });

      pool = sortByConfiguredYearsAndId(pool, orderedYears);

      var offset = Number(pattern.categoryOffsets && pattern.categoryOffsets[categoryKey]) || 0;
      pool = rotateArray(pool, offset);

      var count = 0;
      for (var i = 0; i < pool.length && count < needCount; i++) {
        var q = pool[i];
        if (!q || !q.id) continue;
        if (usedIds.has(q.id)) continue;

        usedIds.add(q.id);
        selectedIds.push(q.id);
        count += 1;
      }
    });

    return selectedIds.slice(0, config.totalQuestions);
  }

  function getQuestionsByIds(ids) {
    var all = getAllQuestions();
    var map = {};
    all.forEach(function (q) {
      if (q && q.id) map[q.id] = q;
    });

    return ids.map(function (id) {
      return map[id];
    }).filter(Boolean);
  }

  window.MOCK_EXAM_CONFIG = {
    version: 'beta-1',
    selectedYear: 2025,
    totalQuestions: 40,
    fallbackYears: [2024, 2023, 2022, 2021, 2016],

    distribution: {
      a: 6,
      b: 8,
      c: 8,
      d: 2,
      e: 8,
      f: 3,
      g: 1,
      h: 4
    },

    patterns: {
      pattern1: {
        name: 'パターン1',
        categoryOffsets: {
          a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, g: 0, h: 0
        }
      },
      pattern2: {
        name: 'パターン2',
        categoryOffsets: {
          a: 2, b: 2, c: 2, d: 1, e: 2, f: 1, g: 0, h: 1
        }
      }
    }
  };

  window.MOCK_EXAM = {
    getPatternIds: function (patternName) {
      return buildPatternIds(window.MOCK_EXAM_CONFIG, patternName);
    },

    getPatternQuestions: function (patternName) {
      var ids = buildPatternIds(window.MOCK_EXAM_CONFIG, patternName);
      return getQuestionsByIds(ids);
    },

    getPatternMeta: function (patternName) {
      var config = window.MOCK_EXAM_CONFIG;
      var ids = buildPatternIds(config, patternName);
      return {
        patternName: patternName,
        displayName: (config.patterns[patternName] && config.patterns[patternName].name) || patternName,
        selectedYear: config.selectedYear,
        totalQuestions: config.totalQuestions,
        distribution: config.distribution,
        ids: ids
      };
    },

    getStartConfirmMessage: function (patternName) {
      var meta = this.getPatternMeta(patternName);
      return [
        '模擬試験を開始します。',
        '',
        '出題パターン: ' + meta.displayName,
        '問題数: ' + meta.totalQuestions + '問',
        '年度設定: ' + meta.selectedYear,
        '',
        '開始後はタイトルに戻れません。',
        '結果画面では解説を表示しません。',
        '',
        '開始してよろしいですか？'
      ].join('\n');
    }
  };
})();