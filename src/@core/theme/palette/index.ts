// ** Type Imports
import { Palette } from '@mui/material'
import { Settings } from '@/@core/theme/settings'
import { tokens } from '@/@core/theme/tokens'

/**
 * Palette Sneat aux couleurs CSC (voir tokens.ts). Les couleurs de texte sont
 * opaques pour garantir le contraste mesuré par les tests.
 */
const DefaultPalette = (mode: Palette['mode'], settings: Settings): Palette => {
  const c = tokens[mode === 'dark' ? 'dark' : 'light']
  const whiteColor = '#FFF'
  const lightColor = '22, 33, 58'
  const darkColor = '230, 236, 247'
  const mainColor = mode === 'light' ? lightColor : darkColor
  const bordered = settings.skin === 'bordered'

  return {
    // Ne pas ajouter de clé `light` ici : l'Alert MUI la passerait à darken()
    // et planterait sur le triplet RGB de `main` (« Unsupported `22, 33, 58` color »).
    customColors: {
      main: mainColor,
      lightPaperBg: tokens.light.bg,
      darkPaperBg: tokens.dark.bg,
      collapseTogglerBg: c.surface,
      bodyBg: c.surface,
      trackBg: c['surface-2'],
      avatarBg: c['surface-2'],
      tableHeaderBg: c['surface-2'],
      tooltipBg: mode === 'light' ? '#262732' : '#464A65'
    },
    mode: mode,
    common: {
      black: '#000',
      white: whiteColor
    },
    primary: {
      light: c['primary-soft'],
      main: c.primary,
      dark: c['primary-hover'],
      contrastText: c['primary-fg']
    },
    secondary: {
      light: c['surface-2'],
      main: c.muted,
      dark: c.text,
      contrastText: c.bg
    },
    error: {
      light: c['error-soft'],
      main: c.error,
      dark: c.error,
      contrastText: c['on-status']
    },
    warning: {
      light: c['warning-soft'],
      main: c.warning,
      dark: c.warning,
      contrastText: c['on-status']
    },
    info: {
      light: c['info-soft'],
      main: c.info,
      dark: c.info,
      contrastText: c['on-status']
    },
    success: {
      light: c['success-soft'],
      main: c.success,
      dark: c.success,
      contrastText: c['on-status']
    },
    grey: {
      50: '#FAFAFA',
      100: '#F5F5F5',
      200: '#EEEEEE',
      300: '#E0E0E0',
      400: '#BDBDBD',
      500: '#9E9E9E',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
      A100: '#F5F5F5',
      A200: '#EEEEEE',
      A400: '#BDBDBD',
      A700: '#616161'
    },
    text: {
      primary: c.text,
      secondary: c.muted,
      disabled: `rgba(${mainColor}, 0.38)`
    },
    divider: c.border,
    background: {
      paper: c.bg,
      default: bordered ? c.bg : c.surface
    },
    action: {
      active: `rgba(${mainColor}, 0.54)`,
      hover: `rgba(${mainColor}, 0.04)`,
      selected: `rgba(${mainColor}, 0.08)`,
      disabled: `rgba(${mainColor}, 0.26)`,
      disabledBackground: `rgba(${mainColor}, 0.12)`,
      focus: `rgba(${mainColor}, 0.12)`
    }
  } as Palette
}

export default DefaultPalette
