(function () {
  'use strict';

  function applyTheme(theme) {
    const safeTheme = theme === 'dark' ? 'dark' : 'light';
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
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function getQuestionSource() {
    try {
      if (typeof questions !== 'undefined' && Array.isArray(questions)) {
        return questions;
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
      if (typeof window !== 'undefined' && Array.isArray(window.QUESTIONS)) {
        return window.QUESTIONS;
      }
    } catch (e) {}

    return [];
  }

  function normalizeQuestions() {
    const source = getQuestionSource();

    return source
      .map(function (q, index) {
        if (!q || typeof q !== 'object') return null;

        const options = Array.isArray(q.options) ? q.options.slice() : [];
        let answerIndex = Number(q.answer);

        if (!Number.isInteger(answerIndex) && typeof q.correct === 'number') {
          answerIndex = Number(q.correct);
        }

        if (!Number.isInteger(answerIndex) && typeof q.answerIndex === 'number') {
          answerIndex = Number(q.answerIndex);
        }

        if (!Number.isInteger(answerIndex)) {
          answerIndex = 0;
        }

        return {
          id: q.id || ('q' + (index + 1)),
          category: q.category || 'all',
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
    const map = {
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
    const map = {
      normal: '通常',
      random: 'ランダム',
      review: '復習向け'
    };
    return map[value] || value || '通常';
  }

  function buildSession(settings) {
    const all = normalizeQuestions();

    let filtered = all;
    if (settings.category && settings.category !== 'all') {
      filtered = all.filter(function (q) {
        return q.category === settings.category;
      });
    }

    if (settings.mode === 'review') {
      filtered = filtered.slice().reverse();
    }

    if (settings.mode === 'random') {
      filtered = shuffleArray(filtered);
    }

    const count = Math.max(1, Number(settings.count) || 10);
    const selected = filtered.slice(0, count);

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
    const raw = sessionStorage.getItem('quizSession');
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
    const raw = sessionStorage.getItem('quizResult');
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function initTopPage() {
    const startForm = document.getElementById('startForm');
    if (!startForm) return;

    const themeSelect = document.getElementById('themeSelect');
    const modeSelect = document.getElementById('modeSelect');
    const questionCount = document.getElementById('questionCount');
    const categorySelect = document.getElementById('categorySelect');

    const savedTheme = getSavedTheme();
    applyTheme(savedTheme);

    if (themeSelect) {
      themeSelect.value = savedTheme;
      themeSelect.addEventListener('change', function () {
        applyTheme(themeSelect.value);
      });
    }

    startForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const settings = {
        mode: modeSelect ? modeSelect.value : 'normal',
        count: questionCount ? Number(questionCount.value) : 10,
        category: categorySelect ? categorySelect.value : 'all',
        theme: themeSelect ? themeSelect.value : savedTheme
      };

      applyTheme(settings.theme);

      const session = buildSession(settings);

      if (!session.questions.length) {
        alert('問題データを読み込めませんでした。questions.js の変数名や形式を確認してください。');
        return;
      }

      saveQuizSession(session);
      location.href = 'quiz.html';
    });
  }

  function initQuizPage() {
    const quizArea = document.getElementById('quizArea');
    if (!quizArea) return;

    const session = loadQuizSession();
    if (!session || !Array.isArray(session.questions) || !session.questions.length) {
      location.href = 'index.html';
      return;
    }

    const theme =
      session &&
      session.settings &&
      session.settings.theme
        ? session.settings.theme
        : getSavedTheme();

    applyTheme(theme);

    const modeBadge = document.getElementById('modeBadge');
    const accuracyBadge = document.getElementById('accuracyBadge');
    const categoryBadge = document.getElementById('categoryBadge');
    const progressText = document.getElementById('progressText');
    const progressFill = document.getElementById('progressFill');
    const questionNumber = document.getElementById('questionNumber');
    const questionText = document.getElementById('questionText');
    const optionsArea = document.getElementById('optionsArea');
    const feedbackArea = document.getElementById('feedbackArea');
    const answerStatus = document.getElementById('answerStatus');
    const explanationBox = document.getElementById('explanationBox');
    const nextButton = document.getElementById('nextButton');

    if (!optionsArea || !questionText || !nextButton) {
      console.error('quiz.html のIDが app.js と一致していません');
      return;
    }

    let answered = false;

    function renderQuestion() {
      const current = session.questions[session.currentIndex];
      const total = session.questions.length;
      const number = session.currentIndex + 1;
      const accuracy = session.answers.length
        ? Math.round((session.score / session.answers.length) * 100)
        : 0;

      answered = false;

      if (modeBadge) modeBadge.textContent = modeLabel(session.settings.mode);
      if (accuracyBadge) accuracyBadge.textContent = '正答率 ' + accuracy + '%';
      if (categoryBadge) categoryBadge.textContent = '分野: ' + categoryLabel(session.settings.category);
      if (progressText) progressText.textContent = number + ' / ' + total;
      if (progressFill) progressFill.style.width = ((number / total) * 100) + '%';
      if (questionNumber) questionNumber.textContent = '第' + number + '問';
      questionText.textContent = current.question;

      if (feedbackArea) feedbackArea.classList.add('hidden');
      if (answerStatus) {
        answerStatus.className = 'answer-status';
        answerStatus.textContent = '';
      }
      if (explanationBox) explanationBox.innerHTML = '';
      nextButton.classList.add('hidden');

      optionsArea.innerHTML = '';

      current.options.forEach(function (option, index) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'option-button';
        button.innerHTML =
          '<span class="option-label">' + String.fromCharCode(65 + index) + '.</span>' +
          '<span class="option-text">' + escapeHtml(option) + '</span>';

        button.addEventListener('click', function () {
          if (answered) return;
          answered = true;

          const isCorrect = index === current.answer;

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
            const correctText = current.options[current.answer] || '';
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
            const newAccuracy = Math.round((session.score / session.answers.length) * 100);
            accuracyBadge.textContent = '正答率 ' + newAccuracy + '%';
          }

          nextButton.textContent = session.currentIndex >= session.questions.length - 1 ? '結果を見る' : '次へ';
          nextButton.classList.remove('hidden');
        });

        optionsArea.appendChild(button);
      });
    }

    nextButton.addEventListener('click', function () {
      if (session.currentIndex >= session.questions.length - 1) {
        const result = {
          score: session.score,
          total: session.questions.length,
          answers: session.answers,
          settings: session.settings,
          finishedAt: Date.now()
        };
        saveQuizResult(result);
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
    const resultArea = document.getElementById('resultArea');
    if (!resultArea) return;

    const result = loadQuizResult();
    if (!result || !Array.isArray(result.answers)) {
      location.href = 'index.html';
      return;
    }

    const theme =
      result &&
      result.settings &&
      result.settings.theme
        ? result.settings.theme
        : getSavedTheme();

    applyTheme(theme);

    const scoreValue = document.getElementById('scoreValue');
    const accuracyValue = document.getElementById('accuracyValue');
    const modeValue = document.getElementById('modeValue');
    const categoryValue = document.getElementById('categoryValue');
    const reviewList = document.getElementById('reviewList');

    const total = Number(result.total) || result.answers.length || 0;
    const score = Number(result.score) || 0;
    const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;

    if (scoreValue) scoreValue.textContent = score + ' / ' + total;
    if (accuracyValue) accuracyValue.textContent = accuracy + '%';
    if (modeValue) modeValue.textContent = modeLabel(result.settings && result.settings.mode);
    if (categoryValue) categoryValue.textContent = categoryLabel(result.settings && result.settings.category);

    if (reviewList) {
      reviewList.innerHTML = '';

      result.answers.forEach(function (item, index) {
        const review = document.createElement('article');
        review.className = 'result-question-card';

        const selectedText = item.options[item.selectedIndex] || '';
        const correctText = item.options[item.correctIndex] || '';

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

  document.addEventListener('DOMContentLoaded', function () {
    initTopPage();
    initQuizPage();
    initResultPage();
  });
})();