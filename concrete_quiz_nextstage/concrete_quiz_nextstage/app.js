(function () {
  "use strict";

  const STORAGE_KEYS = {
    QUIZ_SETTINGS: "concreteQuizSettings",
    QUIZ_SESSION: "concreteQuizSession",
    QUIZ_RESULT: "concreteQuizResult",
    LEARNING_HISTORY: "concreteQuizLearningHistory"
  };

  let isAnswerLocked = false;


  let deferredInstallPrompt = null;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    document.dispatchEvent(new CustomEvent("appinstallready"));
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    document.dispatchEvent(new CustomEvent("appinstalledstate"));
  });

  const CATEGORY_LABELS = {
    a: "材料",
    b: "配合",
    c: "フレッシュコンクリートの性質",
    d: "硬化コンクリート",
    e: "製造・品質管理",
    f: "施工",
    g: "特殊コンクリート",
    h: "構造・力学・法令・その他"
  };

  const MODE_LABELS = {
    normal: "通常",
    random: "完全ランダム",
    weakness: "苦手分野優先",
    review: "間違えた問題だけ"
  };

  function getCategoryLabel(categoryKey, fallback = "") {
    return CATEGORY_LABELS[categoryKey] || fallback || categoryKey || "-";
  }

  function safeParse(json, fallback) {
    try {
      const parsed = JSON.parse(json);
      return parsed ?? fallback;
    } catch (error) {
      return fallback;
    }
  }

  function getStorage(key, fallback) {
    return safeParse(localStorage.getItem(key), fallback);
  }

  function setStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function removeStorage(key) {
    localStorage.removeItem(key);
  }

  function shuffleArray(array) {
    const copied = [...array];
    for (let i = copied.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copied[i], copied[j]] = [copied[j], copied[i]];
    }
    return copied;
  }

  function clampNumber(num, min, max) {
    return Math.min(Math.max(num, min), max);
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) {
      return "0%";
    }
    return `${Math.round(value)}%`;
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getLearningHistory() {
    const history = getStorage(STORAGE_KEYS.LEARNING_HISTORY, null);

    if (history && typeof history === "object") {
      return {
        totalSessions: Number(history.totalSessions || 0),
        totalAnswers: Number(history.totalAnswers || 0),
        totalCorrect: Number(history.totalCorrect || 0),
        categoryStats: history.categoryStats || {},
        wrongQuestionMap: history.wrongQuestionMap || {},
        recentResults: Array.isArray(history.recentResults) ? history.recentResults : []
      };
    }

    return {
      totalSessions: 0,
      totalAnswers: 0,
      totalCorrect: 0,
      categoryStats: {},
      wrongQuestionMap: {},
      recentResults: []
    };
  }

  function saveLearningHistory(history) {
    setStorage(STORAGE_KEYS.LEARNING_HISTORY, history);
  }

  function getAllAvailableQuestions() {
    if (!Array.isArray(window.QUESTIONS)) {
      return [];
    }

    return window.QUESTIONS.filter((question) => {
      if (!question || typeof question !== "object") return false;
      if (question.excluded === true) return false;
      if (!Array.isArray(question.options) || question.options.length !== 4) return false;
      if (
        typeof question.answerIndex !== "number" ||
        question.answerIndex < 0 ||
        question.answerIndex > 3
      ) {
        return false;
      }
      return true;
    });
  }

  function getQuestionById(questionId) {
    return getAllAvailableQuestions().find((q) => q.id === questionId) || null;
  }

  function buildBaseFilteredQuestions(settings) {
    let list = getAllAvailableQuestions();

    if (settings.year !== "all") {
      list = list.filter((question) => String(question.year) === String(settings.year));
    }

    if (settings.category !== "all") {
      list = list.filter((question) => question.category === settings.category);
    }

    return list;
  }

  function getWeaknessScore(categoryKey, history) {
    const stat = history.categoryStats[categoryKey];
    if (!stat) {
      return 999;
    }

    const total = Number(stat.total || 0);
    const correct = Number(stat.correct || 0);

    if (total <= 0) {
      return 999;
    }

    const accuracy = correct / total;
    const wrongWeight = (1 - accuracy) * 100;
    const lowExperienceBonus = total < 3 ? 20 : total < 6 ? 10 : 0;

    return wrongWeight + lowExperienceBonus;
  }

  function sortByWeakness(questions, history) {
    return [...questions].sort((a, b) => {
      const scoreA = getWeaknessScore(a.category, history);
      const scoreB = getWeaknessScore(b.category, history);
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      return Math.random() - 0.5;
    });
  }

  function buildReviewQuestions(settings, history) {
    const wrongIds = Object.keys(history.wrongQuestionMap || {}).filter((id) => {
      return Number(history.wrongQuestionMap[id]) > 0;
    });

    if (wrongIds.length === 0) {
      return [];
    }

    let reviewList = wrongIds
      .map((id) => getQuestionById(id))
      .filter(Boolean)
      .filter((question) => question.excluded !== true);

    if (settings.year !== "all") {
      reviewList = reviewList.filter((question) => String(question.year) === String(settings.year));
    }

    if (settings.category !== "all") {
      reviewList = reviewList.filter((question) => question.category === settings.category);
    }

    reviewList.sort((a, b) => {
      const countA = Number(history.wrongQuestionMap[a.id] || 0);
      const countB = Number(history.wrongQuestionMap[b.id] || 0);
      if (countA !== countB) {
        return countB - countA;
      }
      return Math.random() - 0.5;
    });

    return reviewList;
  }

  function selectQuestionsByMode(settings, history) {
    const count = clampNumber(Number(settings.count || 10), 1, 30);

    const baseList = buildBaseFilteredQuestions(settings);
    if (baseList.length === 0) {
      return [];
    }

    let selectedPool = [];

    switch (settings.mode) {
      case "review":
        selectedPool = buildReviewQuestions(settings, history);
        break;
      case "weakness":
        selectedPool = sortByWeakness(baseList, history);
        break;
      case "random":
        selectedPool = shuffleArray(baseList);
        break;
      case "normal":
      default:
        selectedPool = [...baseList].sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          if (a.category !== b.category) return a.category.localeCompare(b.category, "ja");
          return a.id.localeCompare(b.id, "ja");
        });
        break;
    }

    if (settings.mode === "weakness") {
      const grouped = {};
      selectedPool.forEach((question) => {
        if (!grouped[question.category]) grouped[question.category] = [];
        grouped[question.category].push(question);
      });

      const categoryOrder = Object.keys(grouped).sort((a, b) => {
        return getWeaknessScore(b, history) - getWeaknessScore(a, history);
      });

      const mixed = [];
      let keepGoing = true;
      while (keepGoing) {
        keepGoing = false;
        categoryOrder.forEach((category) => {
          if (grouped[category].length > 0) {
            mixed.push(grouped[category].shift());
            keepGoing = true;
          }
        });
      }
      selectedPool = mixed;
    }

    if (settings.mode === "review" && selectedPool.length === 0) {
      return [];
    }

    if (selectedPool.length <= count) {
      return selectedPool;
    }

    return selectedPool.slice(0, count);
  }

  function createQuizSession(settings, questions) {
    return {
      settings,
      questionIds: questions.map((q) => q.id),
      currentIndex: 0,
      answers: [],
      startedAt: Date.now()
    };
  }

  function getCurrentSession() {
    return getStorage(STORAGE_KEYS.QUIZ_SESSION, null);
  }

  function saveCurrentSession(session) {
    setStorage(STORAGE_KEYS.QUIZ_SESSION, session);
  }

  function getCurrentResult() {
    return getStorage(STORAGE_KEYS.QUIZ_RESULT, null);
  }

  function saveCurrentResult(result) {
    setStorage(STORAGE_KEYS.QUIZ_RESULT, result);
  }

  function buildResultData(session) {
    const questions = session.questionIds
      .map((id) => getQuestionById(id))
      .filter(Boolean);

    const answers = Array.isArray(session.answers) ? session.answers : [];
    const total = questions.length;

    let correctCount = 0;
    const wrongItems = [];
    const categoryTally = {};

    questions.forEach((question) => {
      const answer = answers.find((item) => item.questionId === question.id);
      const userIndex = answer ? answer.selectedIndex : null;
      const isCorrect = userIndex === question.answerIndex;
      const categoryName = getCategoryLabel(question.category, question.categoryName);

      if (isCorrect) {
        correctCount += 1;
      } else {
        wrongItems.push({
          questionId: question.id,
          stem: question.stem,
          year: question.year,
          category: question.category,
          categoryName,
          tags: question.tags || [],
          selectedIndex: userIndex,
          correctIndex: question.answerIndex,
          options: question.options,
          explanation: question.explanation
        });
      }

      if (!categoryTally[question.category]) {
        categoryTally[question.category] = {
          categoryName,
          total: 0,
          correct: 0
        };
      }

      categoryTally[question.category].total += 1;
      if (isCorrect) {
        categoryTally[question.category].correct += 1;
      }
    });

    const accuracy = total > 0 ? (correctCount / total) * 100 : 0;

    return {
      settings: session.settings,
      total,
      correctCount,
      accuracy,
      wrongItems,
      categoryTally,
      completedAt: Date.now()
    };
  }

  function updateLearningHistoryFromResult(result) {
    const history = getLearningHistory();
    history.totalSessions += 1;
    history.totalAnswers += Number(result.total || 0);
    history.totalCorrect += Number(result.correctCount || 0);

    Object.entries(result.categoryTally || {}).forEach(([category, stat]) => {
      if (!history.categoryStats[category]) {
        history.categoryStats[category] = {
          total: 0,
          correct: 0,
          categoryName: getCategoryLabel(category, stat.categoryName)
        };
      }

      history.categoryStats[category].total += Number(stat.total || 0);
      history.categoryStats[category].correct += Number(stat.correct || 0);
      history.categoryStats[category].categoryName = getCategoryLabel(
        category,
        history.categoryStats[category].categoryName
      );
    });

    const wrongIdsThisTime = new Set();

    (result.wrongItems || []).forEach((item) => {
      wrongIdsThisTime.add(item.questionId);
      const currentCount = Number(history.wrongQuestionMap[item.questionId] || 0);
      history.wrongQuestionMap[item.questionId] = currentCount + 1;
    });

    const currentSession = getCurrentSession();
    const resultQuestionIds = [];
    if (currentSession && Array.isArray(currentSession.questionIds)) {
      resultQuestionIds.push(...currentSession.questionIds);
    }

    resultQuestionIds.forEach((questionId) => {
      if (!wrongIdsThisTime.has(questionId)) {
        const current = Number(history.wrongQuestionMap[questionId] || 0);
        if (current > 0) {
          history.wrongQuestionMap[questionId] = current - 1;
        }
      }
    });

    history.recentResults.unshift({
      completedAt: result.completedAt,
      total: result.total,
      correctCount: result.correctCount,
      accuracy: result.accuracy,
      mode: result.settings?.mode || "normal"
    });

    history.recentResults = history.recentResults.slice(0, 10);

    saveLearningHistory(history);
  }

  function getWeaknessText(history, limit = 3) {
    const entries = Object.entries(history.categoryStats || {})
      .map(([category, stat]) => {
        const total = Number(stat.total || 0);
        const correct = Number(stat.correct || 0);
        const accuracy = total > 0 ? (correct / total) * 100 : 0;
        return {
          category,
          categoryName: getCategoryLabel(category, stat.categoryName),
          total,
          accuracy
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => {
        if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
        return a.total - b.total;
      });

    if (entries.length === 0) {
      return "まだ学習履歴がありません";
    }

    return entries
      .slice(0, limit)
      .map((item) => `${item.categoryName}（正答率 ${formatPercent(item.accuracy)}）`)
      .join("、");
  }

  function showQuizFallback(quizArea, fallback) {
    if (quizArea) quizArea.classList.add("is-hidden");
    if (fallback) fallback.classList.remove("is-hidden");
  }

  function showResultFallback(summaryCard, fallback) {
    if (summaryCard) summaryCard.classList.add("is-hidden");
    if (fallback) fallback.classList.remove("is-hidden");
  }

  function initIndexPage() {
    const form = document.getElementById("settingsForm");
    if (!form) return;

    const yearSelect = document.getElementById("yearSelect");
    const categorySelect = document.getElementById("categorySelect");
    const modeSelect = document.getElementById("modeSelect");
    const countSelect = document.getElementById("countSelect");
    const formMessage = document.getElementById("formMessage");
    const continueButton = document.getElementById("continueButton");
    const installAppButton = document.getElementById("installAppButton");
    const installMessage = document.getElementById("installMessage");

    const savedSettings = getStorage(STORAGE_KEYS.QUIZ_SETTINGS, {
      year: "all",
      category: "all",
      mode: "normal",
      count: "10"
    });

    if (yearSelect) yearSelect.value = savedSettings.year || "all";
    if (categorySelect) categorySelect.value = savedSettings.category || "all";
    if (modeSelect) modeSelect.value = savedSettings.mode || "normal";
    if (countSelect) countSelect.value = String(savedSettings.count || "10");

    const existingSession = getCurrentSession();
    if (continueButton) {
      const canContinue = Boolean(existingSession && Array.isArray(existingSession.questionIds) && existingSession.questionIds.length > 0 && Number(existingSession.currentIndex || 0) < existingSession.questionIds.length);
      continueButton.classList.toggle("is-hidden", !canContinue);
      continueButton.addEventListener("click", () => {
        location.href = "quiz.html";
      });
    }

    if (installAppButton) {
      const updateInstallUi = () => {
        const isStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
        if (isStandalone) {
          installAppButton.classList.add("is-hidden");
          if (installMessage) installMessage.textContent = "この端末ではホーム画面アプリとして利用中です。";
          return;
        }

        if (deferredInstallPrompt) {
          installAppButton.classList.remove("is-hidden");
          if (installMessage) installMessage.textContent = "ボタンからホーム画面追加・インストールができます。";
        } else {
          installAppButton.classList.add("is-hidden");
          if (installMessage) {
            installMessage.textContent = "iPhoneはSafariの共有メニューから『ホーム画面に追加』でアプリ風に使えます。";
          }
        }
      };

      installAppButton.addEventListener("click", async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        try {
          await deferredInstallPrompt.userChoice;
        } catch (error) {
          // no-op
        }
        deferredInstallPrompt = null;
        updateInstallUi();
      });

      document.addEventListener("appinstallready", updateInstallUi);
      document.addEventListener("appinstalledstate", updateInstallUi);
      updateInstallUi();
    }

    renderDashboard();

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const settings = {
        year: yearSelect ? yearSelect.value : "all",
        category: categorySelect ? categorySelect.value : "all",
        mode: modeSelect ? modeSelect.value : "normal",
        count: countSelect ? countSelect.value : "10"
      };

      const history = getLearningHistory();
      const selectedQuestions = selectQuestionsByMode(settings, history);

      if (settings.mode === "review" && selectedQuestions.length === 0) {
        formMessage.textContent =
          "復習対象の問題がまだありません。先に通常モードなどで学習してからお試しください。";
        return;
      }

      if (selectedQuestions.length === 0) {
        formMessage.textContent =
          "指定条件に一致する問題がありません。年度・分野の条件を見直してください。";
        return;
      }

      formMessage.textContent = "";
      setStorage(STORAGE_KEYS.QUIZ_SETTINGS, settings);
      removeStorage(STORAGE_KEYS.QUIZ_RESULT);

      const session = createQuizSession(settings, selectedQuestions);
      saveCurrentSession(session);

      location.href = "quiz.html";
    });
  }

  function renderDashboard() {
    const history = getLearningHistory();

    const sessionsEl = document.getElementById("dashboardSessions");
    const answersEl = document.getElementById("dashboardAnswers");
    const accuracyEl = document.getElementById("dashboardAccuracy");
    const weaknessEl = document.getElementById("dashboardWeakness");

    if (sessionsEl) sessionsEl.textContent = `${history.totalSessions}回`;
    if (answersEl) answersEl.textContent = `${history.totalAnswers}問`;
    if (accuracyEl) {
      const accuracy =
        history.totalAnswers > 0 ? (history.totalCorrect / history.totalAnswers) * 100 : 0;
      accuracyEl.textContent = formatPercent(accuracy);
    }
    if (weaknessEl) weaknessEl.textContent = getWeaknessText(history, 1);
  }

  function initQuizPage() {
    const session = getCurrentSession();
    const quizArea = document.getElementById("quizArea");
    const fallback = document.getElementById("quizFallback");

    if (!session || !Array.isArray(session.questionIds) || session.questionIds.length === 0) {
      showQuizFallback(quizArea, fallback);
      return;
    }

    const currentQuestion = getQuestionById(session.questionIds[session.currentIndex]);
    if (!currentQuestion) {
      showQuizFallback(quizArea, fallback);
      return;
    }

    const progressBadge = document.getElementById("progressBadge");
    const scoreBadge = document.getElementById("scoreBadge");
    const yearBadge = document.getElementById("yearBadge");
    const categoryBadge = document.getElementById("categoryBadge");
    const modeBadge = document.getElementById("modeBadge");
    const accuracyBadge = document.getElementById("accuracyBadge");
    const progressBarFill = document.getElementById("progressBarFill");
    const questionTags = document.getElementById("questionTags");
    const questionNumber = document.getElementById("questionNumber");
    const questionStem = document.getElementById("questionStem");
    const optionsContainer = document.getElementById("optionsContainer");
    const feedbackArea = document.getElementById("feedbackArea");
    const feedbackResult = document.getElementById("feedbackResult");
    const explanationText = document.getElementById("explanationText");
    const nextButton = document.getElementById("nextButton");
    const backToTitleButton = document.getElementById("backToTitleButton");

    isAnswerLocked = false;

    const currentAnswer = session.answers.find((a) => a.questionId === currentQuestion.id) || null;
    const correctCount = session.answers.filter((a) => a.isCorrect).length;
    const currentIndexHuman = session.currentIndex + 1;
    const totalCount = session.questionIds.length;
    const categoryName = getCategoryLabel(currentQuestion.category, currentQuestion.categoryName);

    if (progressBadge) {
      progressBadge.textContent = `第 ${currentIndexHuman} 問 / ${totalCount} 問中`;
    }
    if (scoreBadge) {
      scoreBadge.textContent = `正解数: ${correctCount}`;
    }
    if (yearBadge) {
      yearBadge.textContent = `年度: ${currentQuestion.year}`;
    }
    if (categoryBadge) {
      categoryBadge.textContent = `分野: ${categoryName}`;
    }
    if (modeBadge) {
      modeBadge.textContent = `モード: ${MODE_LABELS[session.settings?.mode] || "通常"}`;
    }
    if (accuracyBadge) {
      const currentAccuracy = session.answers.length > 0 ? (correctCount / session.answers.length) * 100 : 0;
      accuracyBadge.textContent = `現在正答率: ${formatPercent(currentAccuracy)}`;
    }
    if (progressBarFill) {
      progressBarFill.style.width = `${(currentIndexHuman / totalCount) * 100}%`;
    }

    if (questionNumber) {
      questionNumber.textContent = `問題 ${currentIndexHuman}`;
    }

    if (questionStem) {
      questionStem.innerHTML = currentQuestion.stem;
    }

    if (questionTags) {
      questionTags.innerHTML = "";
      const tagItems = [
        `年度 ${currentQuestion.year}`,
        `${currentQuestion.category} ${categoryName}`,
        ...(Array.isArray(currentQuestion.tags) ? currentQuestion.tags : [])
      ];

      tagItems.forEach((tag) => {
        const span = document.createElement("span");
        span.className = "tag-chip";
        span.textContent = tag;
        questionTags.appendChild(span);
      });
    }

    if (optionsContainer) {
      optionsContainer.innerHTML = "";

      currentQuestion.options.forEach((optionText, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "option-button";

        const optionLabel = ["A", "B", "C", "D"][index] || String(index + 1);
        button.innerHTML = `<strong>${optionLabel}.</strong> ${escapeHtml(optionText)}`;

        const isAnswered = Boolean(currentAnswer);
        if (isAnswered) {
          button.disabled = true;
          if (index === currentQuestion.answerIndex) {
            button.classList.add("correct");
          }
          if (
            currentAnswer &&
            index === currentAnswer.selectedIndex &&
            currentAnswer.selectedIndex !== currentQuestion.answerIndex
          ) {
            button.classList.add("wrong");
          }
        }

        button.addEventListener("click", () => {
          if (currentAnswer || isAnswerLocked) return;
          isAnswerLocked = true;

          const isCorrect = index === currentQuestion.answerIndex;
          session.answers.push({
            questionId: currentQuestion.id,
            selectedIndex: index,
            isCorrect
          });
          saveCurrentSession(session);
          initQuizPage();
        });

        optionsContainer.appendChild(button);
      });
    }

    if (currentAnswer && feedbackArea && feedbackResult && explanationText && nextButton) {
      feedbackArea.classList.remove("is-hidden");
      feedbackResult.textContent = currentAnswer.isCorrect ? "正解です" : "不正解です";
      feedbackResult.className = `feedback-result ${currentAnswer.isCorrect ? "is-correct" : "is-wrong"}`;
      explanationText.textContent = currentQuestion.explanation || "解説はありません。";
      nextButton.classList.remove("is-hidden");
    } else if (feedbackArea && nextButton) {
      feedbackArea.classList.add("is-hidden");
      nextButton.classList.add("is-hidden");
    }

    if (nextButton) {
      nextButton.onclick = () => {
        if (session.currentIndex < session.questionIds.length - 1) {
          session.currentIndex += 1;
          saveCurrentSession(session);
          initQuizPage();
        } else {
          const result = buildResultData(session);
          saveCurrentResult(result);
          updateLearningHistoryFromResult(result);
          location.href = "result.html";
        }
      };
    }

    if (backToTitleButton) {
      backToTitleButton.onclick = () => {
        location.href = "index.html";
      };
    }
  }

  function initResultPage() {
    const result = getCurrentResult();
    const summaryCard = document.getElementById("resultSummaryCard");
    const fallback = document.getElementById("resultFallback");

    if (!result) {
      showResultFallback(summaryCard, fallback);
      return;
    }

    const correctCountEl = document.getElementById("resultCorrectCount");
    const totalCountEl = document.getElementById("resultTotalCount");
    const accuracyEl = document.getElementById("resultAccuracy");
    const modeEl = document.getElementById("resultMode");
    const weaknessSummary = document.getElementById("weaknessSummary");
    const wrongListArea = document.getElementById("wrongListArea");
    const retryButton = document.getElementById("retrySameSettingsButton");

    if (correctCountEl) correctCountEl.textContent = `${result.correctCount}問`;
    if (totalCountEl) totalCountEl.textContent = `${result.total}問`;
    if (accuracyEl) accuracyEl.textContent = formatPercent(result.accuracy);
    if (modeEl) modeEl.textContent = MODE_LABELS[result.settings?.mode] || "通常";

    const history = getLearningHistory();
    if (weaknessSummary) {
      weaknessSummary.textContent = getWeaknessText(history, 3);
    }

    if (wrongListArea) {
      if (!Array.isArray(result.wrongItems) || result.wrongItems.length === 0) {
        wrongListArea.innerHTML = `<p class="empty-message">全問正解です。お疲れさまでした。</p>`;
      } else {
        wrongListArea.innerHTML = result.wrongItems
          .map((item, idx) => {
            const optionsHtml = (item.options || [])
              .map((option, optionIndex) => {
                const classes = [];
                if (optionIndex === item.correctIndex) classes.push("correct");
                if (
                  optionIndex === item.selectedIndex &&
                  item.selectedIndex !== item.correctIndex
                ) {
                  classes.push("wrong");
                }

                return `
                  <li class="review-option ${classes.join(" ")}">
                    <span class="review-option-label">${["A", "B", "C", "D"][optionIndex] || optionIndex + 1}</span>
                    <span class="review-option-text">${escapeHtml(option)}</span>
                  </li>
                `;
              })
              .join("");

            return `
              <article class="review-card">
                <div class="review-meta">
                  <span class="tag-chip">誤答 ${idx + 1}</span>
                  <span class="tag-chip">${escapeHtml(String(item.year))}年</span>
                  <span class="tag-chip">${escapeHtml(item.category || "")} ${escapeHtml(item.categoryName || "-")}</span>
                </div>
                <div class="review-stem">${item.stem}</div>
                <ul class="review-options">${optionsHtml}</ul>
                <div class="review-explanation">
                  <strong>解説：</strong> ${escapeHtml(item.explanation || "解説はありません。")}
                </div>
              </article>
            `;
          })
          .join("");
      }
    }

    if (retryButton) {
      retryButton.onclick = () => {
        const settings = result.settings || getStorage(STORAGE_KEYS.QUIZ_SETTINGS, null);
        if (!settings) {
          location.href = "index.html";
          return;
        }

        const historyNow = getLearningHistory();
        const selectedQuestions = selectQuestionsByMode(settings, historyNow);

        if (!selectedQuestions.length) {
          location.href = "index.html";
          return;
        }

        setStorage(STORAGE_KEYS.QUIZ_SETTINGS, settings);
        const session = createQuizSession(settings, selectedQuestions);
        saveCurrentSession(session);
        removeStorage(STORAGE_KEYS.QUIZ_RESULT);
        location.href = "quiz.html";
      };
    }
  }

  function init() {
    const page = document.body?.dataset?.page;

    switch (page) {
      case "index":
        initIndexPage();
        break;
      case "quiz":
        initQuizPage();
        break;
      case "result":
        initResultPage();
        break;
      default:
        break;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();