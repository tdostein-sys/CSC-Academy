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
import typography from './typography'
import breakpoints from './breakpoints'

const themeOptions = (settings: Settings): ThemeOptions => {
  const { mode, direction } = settings

  return deepmerge(
    {
      breakpoints: breakpoints(),
      direction,
      components: overrides(settings),
      palette: palette(mode, settings),
      ...spacing,
      shape: {
        borderRadius: 6
      },
      mixins: {
        toolbar: {
          minHeight: 64
        }
      },
      shadows: shadows(mode),
      typography
    },
    {}
  )
}

export default themeOptions
