import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';

/**
 * Squelettes de chargement : ils reprennent la forme de la page attendue et
 * s'affichent immédiatement après un clic (loading.tsx), pendant que le
 * serveur prépare la page. Purement visuels : annoncés une seule fois aux
 * lecteurs d'écran (« Chargement… »).
 */
type Variant = 'list' | 'detail' | 'dashboard' | 'feed';

function Block({ height = 160 }: { height?: number }) {
  return (
    <Card sx={{ p: 5 }}>
      <Skeleton variant="text" width="40%" height={28} />
      <Skeleton variant="text" width="85%" />
      <Skeleton variant="text" width="70%" />
      <Skeleton variant="rounded" height={height - 90} sx={{ mt: 3, borderRadius: '10px' }} />
    </Card>
  );
}

export function PageSkeleton({ variant = 'list', label = 'Chargement…' }: { variant?: Variant; label?: string }) {
  return (
    <Box role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {variant === 'detail' && <Skeleton variant="text" width={260} height={22} sx={{ mb: 2 }} />}
      {(variant === 'detail' || variant === 'feed') && <Skeleton variant="rounded" width={90} height={24} sx={{ mb: 2, borderRadius: 999 }} />}
      <Skeleton variant="text" width="55%" height={40} />
      <Skeleton variant="text" width="35%" height={22} sx={{ mb: 6 }} />

      {variant === 'dashboard' && (
        <>
          <Skeleton variant="rounded" height={88} sx={{ mb: 6, borderRadius: '16px' }} />
          <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', mb: 6 }}>
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} sx={{ p: 5 }}>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="50%" height={44} />
                <Skeleton variant="text" width="80%" />
              </Card>
            ))}
          </Box>
          <Box sx={{ display: 'grid', gap: 6, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' } }}>
            <Block height={320} />
            <Block height={320} />
          </Box>
        </>
      )}

      {variant === 'detail' && (
        <Box sx={{ display: 'grid', gap: 6, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' } }}>
          <Box sx={{ display: 'grid', gap: 6 }}>
            <Block height={240} />
            <Block height={200} />
          </Box>
          <Box sx={{ display: 'grid', gap: 6, alignContent: 'start' }}>
            <Block height={200} />
          </Box>
        </Box>
      )}

      {variant === 'list' && (
        <Box sx={{ display: 'grid', gap: 6, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Block key={i} height={180} />
          ))}
        </Box>
      )}

      {variant === 'feed' && (
        <Box sx={{ display: 'grid', gap: 3 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Card key={i} sx={{ p: 4, display: 'flex', gap: 3, alignItems: 'center' }}>
              <Skeleton variant="circular" width={36} height={36} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="50%" />
                <Skeleton variant="text" width="80%" />
              </Box>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}
