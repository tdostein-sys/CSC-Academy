import type { ReactNode } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableContainer from '@mui/material/TableContainer';

/** Tableau dans une carte (style des tableaux Sneat), défilement horizontal sur mobile. */
export function TableCard({ head, children, title, action }: { head: ReactNode[]; children: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <Card>
      {title && <CardHeader title={title} action={action} titleTypographyProps={{ variant: 'h6', component: 'h2' }} />}
      <TableContainer>
        <Table size="small" sx={{ '& td, & th': { verticalAlign: 'top', py: 2.5 } }}>
          <TableHead>
            <TableRow>
              {head.map((h, i) => (
                <TableCell key={i} sx={{ whiteSpace: 'nowrap' }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>{children}</TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

/** Carte « aucun élément ». */
export function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardContent>
        <Typography sx={{ color: 'text.secondary' }}>{children}</Typography>
      </CardContent>
    </Card>
  );
}

export { TableRow, TableCell };
