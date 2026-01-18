import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';

export type AppContextType = {
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppContextProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(false);

  const value = useMemo(() => ({ darkMode, setDarkMode }), [darkMode]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppContextProvider');
  return ctx;
}
