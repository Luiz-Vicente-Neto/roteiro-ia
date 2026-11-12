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
  } finally {
    await admin.end();
  }
}
