import { useState, useMemo } from 'react';

export function StudyMode({
  wineData,
  pronunciations,
  progress,
  onMarkStudyStatus,
  darkMode
}) {
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [selectedWine, setSelectedWine] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStyles = useMemo(() => {
    if (!wineData || !searchQuery) return wineData?.styles || [];

    const query = searchQuery.toLowerCase();
    return wineData.styles.map(style => ({
      ...style,
      wines: style.wines.filter(wine =>
        wine.name.toLowerCase().includes(query) ||
        wine.origin.toLowerCase().includes(query)
      )
    })).filter(style => style.wines.length > 0);
  }, [wineData, searchQuery]);

  const getWineProgress = (wineName) => {
    return progress.wineProgress[wineName] || {
      timesCorrect: 0,
      timesIncorrect: 0,
      studyStatus: null
    };
  };

  const handleWineClick = (wine, style) => {
    setSelectedWine({
      ...wine,
      styleId: style.id,
      styleName: style.name,
      styleColor: style.color,
      styleDescription: style.description
    });
  };

  if (!wineData) {
    return (
      <div className={`study-mode loading ${darkMode ? 'dark' : ''}`}>
        <p>Loading wine data...</p>
      </div>
    );
  }

  return (
    <div className={`study-mode ${darkMode ? 'dark' : ''}`}>
      <h2>Study Mode</h2>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search wines..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className="clear-search"
            onClick={() => setSearchQuery('')}
          >
            Clear
          </button>
        )}
      </div>

      <div className="study-layout">
        <div className="wine-list">
          {filteredStyles.map(style => (
            <div key={style.id} className="style-group">
              <button
                className={`style-header ${selectedStyle === style.id ? 'expanded' : ''}`}
                onClick={() => setSelectedStyle(selectedStyle === style.id ? null : style.id)}
                style={{ '--style-color': style.color }}
              >
                <span
                  className="style-color-bar"
                  style={{ backgroundColor: style.color }}
                />
                <span className="style-name">{style.name}</span>
                <span className="style-count">{style.wines.length} wines</span>
                <span className="expand-icon">{selectedStyle === style.id ? '-' : '+'}</span>
              </button>

              {(selectedStyle === style.id || searchQuery) && (
                <div className="wines-in-style">
                  {style.wines.map(wine => {
                    const wineProgress = getWineProgress(wine.name);
                    return (
                      <button
                        key={wine.name}
                        className={`wine-item ${selectedWine?.name === wine.name ? 'selected' : ''}`}
                        onClick={() => handleWineClick(wine, style)}
                      >
                        <span className="wine-name">{wine.name}</span>
                        <span className="wine-origin">{wine.origin}</span>
                        {wineProgress.studyStatus && (
                          <span className={`study-status ${wineProgress.studyStatus}`}>
                            {wineProgress.studyStatus === 'known' ? '✓' : '?'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {selectedWine && (
          <div className="wine-detail-card">
            <button
              className="close-detail"
              onClick={() => setSelectedWine(null)}
            >
              Close
            </button>

            <div
              className="wine-header"
              style={{ backgroundColor: selectedWine.styleColor }}
            >
              <h3>{selectedWine.name}</h3>
              <span className="origin">{selectedWine.origin}</span>
            </div>

            <div className="wine-body">
              <div className="detail-row">
                <span className="label">Category</span>
                <span className="value">{selectedWine.styleName}</span>
              </div>

              {pronunciations && pronunciations[selectedWine.name] && (
                <div className="detail-row">
                  <span className="label">Pronunciation</span>
                  <span className="value pronunciation">
                    {pronunciations[selectedWine.name].simple}
                  </span>
                </div>
              )}

              <div className="detail-row full">
                <span className="label">About this style</span>
                <p className="value description">{selectedWine.styleDescription}</p>
              </div>

              <div className="progress-info">
                <div className="progress-stat">
                  <span className="stat-value">{getWineProgress(selectedWine.name).timesCorrect}</span>
                  <span className="stat-label">Correct</span>
                </div>
                <div className="progress-stat">
                  <span className="stat-value">{getWineProgress(selectedWine.name).timesIncorrect}</span>
                  <span className="stat-label">Incorrect</span>
                </div>
              </div>

              <div className="study-actions">
                <button
                  className={`study-btn known ${getWineProgress(selectedWine.name).studyStatus === 'known' ? 'active' : ''}`}
                  onClick={() => onMarkStudyStatus(selectedWine.name, 'known')}
                >
                  I know this
                </button>
                <button
                  className={`study-btn needs-study ${getWineProgress(selectedWine.name).studyStatus === 'needs-study' ? 'active' : ''}`}
                  onClick={() => onMarkStudyStatus(selectedWine.name, 'needs-study')}
                >
                  Need to study
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
