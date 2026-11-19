// ** Type Import
import { OwnerStateThemeType } from './'

const Backdrop = () => {
  return {
    MuiBackdrop: {
      styleOverrides: {
        root: ({ theme }: OwnerStateThemeType) => ({
          backgroundColor:
            theme.palette.mode === 'light' ? `rgba(${theme.palette.customColors.main}, 0.5)` : 'rgba(8, 14, 30, 0.7)'
        }),
        invisible: {
          backgroundColor: 'transparent'
        }
      }
    }
  }
}

export default Backdrop
