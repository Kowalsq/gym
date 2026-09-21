export type Theme = 'dark' | 'light'

const KEY = 'ferro:theme'

export function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function saveTheme(t: Theme): void {
  try {
    localStorage.setItem(KEY, t)
  } catch {
    /* sem storage, segue só na sessão */
  }
}

export function applyTheme(t: Theme): void {
  document.documentElement.dataset.theme = t
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', t === 'light' ? '#EEF0F3' : '#141619')
}
