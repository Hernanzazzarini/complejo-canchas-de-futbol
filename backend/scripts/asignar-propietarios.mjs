/**
 * Migración de una sola vez: le pone dueño a las canchas que ya existían.
 *
 * Hace falta porque el proyecto no usa migraciones sino `synchronize`, y
 * agregar `propietario_id NOT NULL` sobre una tabla con filas hace fallar el
 * arranque. Este script crea la columna como nullable y la completa; recién
 * después `synchronize` puede marcarla NOT NULL y agregar la foreign key.
 *
 *   npm run db:propietarios -- [email-del-dueño]
 *
 * Sin argumento asigna todo al primer ADMIN, para que arranque; después se
 * reasigna cada cancha con PATCH /canchas/:id { "propietarioId": N }.
 * Es idempotente: si ya no quedan canchas sin dueño, no toca nada.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const raizProyecto = join(dirname(fileURLToPath(import.meta.url)), '..');

function leerEnv() {
  const env = {};

  for (const linea of readFileSync(join(raizProyecto, '.env'), 'utf8').split(
    '\n',
  )) {
    const limpia = linea.trim();

    if (!limpia || limpia.startsWith('#')) continue;

    const corte = limpia.indexOf('=');
    if (corte === -1) continue;

    env[limpia.slice(0, corte)] = limpia
      .slice(corte + 1)
      .replace(/^["']|["']$/g, '');
  }

  return env;
}

async function main() {
  const email = process.argv[2];
  const env = leerEnv();

  const client = new pg.Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT ?? 5432),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  await client.connect();

  try {
    const { rows: tabla } = await client.query(
      `SELECT to_regclass('public.canchas') AS existe`,
    );

    if (!tabla[0].existe) {
      console.log('No hay tabla `canchas` todavía: nada que migrar.');
      return;
    }

    await client.query(
      'ALTER TABLE canchas ADD COLUMN IF NOT EXISTS propietario_id integer',
    );

    const { rows: huerfanas } = await client.query(
      'SELECT id, nombre FROM canchas WHERE propietario_id IS NULL ORDER BY id',
    );

    if (huerfanas.length === 0) {
      console.log('Todas las canchas ya tienen dueño.');
      return;
    }

    const { rows: duenios } = await client.query(
      email
        ? 'SELECT id, email, rol FROM usuarios WHERE email = $1'
        : `SELECT id, email, rol FROM usuarios WHERE rol = 'ADMIN' ORDER BY id LIMIT 1`,
      email ? [email] : [],
    );

    if (duenios.length === 0) {
      throw new Error(
        email
          ? `No existe el usuario ${email}`
          : 'No hay ningún ADMIN en la base. Pasá un email: npm run db:propietarios -- alguien@mail.com',
      );
    }

    const duenio = duenios[0];

    await client.query(
      'UPDATE canchas SET propietario_id = $1 WHERE propietario_id IS NULL',
      [duenio.id],
    );

    console.log(
      `Asignadas ${huerfanas.length} cancha(s) a ${duenio.email} (id ${duenio.id}, rol ${duenio.rol}):`,
    );

    for (const cancha of huerfanas) {
      console.log(`  - ${cancha.id}: ${cancha.nombre}`);
    }

    console.log(
      '\nSon un dueño provisorio. Creá los reales con POST /auth/propietarios',
      '\ny reasignalas con PATCH /canchas/:id { "propietarioId": N }.',
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
