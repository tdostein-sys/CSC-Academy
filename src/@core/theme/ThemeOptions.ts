// ** MUI Theme Provider
import { deepmerge } from '@mui/utils'
import { ThemeOptions } from '@mui/material'

// ** Type Import
import { Settings } from '@/@core/theme/settings'

// ** Theme Override Imports
import palette from './palette'
import spacing from './spacing'
import shadows from './shadows'
import overrides from './overrides'
import cscOverrides from './overrides/csc'
import typography from './typography'
import breakpoints from './breakpoints'

/**
 * Thème unique (clair / sombre). Les surcharges Sneat sont complétées puis
 * remplacées, clé par clé, par les surcharges de la refonte (overrides/csc.ts).
 */
const themeOptions = (settings: Settings): ThemeOptions => {
  const { mode, direction } = settings

  return {
    breakpoints: breakpoints(),
    direction,
    components: deepmerge(overrides(settings), cscOverrides(), { clone: true }) as ThemeOptions['components'],
    palette: palette(mode, settings),
    ...spacing,
    // Boutons et champs : 10 px ; les cartes ont leur propre rayon (16 px).
    shape: {
      borderRadius: 10
    },
    mixins: {
      toolbar: {
        minHeight: 64
      }
    },
    shadows: shadows(mode),
    typography
  }
}

export default themeOptions
