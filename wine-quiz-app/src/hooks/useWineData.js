import { useState, useEffect, useCallback } from 'react';

const CACHE_KEY = 'wineDataCache';
const PRONUNCIATION_CACHE_KEY = 'pronunciationCache';

/**
 * Hook for fetching and caching wine data
 */
export function useWineData() {
  const [wineData, setWineData] = useState(null);
  const [pronunciations, setPronunciations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      // Check cache first
      if (!forceRefresh) {
        const cachedWines = localStorage.getItem(CACHE_KEY);
        const cachedPronunciations = localStorage.getItem(PRONUNCIATION_CACHE_KEY);

        if (cachedWines && cachedPronunciations) {
          const winesData = JSON.parse(cachedWines);
          const pronData = JSON.parse(cachedPronunciations);
          setWineData(winesData);
          setPronunciations(pronData.pronunciations);
          setLastUpdated(winesData.lastUpdated);
        }
      }

      // Fetch fresh data
      const [winesResponse, pronunciationsResponse] = await Promise.all([
        fetch('/data/wines.json'),
        fetch('/data/pronunciations.json')
      ]);

      if (!winesResponse.ok || !pronunciationsResponse.ok) {
        throw new Error('Failed to fetch wine data');
      }

      const newWinesData = await winesResponse.json();
      const newPronData = await pronunciationsResponse.json();

      // Update cache
      localStorage.setItem(CACHE_KEY, JSON.stringify(newWinesData));
      localStorage.setItem(PRONUNCIATION_CACHE_KEY, JSON.stringify(newPronData));

      setWineData(newWinesData);
      setPronunciations(newPronData.pronunciations);
      setLastUpdated(newWinesData.lastUpdated);
    } catch (err) {
      // Use cached data if available
      const cachedWines = localStorage.getItem(CACHE_KEY);
      const cachedPronunciations = localStorage.getItem(PRONUNCIATION_CACHE_KEY);

      if (cachedWines && cachedPronunciations) {
        const winesData = JSON.parse(cachedWines);
        const pronData = JSON.parse(cachedPronunciations);
        setWineData(winesData);
        setPronunciations(pronData.pronunciations);
        setLastUpdated(winesData.lastUpdated);
        setError('Using cached data (offline)');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get all wines as a flat array
  const getAllWines = useCallback(() => {
    if (!wineData) return [];
    return wineData.styles.flatMap(style =>
      style.wines.map(wine => ({
        ...wine,
        styleId: style.id,
        styleName: style.name,
        styleColor: style.color,
        styleDescription: style.description
      }))
    );
  }, [wineData]);

  // Get wines by style
  const getWinesByStyle = useCallback((styleId) => {
    if (!wineData) return [];
    const style = wineData.styles.find(s => s.id === styleId);
    return style ? style.wines : [];
  }, [wineData]);

  // Get style by ID
  const getStyle = useCallback((styleId) => {
    if (!wineData) return null;
    return wineData.styles.find(s => s.id === styleId);
  }, [wineData]);

  // Get all styles
  const getAllStyles = useCallback(() => {
    if (!wineData) return [];
    return wineData.styles;
  }, [wineData]);

  // Get pronunciation for a wine
  const getPronunciation = useCallback((wineName) => {
    if (!pronunciations) return null;
    return pronunciations[wineName]?.simple || null;
  }, [pronunciations]);

  // Get all unique origins
  const getAllOrigins = useCallback(() => {
    if (!wineData) return [];
    const origins = new Set();
    wineData.styles.forEach(style => {
      style.wines.forEach(wine => {
        // Handle multi-origin wines like "France/Italy"
        wine.origin.split('/').forEach(o => origins.add(o.trim()));
      });
    });
    return Array.from(origins).sort();
  }, [wineData]);

  return {
    wineData,
    pronunciations,
    loading,
    error,
    lastUpdated,
    refresh: () => fetchData(true),
    getAllWines,
    getWinesByStyle,
    getStyle,
    getAllStyles,
    getPronunciation,
    getAllOrigins
  };
}
