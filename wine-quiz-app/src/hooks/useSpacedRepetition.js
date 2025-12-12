import { useCallback, useMemo } from 'react';

/**
 * SM-2 Algorithm implementation for spaced repetition
 *
 * Quality ratings:
 * 0 - Complete blackout
 * 1 - Incorrect response, but remembered on seeing correct
 * 2 - Incorrect response, but correct seemed easy to recall
 * 3 - Correct with serious difficulty
 * 4 - Correct after hesitation
 * 5 - Perfect response
 */

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;

/**
 * Calculate next review interval using SM-2 algorithm
 */
function calculateNextReview(quality, previousInterval, easeFactor) {
  let newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEaseFactor = Math.max(MIN_EASE_FACTOR, newEaseFactor);

  let interval;
  if (quality < 3) {
    // Failed - reset to beginning
    interval = 1;
    newEaseFactor = DEFAULT_EASE_FACTOR;
  } else if (previousInterval === 0) {
    interval = 1;
  } else if (previousInterval === 1) {
    interval = 6;
  } else {
    interval = Math.round(previousInterval * newEaseFactor);
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    interval,
    easeFactor: newEaseFactor,
    nextReview: nextReview.toISOString()
  };
}

/**
 * Convert correct/incorrect to SM-2 quality rating
 */
function getQualityFromAnswer(isCorrect, hesitated = false) {
  if (!isCorrect) {
    return 1; // Incorrect but learns from seeing correct
  }
  return hesitated ? 4 : 5; // Perfect or slight hesitation
}

/**
 * Hook for managing spaced repetition scheduling
 */
export function useSpacedRepetition(wineProgress, allWines) {
  // Get wines due for review (sorted by priority)
  const winesDueForReview = useMemo(() => {
    if (!wineProgress || !allWines) return [];

    const now = new Date();
    const dueWines = [];
    const newWines = [];
    const masteredWines = [];

    allWines.forEach(wine => {
      const progress = wineProgress[wine.name];

      if (!progress || (!progress.timesCorrect && !progress.timesIncorrect)) {
        // Never seen - new wine
        newWines.push({ ...wine, priority: 'new' });
      } else if (progress.nextReview) {
        const reviewDate = new Date(progress.nextReview);
        if (reviewDate <= now) {
          // Due for review
          dueWines.push({
            ...wine,
            priority: 'due',
            overdueDays: Math.floor((now - reviewDate) / (1000 * 60 * 60 * 24))
          });
        } else {
          // Mastered (not due yet)
          masteredWines.push({ ...wine, priority: 'mastered' });
        }
      } else {
        // Has been seen but no scheduled review - treat as due
        dueWines.push({ ...wine, priority: 'due', overdueDays: 0 });
      }
    });

    // Sort due wines by how overdue they are
    dueWines.sort((a, b) => (b.overdueDays || 0) - (a.overdueDays || 0));

    // Priority: due for review > new > mastered
    return [...dueWines, ...newWines, ...masteredWines];
  }, [wineProgress, allWines]);

  // Get next wine to study based on spaced repetition
  const getNextWine = useCallback((excludeWines = []) => {
    const available = winesDueForReview.filter(w => !excludeWines.includes(w.name));
    return available[0] || null;
  }, [winesDueForReview]);

  // Calculate updated progress after answering
  const calculateUpdatedProgress = useCallback((wineName, isCorrect, currentProgress) => {
    const progress = currentProgress || {
      timesCorrect: 0,
      timesIncorrect: 0,
      lastSeen: null,
      nextReview: null,
      easeFactor: DEFAULT_EASE_FACTOR,
      interval: 0
    };

    const quality = getQualityFromAnswer(isCorrect);
    const { interval, easeFactor, nextReview } = calculateNextReview(
      quality,
      progress.interval || 0,
      progress.easeFactor || DEFAULT_EASE_FACTOR
    );

    return {
      ...progress,
      timesCorrect: progress.timesCorrect + (isCorrect ? 1 : 0),
      timesIncorrect: progress.timesIncorrect + (isCorrect ? 0 : 1),
      lastSeen: new Date().toISOString(),
      nextReview,
      easeFactor,
      interval
    };
  }, []);

  // Get study statistics
  const getStudyStats = useMemo(() => {
    const due = winesDueForReview.filter(w => w.priority === 'due').length;
    const newCount = winesDueForReview.filter(w => w.priority === 'new').length;
    const mastered = winesDueForReview.filter(w => w.priority === 'mastered').length;

    return {
      dueForReview: due,
      newWines: newCount,
      mastered,
      total: winesDueForReview.length
    };
  }, [winesDueForReview]);

  return {
    winesDueForReview,
    getNextWine,
    calculateUpdatedProgress,
    getStudyStats
  };
}
