/**
 * Réglages du thème Sneat réduits à ce qu'utilise CSC.
 * (Le panneau « customizer » du template n'est pas repris.)
 */
export type Mode = 'light' | 'dark'
export type Skin = 'default' | 'bordered'
export type ThemeColor = 'primary'

export interface Settings {
  mode: Mode
  skin: Skin
  direction: 'ltr'
  themeColor: ThemeColor
}

export const defaultSettings: Omit<Settings, 'mode'> = {
  skin: 'default',
  direction: 'ltr',
  themeColor: 'primary'
}
