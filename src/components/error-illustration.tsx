'use client';

import { useTheme } from '@mui/material/styles';
import { tok } from '@/@core/theme/tokens';

/**
 * Illustration de la page d'erreur : personne assise, découragée, devant un
 * ordinateur portable affichant un triangle d'alerte. Vectorielle (nette sur
 * tous les écrans, très légère) et aux couleurs du thème clair / sombre.
 * Purement décorative : masquée aux lecteurs d'écran.
 */
export function ErrorIllustration({ width = 520 }: { width?: number }) {
  const theme = useTheme();
  const c = tok(theme);
  const dark = theme.palette.mode === 'dark';

  const blue = c.primary;
  const blueDeep = dark ? '#4a82e6' : '#1d5fd6';
  const sweater = dark ? '#5b93f2' : '#3b7be0';
  const pants = dark ? '#40568f' : '#1e2f5c';
  const frame = dark ? '#7a8fbc' : '#5b6f99';
  const screen = dark ? '#26396a' : '#eef3fc';
  const blob = dark ? '#1f3157' : '#e6edf9';
  const gear = dark ? '#40557f' : '#c9d6ee';
  const skin = '#8b5a3c';
  const hair = '#1b1b26';
  const shoe = dark ? '#eef3fc' : '#ffffff';
  const potColor = dark ? '#6680b8' : '#8fa6d8';

  return (
    <svg viewBox="0 0 900 380" width={width} style={{ maxWidth: '100%', height: 'auto' }} aria-hidden="true" focusable="false">
      {/* Fond : formes douces */}
      <ellipse cx="300" cy="230" rx="200" ry="120" fill={blob} opacity="0.9" />
      <ellipse cx="640" cy="160" rx="230" ry="140" fill={blob} opacity="0.7" />
      <ellipse cx="780" cy="270" rx="110" ry="70" fill={blob} opacity="0.8" />
      <ellipse cx="460" cy="330" rx="340" ry="16" fill={c.border} opacity="0.8" />

      {/* Engrenages */}
      <g fill="none" stroke={gear}>
        <circle cx="540" cy="70" r="24" strokeWidth="12" strokeDasharray="8 6.5" />
        <circle cx="540" cy="70" r="12" strokeWidth="8" />
        <circle cx="494" cy="88" r="14" strokeWidth="8" strokeDasharray="5 4.5" />
        <circle cx="494" cy="88" r="6" strokeWidth="5" />
      </g>

      {/* Ordinateur portable */}
      <rect x="470" y="118" width="232" height="172" rx="12" fill={frame} />
      <rect x="482" y="130" width="208" height="148" rx="5" fill={screen} />
      <circle cx="586" cy="124" r="2.5" fill={screen} />
      <path d="M440 296 L732 296 L752 316 Q752 322 744 322 L428 322 Q420 322 420 316 Z" fill={frame} />
      <rect x="560" y="300" width="56" height="5" rx="2.5" fill={screen} opacity="0.6" />
      {/* Triangle d'alerte */}
      <path d="M586 158 L636 246 L536 246 Z" fill={blue} stroke={blue} strokeWidth="18" strokeLinejoin="round" />
      <rect x="580" y="180" width="12" height="40" rx="6" fill="#ffffff" />
      <circle cx="586" cy="234" r="7" fill="#ffffff" />

      {/* Signaux d'alerte */}
      <g stroke={blue} strokeWidth="6" strokeLinecap="round">
        <path d="M716 96 L716 74" />
        <path d="M729 106 L745 92" />
        <path d="M734 122 L756 122" />
      </g>

      {/* Plante */}
      <g>
        <path d="M790 210 C760 190 750 160 762 140 C790 150 800 185 792 212 Z" fill={blueDeep} />
        <path d="M800 212 C810 175 835 150 864 150 C866 180 840 205 804 216 Z" fill={blue} />
        <path d="M796 216 C770 215 742 200 735 182 C762 176 786 190 798 214 Z" fill={blue} opacity="0.85" />
        <path d="M802 222 C830 210 858 214 872 230 C850 244 822 238 804 226 Z" fill={blueDeep} opacity="0.9" />
        <path d="M797 214 L799 262" stroke={blueDeep} strokeWidth="4" />
        <path d="M772 262 L826 262 L818 318 L780 318 Z" fill={potColor} />
        <rect x="766" y="254" width="66" height="12" rx="4" fill={frame} />
      </g>

      {/* Personne assise, la tête dans la main */}
      <g strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Jambes */}
        <path d="M285 300 L382 246 L426 304" stroke={pants} strokeWidth="38" />
        {/* Torse penché */}
        <path d="M290 296 Q292 248 330 206" stroke={sweater} strokeWidth="58" />
        {/* Bras posé sur le genou */}
        <path d="M322 214 Q362 226 386 244" stroke={sweater} strokeWidth="22" />
        <circle cx="392" cy="248" r="10" fill={skin} stroke="none" />
        {/* Bras relevé vers la tête */}
        <path d="M336 206 Q378 196 380 166" stroke={sweater} strokeWidth="22" />
      </g>
      {/* Tête */}
      <circle cx="352" cy="166" r="27" fill={skin} />
      <path d="M326 160 C326 132 360 124 376 140 C368 138 360 142 356 150 C346 146 336 152 330 166 Z" fill={hair} />
      <circle cx="378" cy="152" r="11" fill={skin} />
      {/* Chaussures */}
      <ellipse cx="438" cy="318" rx="28" ry="10" fill={shoe} stroke={c.border} strokeWidth="2" />
      <ellipse cx="408" cy="321" rx="24" ry="9" fill={shoe} stroke={c.border} strokeWidth="2" />

      {/* Gribouillis de confusion */}
      <path
        d="M318 100 C300 70 340 52 360 66 C382 80 360 108 338 98 C318 88 332 62 354 70 C374 78 366 102 346 100 C330 98 330 78 346 76 C364 74 370 96 352 98"
        fill="none"
        stroke={blue}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M340 108 L346 124" stroke={blue} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
