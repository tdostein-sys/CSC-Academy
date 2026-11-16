import Image from 'next/image';
import Link from 'next/link';

/**
 * Logo CSC. Le texte du logo est noir : en thème sombre, il est posé sur un
 * badge clair pour rester lisible.
 */
export function Logo({ size = 40, href = '/' }: { size?: number; href?: string }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center rounded-md dark:bg-white dark:px-1.5 dark:py-0.5" aria-label="CSC — Crypto Sans Complexe">
      <Image src="/logo-csc.png" alt="CSC" width={size * 2} height={size} priority className="h-auto" style={{ width: size * 2 }} />
    </Link>
  );
}
