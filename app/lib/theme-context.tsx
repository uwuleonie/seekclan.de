'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'wine' | 'navy'

type ThemeContextType = {
  theme: Theme
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'light', setTheme: () => {} })

export const THEMES: { id: Theme, label: string, icon: string }[] = [
  { id: 'light', label: 'Hell',     icon: '☀️' },
  { id: 'dark',  label: 'Dunkel',   icon: '🌙' },
  { id: 'wine',  label: 'Weinrot',  icon: '🍷' },
  { id: 'navy',  label: 'Dunkelblau', icon: '🌊' },
]

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved) apply(saved)
  }, [])

  const apply = (t: Theme) => {
    document.documentElement.classList.remove('dark', 'wine', 'navy')
    if (t !== 'light') document.documentElement.classList.add(t)
    setThemeState(t)
    localStorage.setItem('theme', t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: apply }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}