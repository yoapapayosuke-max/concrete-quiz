(function () {
  'use strict';

  var CATEGORY_ORDER = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  var deferredInstallPrompt = null;

  function applyTheme(theme) {
    var safeTheme = theme === 'dark' ? 'dark' : 'light';
    document.body.classList.toggle('theme-dark', safeTheme === 'dark');
    try {
      localStorage.setItem('theme', safeTheme);
    } catch (e) {}
  }

  function getSavedTheme() {
    try {
      return localStorage.getItem('theme') || 'light';
    } catch (e) {
      return 'light';
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }


  function containsHtml(value) {
    return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
  }

  function sanitizeTrustedHtml(value) {
    return String(value || '')
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
      .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
      .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, '')
      .replace(/<link[\s\S]*?>/gi, '')
      .replace(/<meta[\s\S]*?>/gi, '')
      .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\s+on\w+\s*=\s*'[^']*'/gi, '')
      .replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '')
      .replace(/javascript\s*:/gi, '');
  }

  function renderTextOrHtml(value, className) {
    var raw = String(value || '');
    if (containsHtml(raw)) {
      return '<div class="' + className + ' ' + className + '-html">' + sanitizeTrustedHtml(raw) + '</div>';
    }
    return '<div class="' + className + '">' + escapeHtml(raw) + '</div>';
  }

  function renderMediaList(mediaList, className) {
    if (!Array.isArray(mediaList) || !mediaList.length) return '';

    return '<div class="' + className + '-media-list">' +
      mediaList.map(function (item) {
        if (!item || !item.src) return '';

        var caption = item.caption
          ? '<figcaption>' + escapeHtml(item.caption) + '</figcaption>'
          : '';

        return '' +
          '<figure class="' + className + '-figure">' +
            '<img src="' + escapeHtml(item.src) + '" alt="' + escapeHtml(item.alt || '問題画像') + '" loading="lazy">' +
            caption +
          '</figure>';
      }).join('') +
    '</div>';
  }

  function renderDataTable(tableData, className) {
    if (!tableData || !Array.isArray(tableData.rows)) return '';

    var headers = Array.isArray(tableData.headers) ? tableData.headers : [];

    var thead = headers.length
      ? '<thead><tr>' +
          headers.map(function (header) {
            return '<th>' + escapeHtml(header) + '</th>';
          }).join('') +
        '</tr></thead>'
      : '';

    var tbody = '<tbody>' +
      tableData.rows.map(function (row) {
        if (!Array.isArray(row)) return '';
        return '<tr>' +
          row.map(function (cell) {
            return '<td>' + escapeHtml(cell) + '</td>';
          }).join('') +
        '</tr>';
      }).join('') +
    '</tbody>';

    return '' +
      '<div class="' + className + '-wrap">' +
        '<table class="' + className + '">' +
          thead +
          tbody +
        '</table>' +
      '</div>';
  }

  function renderImage(imagePath, altText, className) {
    if (!imagePath) return '';

    return '' +
      '<div class="' + className + '-wrap">' +
        '<img src="' + escapeHtml(imagePath) + '" alt="' + escapeHtml(altText) + '" class="' + className + '">' +
      '</div>';
  }
function renderQuestionMeta(question) {
  var id = question.id || question.questionId || '--';
  var year = question.year || '--';
  var category = question.category || '--';
  var categoryName = question.categoryName || categoryLabel(category);
  var originalQuestionNo = question.originalQuestionNo ?? '--';
  var sourceKind = question.sourceKind || '--';

  return '' +
    '<div class="question-meta">' +
      '<span class="question-meta-item">ID: ' + escapeHtml(id) + '</span>' +
      '<span class="question-meta-item">年度: ' + escapeHtml(year) + '</span>' +
      '<span class="question-meta-item">分野: ' + escapeHtml(category + ' ' + categoryName) + '</span>' +
      '<span class="question-meta-item">元問題: ' + escapeHtml(originalQuestionNo) + '</span>' +
      '<span class="question-meta-item">出典: ' + escapeHtml(sourceKind) + '</span>' +
    '</div>';
}
 function renderQuestionBody(question) {
  var html = '';

  html += renderQuestionMeta(question);
  html += renderTextOrHtml(question.stem || question.question || '', 'question-stem');

  if (question.stemTable) {
    html += renderDataTable(question.stemTable, 'question-table');
  }

  if (question.stemImage) {
    html += renderImage(question.stemImage, '問題画像', 'question-image');
  }

  html += renderMediaList(question.media || question.stemImages || [], 'question');

  return html;
}

  function renderExplanationBody(question) {
    var html = '';
    var correctText = question.options && question.options[question.answer]
      ? question.options[question.answer]
      : '';

    html += '<div class="explanation-title">解説</div>';
    html += '<div class="explanation-answer">正解: ' +
      escapeHtml(String.fromCharCode(65 + question.answer) + '. ' + correctText) +
    '</div>';

    html += renderTextOrHtml(question.explanation || '解説は未設定です。', 'explanation-body');

    if (question.explanationTable) {
      html += renderDataTable(question.explanationTable, 'explanation-table');
    }

    if (question.explanationImage) {
      html += renderImage(question.explanationImage, '解説画像', 'explanation-image');
    }

    return html;
  }

  function renderReviewQuestionBody(item) {
  var html = '';

  html += renderQuestionMeta({
    id: item.questionId,
    year: item.year,
    category: item.category,
    categoryName: item.categoryName,
    originalQuestionNo: item.originalQuestionNo,
    sourceKind: item.sourceKind
  });

  html += renderTextOrHtml(item.stem || item.question || '', 'review-question');

  if (item.stemTable) {
    html += renderDataTable(item.stemTable, 'question-table');
  }

  if (item.stemImage) {
    html += renderImage(item.stemImage, '問題画像', 'question-image');
  }

  html += renderMediaList(item.media || item.stemImages || [], 'question');

  return html;
}

  function renderReviewExplanationBody(item) {
    var html = '';

    html += '<div class="explanation-title">解説</div>';
    html += renderTextOrHtml(item.explanation || '解説は未設定です。', 'explanation-body');

    if (item.explanationTable) {
      html += renderDataTable(item.explanationTable, 'explanation-table');
    }

    if (item.explanationImage) {
      html += renderImage(item.explanationImage, '解説画像', 'explanation-image');
    }

    return html;
  }

  function shuffleArray(array) {
    var copy = array.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function getQuestionSource() {
    try {
      if (typeof window !== 'undefined' && Array.isArray(window.QUESTIONS)) {
        return window.QUESTIONS;
      }
    } catch (e) {}

    try {
      if (typeof QUESTIONS !== 'undefined' && Array.isArray(QUESTIONS)) {
        return QUESTIONS;
      }
    } catch (e) {}

    try {
      if (typeof window !== 'undefined' && Array.isArray(window.questions)) {
        return window.questions;
      }
    } catch (e) {}

    try {
      if (typeof questions !== 'undefined' && Array.isArray(questions)) {
        return questions;
      }
    } catch (e) {}

    return [];
  }

  function normalizeQuestion(q, index) {
    if (!q || typeof q !== 'object') return null;

    var options = Array.isArray(q.options) ? q.options.slice() : [];
    var answerIndex = Number(q.answer);

    if (!Number.isInteger(answerIndex) && typeof q.answerIndex === 'number') {
      answerIndex = Number(q.answerIndex);
    }

    if (!Number.isInteger(answerIndex) && typeof q.correct === 'number') {
      answerIndex = Number(q.correct);
    }

    if (!Number.isInteger(answerIndex)) {
      answerIndex = 0;
    }

    return {
      id: q.id || ('q' + (index + 1)),
      category: q.category || 'all',
      categoryName: q.categoryName || '',
      year: q.year || null,
      originalYear: q.originalYear || q.year || null,
      originalQuestionNo: q.originalQuestionNo ?? null,
      sourceKind: q.sourceKind || '',

      question: q.question || q.stem || '問題文が設定されていません。',
      stem: q.stem || q.question || '問題文が設定されていません。',

      stemTable: q.stemTable || q.questionTable || null,
      stemImage: q.stemImage || q.questionImage || '',
      stemImages: q.stemImages || q.questionImages || null,
      media: q.media || q.stemImages || q.questionImages || null,

      options: options,
      answer: answerIndex,
      explanation: q.explanation || '',

      explanationTable: q.explanationTable || null,
      explanationImage: q.explanationImage || ''
    };
  }

  function normalizeQuestions() {
    var source = getQuestionSource();

    return source
      .map(function (q, index) {
        return normalizeQuestion(q, index);
      })
      .filter(function (q) {
        return q && q.options.length >= 2;
      });
  }

  function categoryLabel(value) {
    var map = {
      all: 'すべて',
      a: 'a 材料',
      b: 'b 配合',
      c: 'c フレッシュコンクリートの性質',
      d: 'd 硬化コンクリート',
      e: 'e 製造・品質管理',
      f: 'f 施工',
      g: 'g 特殊コンクリート',
      h: 'h 構造・力学・法令・その他'
    };
    return map[value] || value || 'すべて';
  }

  function setupYearSelect() {
    var yearSelect = document.getElementById('yearSelect');
    if (!yearSelect) return;

    var years = normalizeQuestions()
      .map(function (q) { return q.year; })
      .filter(function (year) { return year !== undefined && year !== null && year !== ''; });

    years = Array.from(new Set(years.map(function (year) { return String(year); })))
      .sort(function (a, b) { return Number(b) - Number(a); });

    var currentValue = yearSelect.value || 'all';
    try {
      var saved = JSON.parse(localStorage.getItem('concreteQuizSettings') || '{}');
      if (saved.year) currentValue = saved.year;
    } catch (e) {}

    yearSelect.innerHTML = '<option value="all">すべて</option>';

    years.forEach(function (year) {
      var option = document.createElement('option');
      option.value = String(year);
      option.textContent = String(year) + '年度';
      yearSelect.appendChild(option);
    });

    yearSelect.value = years.indexOf(String(currentValue)) >= 0 ? String(currentValue) : 'all';
  }

  function modeLabel(value) {
    var map = {
      normal: '通常',
      random: 'ランダム',
      wrongOnly: '間違えた問題の復習',
      weakCategory: '正答率の低い分野の復習',
      mock: '模擬試験'
    };
    return map[value] || value || '通常';
  }

  function getWrongQuestionIds() {
    try {
      var raw = localStorage.getItem('wrongQuestionIds');
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveWrongQuestionIds(ids) {
    try {
      var uniq = Array.from(new Set(ids));
      localStorage.setItem('wrongQuestionIds', JSON.stringify(uniq));
    } catch (e) {}
  }

  function getPerformanceStats() {
    try {
      var raw = localStorage.getItem('performanceStats');
      if (!raw) {
        return {
          totalAnswered: 0,
          totalCorrect: 0,
          categories: {}
        };
      }

      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') throw new Error('invalid');
      if (!parsed.categories || typeof parsed.categories !== 'object') parsed.categories = {};
      if (typeof parsed.totalAnswered !== 'number') parsed.totalAnswered = 0;
      if (typeof parsed.totalCorrect !== 'number') parsed.totalCorrect = 0;

      return parsed;
    } catch (e) {
      return {
        totalAnswered: 0,
        totalCorrect: 0,
        categories: {}
      };
    }
  }

  function savePerformanceStats(stats) {
    try {
      localStorage.setItem('performanceStats', JSON.stringify(stats));
    } catch (e) {}
  }

  function resetPerformanceStats() {
    try {
      localStorage.removeItem('performanceStats');
      localStorage.removeItem('wrongQuestionIds');
    } catch (e) {}
  }

  function updateWrongQuestionHistory(resultAnswers) {
    var currentWrongIds = getWrongQuestionIds();
    var wrongSet = new Set(currentWrongIds);

    resultAnswers.forEach(function (item) {
      if (!item || !item.questionId) return;
      if (item.isCorrect) wrongSet.delete(item.questionId);
      else wrongSet.add(item.questionId);
    });

    saveWrongQuestionIds(Array.from(wrongSet));
  }

  function updatePerformanceStats(resultAnswers) {
    var stats = getPerformanceStats();

    resultAnswers.forEach(function (item) {
      if (!item) return;

      stats.totalAnswered += 1;
      if (item.isCorrect) stats.totalCorrect += 1;

      var category = item.category || 'all';
      if (!stats.categories[category]) {
        stats.categories[category] = { answered: 0, correct: 0 };
      }

      stats.categories[category].answered += 1;
      if (item.isCorrect) stats.categories[category].correct += 1;
    });

    savePerformanceStats(stats);
  }

  function getWeakestCategory(stats) {
    var categories = (stats && stats.categories) || {};
    var weakest = null;

    CATEGORY_ORDER.forEach(function (categoryKey) {
      var item = categories[categoryKey];
      if (!item || !item.answered) return;

      var accuracy = item.correct / item.answered;

      if (!weakest) {
        weakest = { category: categoryKey, accuracy: accuracy, answered: item.answered };
        return;
      }

      if (accuracy < weakest.accuracy) {
        weakest = { category: categoryKey, accuracy: accuracy, answered: item.answered };
        return;
      }

      if (accuracy === weakest.accuracy && item.answered > weakest.answered) {
        weakest = { category: categoryKey, accuracy: accuracy, answered: item.answered };
      }
    });

    return weakest;
  }

  function buildStudySession(settings) {
    var all = normalizeQuestions();
    var filtered = all;

    if (settings.year && settings.year !== 'all') {
      filtered = filtered.filter(function (q) {
        return String(q.year) === String(settings.year);
      });
    }

    if (settings.mode === 'weakCategory') {
      var stats = getPerformanceStats();
      var weakest = getWeakestCategory(stats);

      if (!weakest) {
        filtered = [];
      } else {
        settings.weakCategory = weakest.category;
        filtered = filtered.filter(function (q) {
          return q.category === weakest.category;
        });
      }
    } else if (settings.category && settings.category !== 'all') {
      filtered = filtered.filter(function (q) {
        return q.category === settings.category;
      });
    }

    if (settings.mode === 'wrongOnly') {
      var wrongIds = getWrongQuestionIds();
      var wrongSet = new Set(wrongIds);
      filtered = filtered.filter(function (q) {
        return wrongSet.has(q.id);
      });
    }

    if (settings.mode === 'random') {
      filtered = shuffleArray(filtered);
    }

    var count = Math.max(1, Number(settings.count) || 10);
    var selected = filtered.slice(0, count);

    return {
      mode: 'study',
      settings: settings,
      questions: selected,
      currentIndex: 0,
      score: 0,
      answers: [],
      startedAt: Date.now()
    };
  }

  function buildMockSession(patternName, theme) {
    if (!window.MOCK_EXAM || !window.MOCK_EXAM.getPatternQuestions) return null;

    var rawQuestions = window.MOCK_EXAM.getPatternQuestions(patternName);
    var meta = window.MOCK_EXAM.getPatternMeta(patternName);

    var questions = rawQuestions
      .map(function (q, index) {
        return normalizeQuestion(q, index);
      })
      .filter(function (q) {
        return q && q.options.length >= 2;
      });

    return {
      mode: 'mock',
      settings: {
        mode: 'mock',
        mockPattern: patternName,
        mockDisplayName: meta.displayName,
        mockYear: meta.selectedYear,
        theme: theme || getSavedTheme()
      },
      questions: questions,
      currentIndex: 0,
      score: 0,
      answers: [],
      startedAt: Date.now()
    };
  }

  function saveQuizSession(session) {
    try {
      sessionStorage.setItem('quizSession', JSON.stringify(session));
    } catch (e) {
      alert('セッション保存に失敗しました。ブラウザのストレージ設定を確認してください。');
    }
  }

  function loadQuizSession() {
    var raw = sessionStorage.getItem('quizSession');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveQuizResult(result) {
    try {
      sessionStorage.setItem('quizResult', JSON.stringify(result));
    } catch (e) {
      alert('結果保存に失敗しました。ブラウザのストレージ設定を確認してください。');
    }
  }

  function loadQuizResult() {
    var raw = sessionStorage.getItem('quizResult');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function renderCumulativeStats() {
    var stats = getPerformanceStats();
    var wrongIds = getWrongQuestionIds();
    var weakest = getWeakestCategory(stats);
    var overallAccuracy = stats.totalAnswered > 0
      ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
      : 0;

    var totalAnsweredValue = document.getElementById('totalAnsweredValue');
    var overallAccuracyValue = document.getElementById('overallAccuracyValue');
    var wrongCountValue = document.getElementById('wrongCountValue');
    var weakCategoryValue = document.getElementById('weakCategoryValue');

    var cumulativeAnsweredValue = document.getElementById('cumulativeAnsweredValue');
    var cumulativeAccuracyValue = document.getElementById('cumulativeAccuracyValue');
    var cumulativeWrongValue = document.getElementById('cumulativeWrongValue');
    var cumulativeWeakCategoryValue = document.getElementById('cumulativeWeakCategoryValue');

    if (totalAnsweredValue) totalAnsweredValue.textContent = String(stats.totalAnswered);
    if (overallAccuracyValue) overallAccuracyValue.textContent = overallAccuracy + '%';
    if (wrongCountValue) wrongCountValue.textContent = String(wrongIds.length);
    if (weakCategoryValue) weakCategoryValue.textContent = weakest ? categoryLabel(weakest.category) : '--';

    if (cumulativeAnsweredValue) cumulativeAnsweredValue.textContent = String(stats.totalAnswered);
    if (cumulativeAccuracyValue) cumulativeAccuracyValue.textContent = overallAccuracy + '%';
    if (cumulativeWrongValue) cumulativeWrongValue.textContent = String(wrongIds.length);
    if (cumulativeWeakCategoryValue) cumulativeWeakCategoryValue.textContent = weakest ? categoryLabel(weakest.category) : '--';
  }

  function startStudyQuiz() {
    var themeSelect = document.getElementById('themeSelect');
    var modeSelect = document.getElementById('modeSelect');
    var questionCount = document.getElementById('questionCount');
    var categorySelect = document.getElementById('categorySelect');
    var yearSelect = document.getElementById('yearSelect');

    var savedTheme = getSavedTheme();

    var settings = {
      mode: modeSelect ? modeSelect.value : 'normal',
      count: questionCount ? Number(questionCount.value) : 10,
      year: yearSelect ? yearSelect.value : 'all',
      category: categorySelect ? categorySelect.value : 'all',
      theme: themeSelect ? themeSelect.value : savedTheme
    };

    try {
      localStorage.setItem('concreteQuizSettings', JSON.stringify(settings));
    } catch (e) {}

    applyTheme(settings.theme);

    var session = buildStudySession(settings);

    if (settings.mode === 'wrongOnly' && !session.questions.length) {
      alert('まだ復習用の問題がありません。通常モードで間違えた問題を作ってから使ってください。');
      return;
    }

    if (settings.mode === 'weakCategory' && !session.questions.length) {
      alert('まだ分野別の成績データがありません。通常モードで問題を解いてから使ってください。');
      return;
    }

    if (!session.questions.length) {
      alert('問題データを読み込めませんでした。questions.js を確認してください。');
      return;
    }

    saveQuizSession(session);
    location.href = 'quiz.html';
  }

  function startMockExam() {
    var themeSelect = document.getElementById('themeSelect');
    var mockPatternSelect = document.getElementById('mockPatternSelect');
    var patternName = mockPatternSelect ? mockPatternSelect.value : 'pattern1';
    var theme = themeSelect ? themeSelect.value : getSavedTheme();

    applyTheme(theme);

    if (!window.MOCK_EXAM) {
      alert('模擬試験データを読み込めませんでした。');
      return;
    }

    var ok = window.confirm(window.MOCK_EXAM.getStartConfirmMessage(patternName));
    if (!ok) return;

    var session = buildMockSession(patternName, theme);
    if (!session || !session.questions || !session.questions.length) {
      alert('模擬試験の問題を読み込めませんでした。');
      return;
    }

    saveQuizSession(session);
    location.href = 'quiz.html';
  }

  function handleInstallApp() {
    var ua = navigator.userAgent || '';
    var isIOS = /iPhone|iPad|iPod/i.test(ua);
    var isAndroid = /Android/i.test(ua);
    var isWindows = /Windows/i.test(ua);

    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then(function () {
        deferredInstallPrompt = null;
      });
      return;
    }

    if (isIOS) {
      alert('iPhone / iPad では、Safari の共有ボタンから「ホーム画面に追加」を選んでください。');
      return;
    }

    if (isAndroid) {
      alert('Android では、ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」を選んでください。');
      return;
    }

    if (isWindows) {
      alert('Windows では、Chrome または Edge のメニューから「アプリをインストール」または「このサイトをアプリとしてインストール」を選んでください。');
      return;
    }

    alert('この端末では、ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」を選んでください。');
  }

  function initTopPage() {
    var startForm = document.getElementById('startForm');
    if (!startForm) return;

    var themeSelect = document.getElementById('themeSelect');
    var startButton = startForm.querySelector('button[type="submit"]');
    var resetStatsButton = document.getElementById('resetStatsButton');
    var mockStartButton = document.getElementById('mockStartButton');
    var installAppButton = document.getElementById('installAppButton');
    var mockYearDisplay = document.getElementById('mockYearDisplay');

    var savedTheme = getSavedTheme();
    applyTheme(savedTheme);
    setupYearSelect();

    if (themeSelect) {
      themeSelect.value = savedTheme;
      themeSelect.addEventListener('change', function () {
        applyTheme(themeSelect.value);
      });
    }

    if (mockYearDisplay && window.MOCK_EXAM_CONFIG) {
      mockYearDisplay.value = String(window.MOCK_EXAM_CONFIG.selectedYear);
    }

    renderCumulativeStats();

    startForm.addEventListener('submit', function (e) {
      e.preventDefault();
      startStudyQuiz();
    });

    if (startButton) {
      startButton.addEventListener('click', function (e) {
        e.preventDefault();
        startStudyQuiz();
      });
    }

    if (mockStartButton) {
      mockStartButton.addEventListener('click', function () {
        startMockExam();
      });
    }

    if (installAppButton) {
      installAppButton.addEventListener('click', function () {
        handleInstallApp();
      });
    }

    if (resetStatsButton) {
      resetStatsButton.addEventListener('click', function () {
        var ok = window.confirm('これまでの成績と復習データをリセットします。よろしいですか？');
        if (!ok) return;
        resetPerformanceStats();
        renderCumulativeStats();
      });
    }
  }

  function initQuizPage() {
    var quizArea = document.getElementById('quizArea');
    if (!quizArea) return;

    var session = loadQuizSession();
    if (!session || !Array.isArray(session.questions) || !session.questions.length) {
      location.href = 'index.html';
      return;
    }

    var theme = session && session.settings && session.settings.theme
      ? session.settings.theme
      : getSavedTheme();

    applyTheme(theme);

    var modeBadge = document.getElementById('modeBadge');
    var accuracyBadge = document.getElementById('accuracyBadge');
    var categoryBadge = document.getElementById('categoryBadge');
    var progressText = document.getElementById('progressText');
    var progressFill = document.getElementById('progressFill');
    var questionNumber = document.getElementById('questionNumber');
    var questionText = document.getElementById('questionText');
    var optionsArea = document.getElementById('optionsArea');
    var feedbackArea = document.getElementById('feedbackArea');
    var answerStatus = document.getElementById('answerStatus');
    var explanationBox = document.getElementById('explanationBox');
    var nextButton = document.getElementById('nextButton');
    var backToTitleLink = document.getElementById('backToTitleLink');

    if (!optionsArea || !questionText || !nextButton) return;

    var isMock = session.mode === 'mock' || (session.settings && session.settings.mode === 'mock');
    var answered = false;

    if (isMock && backToTitleLink) {
      backToTitleLink.style.display = 'none';
    }

    function renderQuestion() {
      var current = session.questions[session.currentIndex];
      var total = session.questions.length;
      var number = session.currentIndex + 1;
      var accuracy = session.answers.length
        ? Math.round((session.score / session.answers.length) * 100)
        : 0;

      answered = false;

      if (modeBadge) modeBadge.textContent = modeLabel(session.settings.mode);

      if (isMock) {
        if (categoryBadge) {
          categoryBadge.textContent = '模擬試験: ' + (session.settings.mockDisplayName || 'パターン');
        }
      } else if (session.settings.mode === 'weakCategory' && session.settings.weakCategory) {
        if (categoryBadge) categoryBadge.textContent = '分野: ' + categoryLabel(session.settings.weakCategory);
      } else {
        if (categoryBadge) categoryBadge.textContent = '分野: ' + categoryLabel(session.settings.category);
      }

      if (accuracyBadge) accuracyBadge.textContent = '正答率 ' + accuracy + '%';
      if (progressText) progressText.textContent = number + ' / ' + total;
      if (progressFill) progressFill.style.width = ((number / total) * 100) + '%';
      if (questionNumber) questionNumber.textContent = '第' + number + '問';
      if (questionText) questionText.innerHTML = renderQuestionBody(current);

      if (feedbackArea) feedbackArea.classList.add('hidden');

      if (answerStatus) {
        answerStatus.className = 'answer-status';
        answerStatus.textContent = '';
      }

      if (explanationBox) explanationBox.innerHTML = '';
      if (nextButton) nextButton.classList.add('hidden');

      optionsArea.innerHTML = '';

      current.options.forEach(function (option, index) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'option-button';
        button.innerHTML =
          '<span class="option-label">' + String.fromCharCode(65 + index) + '.</span>' +
          '<span class="option-text">' + escapeHtml(option) + '</span>';

        button.addEventListener('click', function () {
          if (answered) return;
          answered = true;

          var isCorrect = index === current.answer;

        session.answers.push({
  questionId: current.id,
  question: current.question,
  stem: current.stem,
  stemTable: current.stemTable,
  stemImage: current.stemImage,

  year: current.year,
  category: current.category,
  categoryName: current.categoryName,

  options: current.options.slice(),
  selectedIndex: index,
  correctIndex: current.answer,
  explanation: current.explanation,
  explanationTable: current.explanationTable,
  explanationImage: current.explanationImage,
  isCorrect: isCorrect
});

          if (isCorrect) session.score += 1;

          Array.from(optionsArea.querySelectorAll('.option-button')).forEach(function (btn, btnIndex) {
            btn.disabled = true;

            if (btnIndex === current.answer) btn.classList.add('correct');
            if (btnIndex === index && btnIndex !== current.answer) btn.classList.add('incorrect');
            if (btnIndex === index) btn.classList.add('selected');
          });

          if (feedbackArea) feedbackArea.classList.remove('hidden');

          if (answerStatus) {
            answerStatus.className = 'answer-status ' + (isCorrect ? 'status-correct' : 'status-incorrect');
            answerStatus.textContent = isCorrect ? '正解です' : '不正解です';
          }

          if (explanationBox) {
            if (isMock) {
              explanationBox.innerHTML = '';
            } else {
              explanationBox.innerHTML = renderExplanationBody(current);
            }
          }

          saveQuizSession(session);

          if (accuracyBadge) {
            var newAccuracy = Math.round((session.score / session.answers.length) * 100);
            accuracyBadge.textContent = '正答率 ' + newAccuracy + '%';
          }

          if (nextButton) {
            nextButton.textContent = session.currentIndex >= session.questions.length - 1 ? '結果を見る' : '次へ';
            nextButton.classList.remove('hidden');
          }
        });

        optionsArea.appendChild(button);
      });
    }

    nextButton.addEventListener('click', function () {
      if (session.currentIndex >= session.questions.length - 1) {
        var result = {
          score: session.score,
          total: session.questions.length,
          answers: session.answers,
          settings: session.settings,
          mode: session.mode || 'study',
          finishedAt: Date.now()
        };

        saveQuizResult(result);

        if (!isMock) {
          updateWrongQuestionHistory(session.answers);
          updatePerformanceStats(session.answers);
        }

        location.href = 'result.html';
        return;
      }

      session.currentIndex += 1;
      saveQuizSession(session);
      renderQuestion();
    });

    renderQuestion();
  }

  function buildMockReviewHtml(item, index) {
    var statusClass = item.isCorrect ? 'mock-status-ok' : 'mock-status-ng';
    var statusText = item.isCorrect ? '○' : '×';

    return '' +
      '<article class="result-question-card mock-compact-card">' +
        '<div class="mock-compact-row">' +
          '<span class="mock-qno">Q' + (index + 1) + '</span>' +
          '<span class="mock-status ' + statusClass + '">' + statusText + '</span>' +
        '</div>' +
      '</article>';
  }

  function buildStudyReviewHtml(item, index) {
    var selectedText = item.options[item.selectedIndex] || '';
    var correctText = item.options[item.correctIndex] || '';

    return '' +
      '<article class="result-question-card">' +
        '<div class="review-top">' +
          '<div class="review-number">第' + (index + 1) + '問</div>' +
          '<div class="review-badge ' + (item.isCorrect ? 'review-badge-correct' : 'review-badge-incorrect') + '">' +
            (item.isCorrect ? '正解' : '不正解') +
          '</div>' +
        '</div>' +

        renderReviewQuestionBody(item) +

        '<div class="review-answer-block">' +
          '<div class="review-line"><span class="review-label">あなたの解答</span><span class="review-user ' + (item.isCorrect ? 'text-correct' : 'text-incorrect') + '">' +
            escapeHtml(String.fromCharCode(65 + item.selectedIndex) + '. ' + selectedText) +
          '</span></div>' +
          '<div class="review-line"><span class="review-label">正解</span><span class="review-correct text-correct">' +
            escapeHtml(String.fromCharCode(65 + item.correctIndex) + '. ' + correctText) +
          '</span></div>' +
        '</div>' +

        '<div class="review-explanation">' +
          renderReviewExplanationBody(item) +
        '</div>' +
      '</article>';
  }

  function initResultPage() {
    var resultArea = document.getElementById('resultArea');
    if (!resultArea) return;

    var result = loadQuizResult();
    if (!result || !Array.isArray(result.answers)) {
      location.href = 'index.html';
      return;
    }

    var theme = result && result.settings && result.settings.theme
      ? result.settings.theme
      : getSavedTheme();

    applyTheme(theme);

    var scoreValue = document.getElementById('scoreValue');
    var accuracyValue = document.getElementById('accuracyValue');
    var modeValue = document.getElementById('modeValue');
    var categoryValue = document.getElementById('categoryValue');
    var reviewList = document.getElementById('reviewList');
    var resultLead = document.getElementById('resultLead');
    var cumulativeStatsSection = document.getElementById('cumulativeStatsSection');
    var printPdfButton = document.getElementById('printPdfButton');

    var total = Number(result.total) || result.answers.length || 0;
    var score = Number(result.score) || 0;
    var accuracy = total > 0 ? Math.round((score / total) * 100) : 0;
    var isMock = result.mode === 'mock' || (result.settings && result.settings.mode === 'mock');

    if (scoreValue) {
      if (isMock) {
        scoreValue.innerHTML = score + ' / ' + total + '<br><span class="mock-point-value">' + accuracy + '点</span>';
      } else {
        scoreValue.textContent = score + ' / ' + total;
      }
    }

    if (accuracyValue) accuracyValue.textContent = accuracy + '%';
    if (modeValue) modeValue.textContent = modeLabel(result.settings && result.settings.mode);

    if (isMock) {
      if (categoryValue) categoryValue.textContent = result.settings.mockDisplayName || '模擬試験';
      if (resultLead) resultLead.textContent = '模擬試験の結果です。問題1〜40の合否を一覧表示します。';
      if (cumulativeStatsSection) cumulativeStatsSection.style.display = 'none';
      if (reviewList) reviewList.classList.add('mock-compact-grid');
    } else {
      if (result.settings && result.settings.mode === 'weakCategory' && result.settings.weakCategory) {
        if (categoryValue) categoryValue.textContent = categoryLabel(result.settings.weakCategory);
      } else {
        if (categoryValue) categoryValue.textContent = categoryLabel(result.settings && result.settings.category);
      }
      renderCumulativeStats();
    }

    if (printPdfButton) {
      printPdfButton.addEventListener('click', function () {
        window.print();
      });
    }

    if (reviewList) {
      reviewList.innerHTML = '';

      result.answers.forEach(function (item, index) {
        var html = isMock
          ? buildMockReviewHtml(item, index)
          : buildStudyReviewHtml(item, index);

        reviewList.insertAdjacentHTML('beforeend', html);
      });
    }
  }

  function setupInstallPromptListener() {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredInstallPrompt = e;
    });

    window.addEventListener('appinstalled', function () {
      deferredInstallPrompt = null;
    });
  }

  function boot() {
    setupInstallPromptListener();
    initTopPage();
    initQuizPage();
    initResultPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();