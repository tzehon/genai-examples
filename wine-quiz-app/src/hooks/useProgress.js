import { useState, useEffect, useCallback } from 'react';

const PROGRESS_KEY = 'wineQuizProgress';

const defaultProgress = {
  wineProgress: {},
  categoryProgress: {},
  streakData: {
    currentStreak: 0,
    longestStreak: 0,
    lastQuizDate: null
  },
  settings: {
    enabledModes: ['category-match', 'wine-selection', 'pronunciation', 'quick-fire', 'description-match', 'odd-one-out', 'origin-match'],
    focusCategories: [],
    difficulty: 'medium',
    questionsPerSession: 10,
    darkMode: false
  },
  stats: {
    totalQuizzes: 0,
    totalQuestions: 0
  }
};

/**
 * Hook for managing user progress in localStorage
 */
export function useProgress() {
  const [progress, setProgress] = useState(() => {
    const saved = localStorage.getItem(PROGRESS_KEY);
    if (saved) {
      try {
        return { ...defaultProgress, ...JSON.parse(saved) };
      } catch {
        return defaultProgress;
      }
    }
    return defaultProgress;
  });

  // Save to localStorage whenever progress changes
  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }, [progress]);

  // Update wine progress after answer
  const recordWineAnswer = useCallback((wineName, isCorrect) => {
    setProgress(prev => {
      const wineData = prev.wineProgress[wineName] || {
        timesCorrect: 0,
        timesIncorrect: 0,
        lastSeen: null,
        nextReview: null,
        easeFactor: 2.5
      };

      const now = new Date().toISOString();

      return {
        ...prev,
        wineProgress: {
          ...prev.wineProgress,
          [wineName]: {
            ...wineData,
            timesCorrect: wineData.timesCorrect + (isCorrect ? 1 : 0),
            timesIncorrect: wineData.timesIncorrect + (isCorrect ? 0 : 1),
            lastSeen: now
          }
        }
      };
    });
  }, []);

  // Update category progress after answer
  const recordCategoryAnswer = useCallback((categoryId, isCorrect) => {
    setProgress(prev => {
      const categoryData = prev.categoryProgress[categoryId] || {
        timesCorrect: 0,
        timesIncorrect: 0
      };

      return {
        ...prev,
        categoryProgress: {
          ...prev.categoryProgress,
          [categoryId]: {
            timesCorrect: categoryData.timesCorrect + (isCorrect ? 1 : 0),
            timesIncorrect: categoryData.timesIncorrect + (isCorrect ? 0 : 1)
          }
        }
      };
    });
  }, []);

  // Update streak after completing a quiz
  const updateStreak = useCallback(() => {
    setProgress(prev => {
      const today = new Date().toISOString().split('T')[0];
      const lastDate = prev.streakData.lastQuizDate;

      let newStreak = prev.streakData.currentStreak;

      if (!lastDate) {
        newStreak = 1;
      } else {
        const lastDateObj = new Date(lastDate);
        const todayObj = new Date(today);
        const diffDays = Math.floor((todayObj - lastDateObj) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          // Same day, keep streak
        } else if (diffDays === 1) {
          // Consecutive day, increment streak
          newStreak = prev.streakData.currentStreak + 1;
        } else {
          // Streak broken, reset
          newStreak = 1;
        }
      }

      return {
        ...prev,
        streakData: {
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, prev.streakData.longestStreak),
          lastQuizDate: today
        },
        stats: {
          ...prev.stats,
          totalQuizzes: prev.stats.totalQuizzes + 1
        }
      };
    });
  }, []);

  // Increment total questions
  const incrementQuestions = useCallback(() => {
    setProgress(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        totalQuestions: prev.stats.totalQuestions + 1
      }
    }));
  }, []);

  // Update settings
  const updateSettings = useCallback((newSettings) => {
    setProgress(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...newSettings
      }
    }));
  }, []);

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setProgress(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        darkMode: !prev.settings.darkMode
      }
    }));
  }, []);

  // Reset all progress
  const resetProgress = useCallback(() => {
    setProgress(defaultProgress);
    localStorage.removeItem(PROGRESS_KEY);
  }, []);

  // Export progress as JSON
  const exportProgress = useCallback(() => {
    const dataStr = JSON.stringify(progress, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wine-quiz-progress-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [progress]);

  // Import progress from JSON
  const importProgress = useCallback((jsonData) => {
    try {
      const imported = JSON.parse(jsonData);
      setProgress({ ...defaultProgress, ...imported });
      return true;
    } catch {
      return false;
    }
  }, []);

  // Mark wine as known/need to study in study mode
  const markWineStudyStatus = useCallback((wineName, status) => {
    setProgress(prev => {
      const wineData = prev.wineProgress[wineName] || {
        timesCorrect: 0,
        timesIncorrect: 0,
        lastSeen: null,
        nextReview: null,
        easeFactor: 2.5
      };

      return {
        ...prev,
        wineProgress: {
          ...prev.wineProgress,
          [wineName]: {
            ...wineData,
            studyStatus: status
          }
        }
      };
    });
  }, []);

  return {
    progress,
    recordWineAnswer,
    recordCategoryAnswer,
    updateStreak,
    incrementQuestions,
    updateSettings,
    toggleDarkMode,
    resetProgress,
    exportProgress,
    importProgress,
    markWineStudyStatus
  };
}
