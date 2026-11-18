declare module '@mui/material/styles' {
  interface Palette {
    // Pas de clés `light` / `dark` : l'Alert MUI traite toute entrée de palette
    // ayant `main` + `light` comme une couleur, et `main` est ici un triplet RGB brut.
    customColors: {
      main: string
      bodyBg: string
      trackBg: string
      avatarBg: string
      tooltipBg: string
      darkPaperBg: string
      lightPaperBg: string
      tableHeaderBg: string
      collapseTogglerBg: string
    }
  }
  interface PaletteOptions {
    customColors?: {
      main?: string
      bodyBg?: string
      trackBg?: string
      avatarBg?: string
      tooltipBg: string
      darkPaperBg?: string
      lightPaperBg?: string
      tableHeaderBg?: string
      collapseTogglerBg?: string
    }
  }
}

export {}
