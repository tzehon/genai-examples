import { useState } from 'react';

const quizModes = [
  {
    id: 'category-match',
    name: 'Category Match',
    description: 'Match wines to their style category',
    icon: '🏷️'
  },
  {
    id: 'wine-selection',
    name: 'Wine Selection',
    description: 'Select all wines in a category',
    icon: '☑️'
  },
  {
    id: 'quick-fire',
    name: 'Quick Fire',
    description: 'Rapid yes/no questions with timer',
    icon: '⚡'
  },
  {
    id: 'description-match',
    name: 'Description Match',
    description: 'Match descriptions to categories',
    icon: '📝'
  },
  {
    id: 'odd-one-out',
    name: 'Odd One Out',
    description: 'Find the wine that doesn\'t belong',
    icon: '🔍'
  },
  {
    id: 'origin-match',
    name: 'Origin Match',
    description: 'Match wines to their country',
    icon: '🌍'
  }
];

const questionCounts = [5, 10, 15, 20];

export function QuizModeSelector({
  enabledModes,
  selectedModes,
  onModesChange,
  categories,
  selectedCategories,
  onCategoriesChange,
  questionCount,
  onQuestionCountChange,
  onStartQuiz,
  darkMode
}) {
  const [selectAll, setSelectAll] = useState(selectedModes.length === enabledModes.length);

  const handleModeToggle = (modeId) => {
    if (selectedModes.includes(modeId)) {
      onModesChange(selectedModes.filter(m => m !== modeId));
    } else {
      onModesChange([...selectedModes, modeId]);
    }
  };

  const handleSelectAllModes = () => {
    if (selectAll) {
      onModesChange([]);
    } else {
      onModesChange([...enabledModes]);
    }
    setSelectAll(!selectAll);
  };

  const handleCategoryToggle = (categoryId) => {
    if (selectedCategories.includes(categoryId)) {
      onCategoriesChange(selectedCategories.filter(c => c !== categoryId));
    } else {
      onCategoriesChange([...selectedCategories, categoryId]);
    }
  };

  const handleSelectAllCategories = () => {
    if (selectedCategories.length === categories.length) {
      onCategoriesChange([]);
    } else {
      onCategoriesChange(categories.map(c => c.id));
    }
  };

  const canStart = selectedModes.length > 0 && selectedCategories.length > 0;

  return (
    <div className={`quiz-mode-selector ${darkMode ? 'dark' : ''}`}>
      <h2>Configure Your Quiz</h2>

      <section className="selector-section">
        <div className="section-header">
          <h3>Quiz Modes</h3>
          <button
            className="select-all-btn"
            onClick={handleSelectAllModes}
          >
            {selectAll ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <div className="mode-grid">
          {quizModes
            .filter(mode => enabledModes.includes(mode.id))
            .map(mode => (
              <button
                key={mode.id}
                className={`mode-card ${selectedModes.includes(mode.id) ? 'selected' : ''}`}
                onClick={() => handleModeToggle(mode.id)}
              >
                <span className="mode-icon">{mode.icon}</span>
                <span className="mode-name">{mode.name}</span>
                <span className="mode-desc">{mode.description}</span>
              </button>
            ))}
        </div>
      </section>

      <section className="selector-section">
        <div className="section-header">
          <h3>Focus Categories</h3>
          <button
            className="select-all-btn"
            onClick={handleSelectAllCategories}
          >
            {selectedCategories.length === categories.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <div className="category-grid">
          {categories.map(category => (
            <button
              key={category.id}
              className={`category-chip ${selectedCategories.includes(category.id) ? 'selected' : ''}`}
              onClick={() => handleCategoryToggle(category.id)}
              style={{
                '--category-color': category.color,
                backgroundColor: selectedCategories.includes(category.id) ? category.color : 'transparent'
              }}
            >
              {category.name}
            </button>
          ))}
        </div>
      </section>

      <section className="selector-section">
        <h3>Questions</h3>
        <div className="question-count-selector">
          {questionCounts.map(count => (
            <button
              key={count}
              className={`count-btn ${questionCount === count ? 'selected' : ''}`}
              onClick={() => onQuestionCountChange(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </section>

      <button
        className="start-quiz-btn"
        onClick={onStartQuiz}
        disabled={!canStart}
      >
        Start Quiz
      </button>
    </div>
  );
}
