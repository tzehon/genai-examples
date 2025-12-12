/**
 * Calculate mastery percentage for a wine or category
 * @param {number} correct - Number of correct answers
 * @param {number} incorrect - Number of incorrect answers
 * @returns {number} - Mastery percentage (0-100)
 */
export function calculateMastery(correct, incorrect) {
  const total = correct + incorrect;
  if (total === 0) return 0;

  // Weight recent performance more heavily
  // At least 5 attempts needed for meaningful mastery
  const minAttempts = 5;
  const confidence = Math.min(1, total / minAttempts);
  const accuracy = correct / total;

  return Math.round(accuracy * confidence * 100);
}

/**
 * Calculate overall mastery across all wines
 * @param {Object} wineProgress - Progress data for all wines
 * @returns {number} - Overall mastery percentage
 */
export function calculateOverallMastery(wineProgress) {
  if (!wineProgress || Object.keys(wineProgress).length === 0) {
    return 0;
  }

  let totalCorrect = 0;
  let totalIncorrect = 0;

  Object.values(wineProgress).forEach(progress => {
    totalCorrect += progress.timesCorrect || 0;
    totalIncorrect += progress.timesIncorrect || 0;
  });

  return calculateMastery(totalCorrect, totalIncorrect);
}

/**
 * Calculate category mastery
 * @param {Object} categoryProgress - Progress data for a category
 * @returns {number} - Category mastery percentage
 */
export function calculateCategoryMastery(categoryProgress) {
  if (!categoryProgress) return 0;
  return calculateMastery(
    categoryProgress.timesCorrect || 0,
    categoryProgress.timesIncorrect || 0
  );
}

/**
 * Get mastery level label
 * @param {number} mastery - Mastery percentage
 * @returns {string} - Level label
 */
export function getMasteryLevel(mastery) {
  if (mastery >= 90) return 'Master';
  if (mastery >= 70) return 'Proficient';
  if (mastery >= 50) return 'Learning';
  if (mastery >= 25) return 'Beginner';
  return 'New';
}

/**
 * Get wines that need review (due for spaced repetition)
 * @param {Object} wineProgress - Progress data for all wines
 * @returns {string[]} - Array of wine names due for review
 */
export function getWinesDueForReview(wineProgress) {
  if (!wineProgress) return [];

  const now = new Date();
  const dueWines = [];

  Object.entries(wineProgress).forEach(([wineName, progress]) => {
    if (progress.nextReview) {
      const reviewDate = new Date(progress.nextReview);
      if (reviewDate <= now) {
        dueWines.push(wineName);
      }
    }
  });

  return dueWines;
}

/**
 * Count wines learned (answered correctly at least once)
 * @param {Object} wineProgress - Progress data for all wines
 * @returns {number} - Number of wines learned
 */
export function countWinesLearned(wineProgress) {
  if (!wineProgress) return 0;
  return Object.values(wineProgress).filter(p => p.timesCorrect > 0).length;
}
