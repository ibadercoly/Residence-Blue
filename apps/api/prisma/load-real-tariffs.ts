import { PrismaClient } from '@prisma/client';
import {
  RealTariffsLoadReport,
  loadRealTariffsAndIdentity,
} from '../src/tariffs/real-tariffs-loader.util';

export { RealTariffsLoadReport, loadRealTariffsAndIdentity };

if (require.main === module) {
  const client = new PrismaClient();
  loadRealTariffsAndIdentity(client)
    .then((report) => {
      console.log('[TARIFS] Chargement idempotent terminé :', JSON.stringify(report));
    })
    .catch((err) => {
      console.error('[TARIFS] Erreur chargement tarifs réels :', err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await client.$disconnect();
    });
}
