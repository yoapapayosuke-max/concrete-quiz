(function () {
  'use strict';

  var CATEGORY_ORDER = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

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
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

  function normalizeQuestions() {
    var source = getQuestionSource();

    return source
      .map(function (q, index) {
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
          question: q.question || q.stem || '問題文が設定されていません。',
          options: options,
          answer: answerIndex,
          explanation: q.explanation || ''
        };
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

  function modeLabel(value) {
    var map = {
      normal: '通常',
      random: 'ランダム',
      wrongOnly: '間違えた問題の復習',
      weakCategory: '正答率の低い分野の復習'
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
      if (!parsed.categories || typeof parsed.categories !== 'object') {
        parsed.categories = {};
      }
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

      if (item.isCorrect) {
        wrongSet.delete(item.questionId);
      } else {
        wrongSet.add(item.questionId);
      }
    });

    saveWrongQuestionIds(Array.from(wrongSet));
  }

  function updatePerformanceStats(resultAnswers) {
    var stats = getPerformanceStats();

    resultAnswers.forEach(function (item) {
      if (!item) return;

      stats.totalAnswered += 1;
      if (item.isCorrect) {
        stats.totalCorrect += 1;
      }

      var category = item.category || 'all';
      if (!stats.categories[category]) {
        stats.categories[category] = {
          answered: 0,
          correct: 0
        };
      }

      stats.categories[category].answered += 1;
      if (item.isCorrect) {
        stats.categories[category].correct += 1;
      }
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
        weakest = {
          category: categoryKey,
          accuracy: accuracy,
          answered: item.answered
        };
        return;
      }

      if (accuracy < weakest.accuracy) {
        weakest = {
          category: categoryKey,
          accuracy: accuracy,
          answered: item.answered
        };
        return;
      }

      if (accuracy === weakest.accuracy && item.answered > weakest.answered) {
        weakest = {
          category: categoryKey,
          accuracy: accuracy,
          answered: item.answered
        };
      }
    });

    return weakest;
  }

  function buildSession(settings) {
    var all = normalizeQuestions();
    var filtered = all;

    if (settings.mode === 'weakCategory') {
      var stats = getPerformanceStats();
      var weakest = getWeakestCategory(stats);

      if (!weakest) {
        filtered = [];
      } else {
        settings.weakCategory = weakest.category;
        filtered = all.filter(function (q) {
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
      settings: settings,
      questions: selected,
      currentIndex: 0,
      score: 0,
      answers: [],
      startedAt: Date.now()
    };
  }

  function saveQuizSession(session) {
    sessionStorage.setItem('quizSession', JSON.stringify(session));
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
    sessionStorage.setItem('quizResult', JSON.stringify(result));
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

  function startQuiz() {
    var themeSelect = document.getElementById('themeSelect');
    var modeSelect = document.getElementById('modeSelect');
    var questionCount = document.getElementById('questionCount');
    var categorySelect = document.getElementById('categorySelect');

    var savedTheme = getSavedTheme();

    var settings = {
      mode: modeSelect ? modeSelect.value : 'normal',
      count: questionCount ? Number(questionCount.value) : 10,
      category: categorySelect ? categorySelect.value : 'all',
      theme: themeSelect ? themeSelect.value : savedTheme
    };

    applyTheme(settings.theme);

    var session = buildSession(settings);

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

  function initTopPage() {
    var startForm = document.getElementById('startForm');
    if (!startForm) return;

    var themeSelect = document.getElementById('themeSelect');
    var startButton = startForm.querySelector('button[type="submit"]');
    var resetStatsButton = document.getElementById('resetStatsButton');

    var savedTheme = getSavedTheme();
    applyTheme(savedTheme);

    if (themeSelect) {
      themeSelect.value = savedTheme;
      themeSelect.addEventListener('change', function () {
        applyTheme(themeSelect.value);
      });
    }

    renderCumulativeStats();

    startForm.addEventListener('submit', function (e) {
      e.preventDefault();
      startQuiz();
    });

    if (startButton) {
      startButton.addEventListener('click', function (e) {
        e.preventDefault();
        startQuiz();
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

    var theme =
      session &&
      session.settings &&
      session.settings.theme
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

    if (!optionsArea || !questionText || !nextButton) return;

    var answered = false;

    function renderQuestion() {
      var current = session.questions[session.currentIndex];
      var total = session.questions.length;
      var number = session.currentIndex + 1;
      var accuracy = session.answers.length
        ? Math.round((session.score / session.answers.length) * 100)
        : 0;

      answered = false;

      if (modeBadge) modeBadge.textContent = modeLabel(session.settings.mode);

      if (session.settings.mode === 'weakCategory' && session.settings.weakCategory) {
        if (categoryBadge) categoryBadge.textContent = '分野: ' + categoryLabel(session.settings.weakCategory);
      } else {
        if (categoryBadge) categoryBadge.textContent = '分野: ' + categoryLabel(session.settings.category);
      }

      if (accuracyBadge) accuracyBadge.textContent = '正答率 ' + accuracy + '%';
      if (progressText) progressText.textContent = number + ' / ' + total;
      if (progressFill) progressFill.style.width = ((number / total) * 100) + '%';
      if (questionNumber) questionNumber.textContent = '第' + number + '問';
      if (questionText) questionText.textContent = current.question;

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
            options: current.options.slice(),
            selectedIndex: index,
            correctIndex: current.answer,
            explanation: current.explanation,
            isCorrect: isCorrect,
            category: current.category
          });

          if (isCorrect) {
            session.score += 1;
          }

          Array.from(optionsArea.querySelectorAll('.option-button')).forEach(function (btn, btnIndex) {
            btn.disabled = true;

            if (btnIndex === current.answer) {
              btn.classList.add('correct');
            }

            if (btnIndex === index && btnIndex !== current.answer) {
              btn.classList.add('incorrect');
            }

            if (btnIndex === index) {
              btn.classList.add('selected');
            }
          });

          if (feedbackArea) feedbackArea.classList.remove('hidden');

          if (answerStatus) {
            answerStatus.className = 'answer-status ' + (isCorrect ? 'status-correct' : 'status-incorrect');
            answerStatus.textContent = isCorrect ? '正解です' : '不正解です';
          }

          if (explanationBox) {
            var correctText = current.options[current.answer] || '';
            explanationBox.innerHTML =
              '<div class="explanation-title">解説</div>' +
              '<div class="explanation-answer">正解: ' +
              escapeHtml(String.fromCharCode(65 + current.answer) + '. ' + correctText) +
              '</div>' +
              '<div class="explanation-body">' +
              escapeHtml(current.explanation || '解説は未設定です。') +
              '</div>';
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
          finishedAt: Date.now()
        };
        saveQuizResult(result);
        updateWrongQuestionHistory(session.answers);
        updatePerformanceStats(session.answers);
        location.href = 'result.html';
        return;
      }

      session.currentIndex += 1;
      saveQuizSession(session);
      renderQuestion();
    });

    renderQuestion();
  }

  function initResultPage() {
    var resultArea = document.getElementById('resultArea');
    if (!resultArea) return;

    var result = loadQuizResult();
    if (!result || !Array.isArray(result.answers)) {
      location.href = 'index.html';
      return;
    }

    var theme =
      result &&
      result.settings &&
      result.settings.theme
        ? result.settings.theme
        : getSavedTheme();

    applyTheme(theme);

    var scoreValue = document.getElementById('scoreValue');
    var accuracyValue = document.getElementById('accuracyValue');
    var modeValue = document.getElementById('modeValue');
    var categoryValue = document.getElementById('categoryValue');
    var reviewList = document.getElementById('reviewList');

    var total = Number(result.total) || result.answers.length || 0;
    var score = Number(result.score) || 0;
    var accuracy = total > 0 ? Math.round((score / total) * 100) : 0;

    if (scoreValue) scoreValue.textContent = score + ' / ' + total;
    if (accuracyValue) accuracyValue.textContent = accuracy + '%';
    if (modeValue) modeValue.textContent = modeLabel(result.settings && result.settings.mode);

    if (result.settings && result.settings.mode === 'weakCategory' && result.settings.weakCategory) {
      if (categoryValue) categoryValue.textContent = categoryLabel(result.settings.weakCategory);
    } else {
      if (categoryValue) categoryValue.textContent = categoryLabel(result.settings && result.settings.category);
    }

    renderCumulativeStats();

    if (reviewList) {
      reviewList.innerHTML = '';

      result.answers.forEach(function (item, index) {
        var review = document.createElement('article');
        review.className = 'result-question-card';

        var selectedText = item.options[item.selectedIndex] || '';
        var correctText = item.options[item.correctIndex] || '';

        review.innerHTML =
          '<div class="review-top">' +
            '<div class="review-number">第' + (index + 1) + '問</div>' +
            '<div class="review-badge ' + (item.isCorrect ? 'review-badge-correct' : 'review-badge-incorrect') + '">' +
              (item.isCorrect ? '正解' : '不正解') +
            '</div>' +
          '</div>' +
          '<div class="review-question">' + escapeHtml(item.question) + '</div>' +
          '<div class="review-answer-block">' +
            '<div class="review-line"><span class="review-label">あなたの解答</span><span class="review-user ' + (item.isCorrect ? 'text-correct' : 'text-incorrect') + '">' +
              escapeHtml(String.fromCharCode(65 + item.selectedIndex) + '. ' + selectedText) +
            '</span></div>' +
            '<div class="review-line"><span class="review-label">正解</span><span class="review-correct text-correct">' +
              escapeHtml(String.fromCharCode(65 + item.correctIndex) + '. ' + correctText) +
            '</span></div>' +
          '</div>' +
          '<div class="review-explanation">' +
            '<div class="explanation-title">解説</div>' +
            '<div class="explanation-body">' + escapeHtml(item.explanation || '解説は未設定です。') + '</div>' +
          '</div>';

        reviewList.appendChild(review);
      });
    }
  }

  function boot() {
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