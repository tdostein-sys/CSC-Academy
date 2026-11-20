import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { LinkCardArea } from './links';

/** Carte de chiffre cliquable (vue d'ensemble d'administration). */
export function LinkStat({ label, value, hint, alert = false, href }: { label: string; value: string; hint?: string; alert?: boolean; href: string }) {
  return (
    <Card sx={{ height: '100%', ...(alert && { border: 1, borderColor: 'error.main' }) }}>
      <LinkCardArea href={href} sx={{ height: '100%' }}>
        <CardContent sx={{ height: '100%' }}>
          <Typography variant="caption" component="p" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            {label}
          </Typography>
          <Typography variant="h4" component="p" sx={{ mt: 1, fontWeight: 700, color: alert ? 'error.main' : 'text.primary', fontSize: { xs: '1.5rem', sm: '1.875rem' } }}>
            {value}
          </Typography>
          {hint && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {hint}
            </Typography>
          )}
        </CardContent>
      </LinkCardArea>
    </Card>
  );
}
