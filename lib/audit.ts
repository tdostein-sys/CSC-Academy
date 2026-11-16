import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Journalise une action sensible effectuée côté serveur avec la clé secrète
 * (les fonctions SQL métier journalisent elles-mêmes via write_audit()).
 */
export async function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  data: Record<string, unknown> = {},
) {
  const admin = createAdminClient();
  const { error } = await admin.from('audit_log').insert({
    actor_id: actorId,
    action,
    entity,
    entity_id: entityId,
    data,
  });
  if (error) console.error('[audit] échec de journalisation', action, error.message);
}
