// Surcharges « Premium FinTech » (refonte UI), appliquées APRÈS celles du
// modèle Sneat : elles les remplacent clé par clé.
//
//  - boutons en casse normale, sans ombre, 44 px (40 px en small) ;
//  - cartes et papiers à plat : bordure 1 px, rayon 16, aucune ombre ;
//  - pastilles 24 px, casse normale ;
//  - champs : rayon 10, bordure d'erreur 1,5 px, aide toujours visible ;
//  - tableaux : en-têtes 12 px / 600 en text.secondary, lignes séparées ;
//  - barre d'application opaque, sans ombre, bordure basse ;
//  - zones tactiles d'au moins 44 px.
import type { Theme } from '@mui/material/styles'

type Ctx = { theme: Theme; ownerState: Record<string, unknown> }

const Csc = () => ({
  MuiButtonBase: {
    defaultProps: { disableRipple: true }
  },
  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: ({ theme }: Ctx) => ({
        textTransform: 'none' as const,
        fontWeight: 600,
        letterSpacing: 0,
        lineHeight: 1.4,
        minHeight: 44,
        borderRadius: 10,
        boxShadow: 'none',
        transition: theme.transitions.create(['background-color', 'border-color', 'color'], { duration: 150, easing: 'ease-out' }),
        '&:hover': { boxShadow: 'none', transform: 'none' }
      }),
      contained: ({ theme }: Ctx) => ({ boxShadow: 'none', padding: theme.spacing(2.5, 5) }),
      containedPrimary: { '&:not(.Mui-disabled)': { boxShadow: 'none' } },
      containedSecondary: { '&:not(.Mui-disabled)': { boxShadow: 'none' } },
      containedSuccess: { '&:not(.Mui-disabled)': { boxShadow: 'none' } },
      containedError: { '&:not(.Mui-disabled)': { boxShadow: 'none' } },
      containedWarning: { '&:not(.Mui-disabled)': { boxShadow: 'none' } },
      containedInfo: { '&:not(.Mui-disabled)': { boxShadow: 'none' } },
      outlined: ({ theme }: Ctx) => ({ padding: theme.spacing(2.25, 4.75), borderColor: theme.palette.divider }),
      outlinedPrimary: ({ theme }: Ctx) => ({ borderColor: theme.palette.divider, color: theme.palette.text.primary, '&:hover': { borderColor: theme.palette.primary.main, backgroundColor: theme.palette.primary.light } }),
      text: ({ theme }: Ctx) => ({ padding: theme.spacing(2.25, 3) }),
      sizeSmall: ({ theme }: Ctx) => ({ minHeight: 40, borderRadius: 10, padding: theme.spacing(1.5, 3.5), fontSize: '0.8125rem' }),
      sizeLarge: ({ theme }: Ctx) => ({ minHeight: 48, borderRadius: 10, padding: theme.spacing(3, 6), fontSize: '0.9375rem' })
    }
  },
  MuiIconButton: {
    styleOverrides: {
      root: { borderRadius: 10 },
      sizeMedium: { minWidth: 44, minHeight: 44 }
    }
  },
  MuiPaper: {
    defaultProps: { elevation: 0 },
    styleOverrides: {
      root: { backgroundImage: 'none' },
      elevation: { boxShadow: 'none' },
      rounded: { borderRadius: 16 }
    }
  },
  MuiCard: {
    defaultProps: { elevation: 0 },
    styleOverrides: {
      root: ({ theme }: Ctx) => ({
        borderRadius: 16,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: 'none',
        backgroundImage: 'none'
      })
    }
  },
  MuiCardHeader: {
    styleOverrides: {
      title: {
        fontWeight: 600,
        fontSize: '1.0625rem',
        lineHeight: 1.4,
        letterSpacing: 0
      }
    }
  },
  // Menus, listes déroulantes, info-bulles flottantes : seule surface autorisée à porter une ombre légère.
  MuiPopover: {
    styleOverrides: {
      paper: ({ theme }: Ctx) => ({
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.palette.mode === 'dark' ? '0 8px 24px rgba(0, 0, 0, 0.45)' : '0 8px 24px rgba(11, 21, 38, 0.08)'
      })
    }
  },
  MuiDialog: {
    styleOverrides: {
      paper: ({ theme }: Ctx) => ({ borderRadius: 16, border: `1px solid ${theme.palette.divider}`, boxShadow: '0 16px 48px rgba(11, 21, 38, 0.18)' })
    }
  },
  MuiChip: {
    styleOverrides: {
      root: { height: 24, fontWeight: 600, fontSize: '0.75rem', borderRadius: 999 },
      sizeSmall: { height: 22 },
      label: ({ theme }: Ctx) => ({ textTransform: 'none' as const, padding: theme.spacing(0, 2.5) })
    }
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }: Ctx) => ({
        borderRadius: 10,
        backgroundColor: theme.palette.background.paper,
        '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
        '&:hover:not(.Mui-disabled):not(.Mui-error) .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.text.secondary },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.primary.main, borderWidth: 1.5 },
        '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.error.main, borderWidth: 1.5 }
      }),
      input: { minHeight: 24 },
      // Le libellé est AU-DESSUS du champ : aucune encoche dans la bordure.
      notchedOutline: { '& legend': { display: 'none' }, top: 0 }
    }
  },
  MuiFormHelperText: {
    styleOverrides: {
      root: ({ theme }: Ctx) => ({ marginLeft: 0, marginRight: 0, marginTop: theme.spacing(1), fontSize: '0.8125rem', lineHeight: 1.45 })
    }
  },
  MuiTableHead: {
    styleOverrides: {
      root: { textTransform: 'none' as const, '& .MuiTableCell-head': { fontSize: '0.75rem', letterSpacing: 0 } }
    }
  },
  MuiListSubheader: {
    styleOverrides: {
      root: { textTransform: 'none' as const }
    }
  },
  MuiTableCell: {
    styleOverrides: {
      root: ({ theme }: Ctx) => ({ borderBottom: `1px solid ${theme.palette.divider}`, fontSize: '0.875rem' }),
      head: ({ theme }: Ctx) => ({
        fontSize: '0.75rem',
        fontWeight: 600,
        color: theme.palette.text.secondary,
        textTransform: 'none' as const,
        letterSpacing: 0,
        backgroundColor: 'transparent'
      })
    }
  },
  MuiAppBar: {
    defaultProps: { elevation: 0, color: 'inherit' as const },
    styleOverrides: {
      root: ({ theme }: Ctx) => ({
        backgroundColor: theme.palette.background.paper,
        backgroundImage: 'none',
        boxShadow: 'none',
        borderBottom: `1px solid ${theme.palette.divider}`
      })
    }
  },
  MuiTab: {
    styleOverrides: {
      root: ({ theme }: Ctx) => ({
        textTransform: 'none' as const,
        fontWeight: 600,
        fontSize: '0.875rem',
        minHeight: 44,
        letterSpacing: 0,
        color: theme.palette.text.secondary,
        transition: theme.transitions.create(['color'], { duration: 150, easing: 'ease-out' })
      })
    }
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: { fontSize: '0.8125rem', fontWeight: 500, borderRadius: 8 }
    }
  },
  MuiAlert: {
    styleOverrides: {
      root: { borderRadius: 12 }
    }
  },
  MuiLinearProgress: {
    styleOverrides: {
      root: { borderRadius: 999 }
    }
  }
})

export default Csc
