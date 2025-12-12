import { useMemo } from 'react';
import {
  calculateOverallMastery,
  getMasteryLevel,
  countWinesLearned,
  getWinesDueForReview
} from '../utils/calculateMastery';

export function Home({
  progress,
  wineData,
  onStartQuiz,
  onNavigate,
  darkMode
}) {
  const stats = useMemo(() => {
    const winesLearned = countWinesLearned(progress.wineProgress);
    const totalWines = wineData?.styles.reduce((acc, s) => acc + s.wines.length, 0) || 0;
    const overallMastery = calculateOverallMastery(progress.wineProgress);
    const winesDue = getWinesDueForReview(progress.wineProgress);

    return {
      winesLearned,
      totalWines,
      overallMastery,
      masteryLevel: getMasteryLevel(overallMastery),
      winesDueForReview: winesDue.length,
      currentStreak: progress.streakData.currentStreak
    };
  }, [progress, wineData]);

  return (
    <div className={`home ${darkMode ? 'dark' : ''}`}>
      <div className="hero">
        <div className="hero-icon">🍷</div>
        <h1>Wine Quiz</h1>
        <p>Master wine categories and varietals</p>
      </div>

      <div className="quick-stats">
        <div className="stat-item">
          <span className="stat-value">{stats.overallMastery}%</span>
          <span className="stat-label">Mastery</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.winesLearned}</span>
          <span className="stat-label">Wines Learned</span>
        </div>
        <div className="stat-item streak">
          <span className="stat-value">{stats.currentStreak}</span>
          <span className="stat-label">Day Streak</span>
        </div>
      </div>

      <div className="action-buttons">
        <button className="primary-btn" onClick={onStartQuiz}>
          <span className="btn-icon">🎯</span>
          <span className="btn-text">Start Quiz</span>
        </button>

        <button className="secondary-btn" onClick={() => onNavigate('study')}>
          <span className="btn-icon">📚</span>
          <span className="btn-text">Study Mode</span>
        </button>

        <button className="secondary-btn" onClick={() => onNavigate('progress')}>
          <span className="btn-icon">📊</span>
          <span className="btn-text">View Progress</span>
        </button>
      </div>

      {stats.winesDueForReview > 0 && (
        <div className="review-reminder">
          <span className="reminder-icon">📝</span>
          <span>{stats.winesDueForReview} wines due for review</span>
        </div>
      )}

      <div className="tip-of-day">
        <h3>Wine Categories</h3>
        <p>Wines are grouped by body and color: sparkling, light/full-bodied whites, aromatic whites, rosé, and light/medium-bodied reds. Each style has distinct characteristics!</p>
      </div>
    </div>
  );
}
