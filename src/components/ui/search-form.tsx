import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { Search } from 'lucide-react';

/** Formulaire de recherche/filtres en GET (fonctionne sans JavaScript). */
export function SearchForm({
  name = 'q',
  defaultValue,
  placeholder,
  label,
  children,
}: {
  name?: string;
  defaultValue?: string;
  placeholder: string;
  label: string;
  /** Champs supplémentaires (filtres, champs cachés). */
  children?: ReactNode;
}) {
  return (
    <Box component="form" role="search" sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
      {children}
      <TextField name={name} defaultValue={defaultValue} placeholder={placeholder} size="small" inputProps={{ 'aria-label': label }} sx={{ flex: 1, minWidth: 200 }} />
      <Button type="submit" variant="outlined" aria-label={label} sx={{ minWidth: 44 }}>
        <Search aria-hidden size={18} />
      </Button>
    </Box>
  );
}
