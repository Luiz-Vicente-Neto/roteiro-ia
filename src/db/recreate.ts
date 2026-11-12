import postgres from "postgres";

/**
 * Drops and recreates the database named in `url`, leaving it empty.
 * Connects to the server's `postgres` maintenance database to do so.
 */
export async function recreateDatabase(url: string): Promise<void> {
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.slice(1));
  const maintenance = new URL(url);
  maintenance.pathname = "/postgres";

  const admin = postgres(maintenance.toString(), {
    max: 1,
    onnotice: () => {},
  });
  try {
    await admin`drop database if exists ${admin(name)} with (force)`;
    await admin`create database ${admin(name)}`;
  } catch (erro) {
    // This is the first connection of `pnpm test:db` and `pnpm db:reset`,
    // and a bare ECONNREFUSED does not say what to do.
    if ((erro as { code?: string }).code === "ECONNREFUSED") {
      throw new Error(
        `Postgres fora do ar em ${target.host}. Rode \`pnpm db:up\`; se o Docker não responder, abra o Docker Desktop.`,
        { cause: erro },
      );
    }
    throw erro;
  } finally {
    await admin.end();
  }
}
