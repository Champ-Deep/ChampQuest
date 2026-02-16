import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { THEMES, applyTheme, getRankData, getSprite, getCompanionQuote } from '../utils/themes';
import { API } from '../utils/api';
import { useAuth } from './AuthContext';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [activeTheme, setActiveTheme] = useState(THEMES.pokemon);

  useEffect(() => {
    const themeId = user?.themePreference || 'pokemon';
    const theme = applyTheme(themeId);
    setActiveTheme(theme);
  }, [user?.themePreference]);

  const changeTheme = useCallback(async (themeId) => {
    const theme = applyTheme(themeId);
    setActiveTheme(theme);
    try { await API.setTheme(themeId); } catch (e) { /* ignore */ }
  }, []);

  const getTerminology = useCallback((key) => {
    return activeTheme.terminology[key] || key;
  }, [activeTheme]);

  const getRank = useCallback((xp) => {
    return getRankData(activeTheme, xp);
  }, [activeTheme]);

  const getSpriteData = useCallback((rank) => {
    return getSprite(activeTheme, rank);
  }, [activeTheme]);

  const getQuote = useCallback((level) => {
    return getCompanionQuote(activeTheme, level);
  }, [activeTheme]);

  return (
    <ThemeContext.Provider value={{
      activeTheme, changeTheme, getTerminology,
      getRank, getSpriteData, getQuote, themes: THEMES,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
