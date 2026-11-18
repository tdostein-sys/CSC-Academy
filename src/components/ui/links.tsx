'use client';

import Link from 'next/link';
import Button, { type ButtonProps } from '@mui/material/Button';
import MuiLink, { type LinkProps as MuiLinkProps } from '@mui/material/Link';
import CardActionArea, { type CardActionAreaProps } from '@mui/material/CardActionArea';

/*
 * Composants MUI rendus comme des liens Next.js. Ils sont déclarés ici (côté
 * client) car une page serveur ne peut pas transmettre `component={Link}`.
 */

export function LinkButton({ href, ...props }: Omit<ButtonProps, 'href'> & { href: string; target?: string }) {
  return <Button component={Link} href={href} {...props} />;
}

export function TextLink({ href, ...props }: Omit<MuiLinkProps, 'href'> & { href: string }) {
  return <MuiLink component={Link} href={href} {...props} />;
}

export function LinkCardArea({ href, ...props }: Omit<CardActionAreaProps, 'href'> & { href: string }) {
  return <CardActionArea component={Link} href={href} {...props} />;
}
