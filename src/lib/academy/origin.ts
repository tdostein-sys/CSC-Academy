import type { Crumb } from '@/components/ui/breadcrumbs';

/**
 * Retour cohérent avec l'origine (page /student/[id]).
 *
 * Parcours : Catalogue /academy → fiche /academy/[id] → « Accéder à ma
 * formation » /student/[id]?from=catalogue&course=<id>. On ne fait JAMAIS
 * confiance à une adresse transmise : seule la valeur « catalogue » est
 * acceptée (liste blanche), et seulement si l'identifiant de formation
 * correspond bien à celui de l'inscription. Le lien de retour est alors
 * reconstruit par nous (/academy/<id>). Sans origine valide : « Mes formations ».
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cameFromCatalogue(sp: { from?: string; course?: string }, enrollmentCourseId: string): boolean {
  return sp.from === 'catalogue' && typeof sp.course === 'string' && UUID.test(sp.course) && sp.course.toLowerCase() === enrollmentCourseId.toLowerCase();
}

export function studentBreadcrumbs({
  fromCatalogue,
  courseId,
  courseTitle,
  labels,
}: {
  fromCatalogue: boolean;
  courseId: string;
  courseTitle: string;
  labels: { academy: string; catalogue: string; myCourses: string; mySpace: string };
}): Crumb[] {
  return fromCatalogue
    ? [
        { label: labels.academy, href: '/academy' },
        { label: labels.catalogue, href: '/academy' },
        { label: courseTitle, href: `/academy/${courseId}` },
        { label: labels.mySpace },
      ]
    : [
        { label: labels.academy, href: '/academy' },
        { label: labels.myCourses, href: '/student' },
        { label: courseTitle },
      ];
}
