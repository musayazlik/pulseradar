import { getDb, getSqlite } from "./client";
import { getDatabasePath } from "../core/config/paths";

/**
 * scripts/db:migrate için: veri dizinindeki DB'yi açar ve şemayı uygular.
 * getDb() zaten migration'ı idempotent şekilde çalıştırır.
 */
function main(): void {
  getDb();
  getSqlite().close();
  console.log(`Migration tamamlandı: ${getDatabasePath()}`);
}

main();
