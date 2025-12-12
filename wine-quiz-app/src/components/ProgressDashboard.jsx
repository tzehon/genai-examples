import { useMemo } from 'react';
import {
  calculateOverallMastery,
  calculateCategoryMastery,
  getMasteryLevel,
  getWinesDueForReview,
  countWinesLearned
} from '../utils/calculateMastery';

export function ProgressDashboard({ progress, wineData, darkMode }) {
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
      currentStreak: progress.streakData.currentStreak,
      longestStreak: progress.streakData.longestStreak,
      totalQuizzes: progress.stats.totalQuizzes,
      totalQuestions: progress.stats.totalQuestions
    };
  }, [progress, wineData]);

  const categoryStats = useMemo(() => {
    if (!wineData) return [];

    return wineData.styles.map(style => {
      const categoryProgress = progress.categoryProgress[style.id];
      const mastery = calculateCategoryMastery(categoryProgress);
      const winesInCategory = style.wines.length;
      const winesLearnedInCategory = style.wines.filter(
        w => progress.wineProgress[w.name]?.timesCorrect > 0
      ).length;

      return {
        id: style.id,
        name: style.name,
        color: style.color,
        mastery,
        winesLearned: winesLearnedInCategory,
        totalWines: winesInCategory,
        timesCorrect: categoryProgress?.timesCorrect || 0,
        timesIncorrect: categoryProgress?.timesIncorrect || 0
      };
    });
  }, [progress, wineData]);

  // Generate streak calendar for last 30 days
  const streakCalendar = useMemo(() => {
    const days = [];
    const today = new Date();
    const lastQuizDate = progress.streakData.lastQuizDate
      ? new Date(progress.streakData.lastQuizDate)
      : null;

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Check if this day was active (simplified - only tracks last quiz date)
      const isActive = lastQuizDate &&
        dateStr === lastQuizDate.toISOString().split('T')[0];

      days.push({
        date: dateStr,
        day: date.getDate(),
        isActive,
        isToday: i === 0
      });
    }

    return days;
  }, [progress.streakData.lastQuizDate]);

  return (
    <div className={`progress-dashboard ${darkMode ? 'dark' : ''}`}>
      <h2>Your Progress</h2>

      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-value">{stats.overallMastery}%</div>
          <div className="stat-label">Overall Mastery</div>
          <div className="stat-sublabel">{stats.masteryLevel}</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{stats.winesLearned}/{stats.totalWines}</div>
          <div className="stat-label">Wines Learned</div>
        </div>

        <div className="stat-card streak">
          <div className="stat-value">{stats.currentStreak}</div>
          <div className="stat-label">Day Streak</div>
          <div className="stat-sublabel">Best: {stats.longestStreak}</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{stats.winesDueForReview}</div>
          <div className="stat-label">Due for Review</div>
        </div>
      </div>

      <section className="progress-section">
        <h3>Category Mastery</h3>
        <div className="category-progress-list">
          {categoryStats.map(category => (
            <div key={category.id} className="category-progress-item">
              <div className="category-header">
                <span
                  className="category-dot"
                  style={{ backgroundColor: category.color }}
                />
                <span className="category-name">{category.name}</span>
                <span className="category-stats">
                  {category.winesLearned}/{category.totalWines} wines
                </span>
              </div>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${category.mastery}%`,
                    backgroundColor: category.color
                  }}
                />
              </div>
              <div className="category-footer">
                <span className="mastery-percent">{category.mastery}%</span>
                <span className="answer-stats">
                  {category.timesCorrect} correct / {category.timesIncorrect} incorrect
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="progress-section">
        <h3>Activity Calendar</h3>
        <div className="streak-calendar">
          {streakCalendar.map(day => (
            <div
              key={day.date}
              className={`calendar-day ${day.isActive ? 'active' : ''} ${day.isToday ? 'today' : ''}`}
              title={day.date}
            >
              {day.day}
            </div>
          ))}
        </div>
      </section>

      <section className="progress-section">
        <h3>Quiz Statistics</h3>
        <div className="quiz-stats">
          <div className="quiz-stat">
            <span className="quiz-stat-value">{stats.totalQuizzes}</span>
            <span className="quiz-stat-label">Total Quizzes</span>
          </div>
          <div className="quiz-stat">
            <span className="quiz-stat-value">{stats.totalQuestions}</span>
            <span className="quiz-stat-label">Questions Answered</span>
          </div>
          <div className="quiz-stat">
            <span className="quiz-stat-value">
              {stats.totalQuestions > 0
                ? Math.round((Object.values(progress.wineProgress)
                    .reduce((acc, p) => acc + (p.timesCorrect || 0), 0) /
                    stats.totalQuestions) * 100)
                : 0}%
            </span>
            <span className="quiz-stat-label">Accuracy</span>
          </div>
        </div>
      </section>
    </div>
  );
}
