/**
 * Recorre los tres roles contra el servidor levantado y dice qué pasa con cada
 * permiso. Es una prueba de humo de extremo a extremo: usa la API de verdad,
 * con la base de verdad.
 *
 *   npm run start:dev          (en otra terminal)
 *   npm run verificar:roles
 *
 * Crea dos propietarios, un cliente, dos canchas y una reserva de prueba, y al
 * terminar los borra directo por SQL (la API no borra usuarios ni canchas a
 * propósito, la baja de cancha es lógica). Con `--dejar` los deja en la base
 * para mirarlos.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const raizProyecto = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.API ?? 'http://localhost:3000';
const DEJAR = process.argv.includes('--dejar');
/** Sufijo para que los emails y nombres no choquen entre corridas. */
const SUF = Date.now().toString().slice(-6);
const CLAVE = 'prueba1234';

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

let ok = 0;
const fallas = [];

function check(nombre, cumple, detalle = '') {
  if (cumple) {
    ok++;
    console.log(`  ok    ${nombre}`);
  } else {
    fallas.push(nombre);
    console.log(`  FALLA ${nombre}  ${detalle}`);
  }
}

async function pedir(metodo, ruta, { token, body } = {}) {
  const res = await fetch(API + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const texto = await res.text();

  return { status: res.status, body: texto ? JSON.parse(texto) : null };
}

const login = async (email, password) => {
  const { body } = await pedir('POST', '/auth/login', {
    body: { email, password },
  });

  return body?.accessToken;
};

/** Día de la semana que viene, para no pisar turnos reales de mañana. */
const enDias = (dias) =>
  new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

async function main() {
  const env = leerEnv();
  const creado = { usuarios: [], canchas: [], reservas: [] };

  console.log(`\nProbando contra ${API}\n`);

  // ── ADMIN ────────────────────────────────────────────────────────────────
  console.log('ADMIN — administra toda la plataforma');

  const admin = await login(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);

  if (!admin) {
    throw new Error(
      `No pude entrar como ${env.ADMIN_EMAIL}. Revisá ADMIN_EMAIL y ` +
        'ADMIN_PASSWORD en .env, y acordate de que el server no se reinicia ' +
        'solo cuando cambia el .env.',
    );
  }

  check('entra con las credenciales del .env', true);

  const altaPropietario = async (nombre) => {
    const { body } = await pedir('POST', '/auth/propietarios', {
      token: admin,
      body: {
        nombre,
        email: `${nombre.toLowerCase()}.${SUF}@prueba.local`,
        password: CLAVE,
      },
    });

    if (body?.id) creado.usuarios.push(body.id);

    return body;
  };

  const abel = await altaPropietario('Abel');
  const bonino = await altaPropietario('Bonino');
  check('da de alta propietarios', abel?.rol === 'PROPIETARIO');

  const altaCancha = (token, propietarioId, nombre) =>
    pedir('POST', '/canchas', {
      token,
      body: { nombre, precioPorHora: 20000, propietarioId },
    });

  const canchaAbel = await altaCancha(admin, abel.id, `Prueba Abel ${SUF}`);
  if (canchaAbel.body?.id) creado.canchas.push(canchaAbel.body.id);

  check('da de alta una cancha a nombre de un dueño', canchaAbel.status === 201);
  check('la cancha queda asignada a ese dueño', canchaAbel.body?.propietarioId === abel.id);

  const sinDuenio = await pedir('POST', '/canchas', {
    token: admin,
    body: { nombre: `Huerfana ${SUF}`, precioPorHora: 20000 },
  });
  check('rechaza un alta sin propietarioId (400)', sinDuenio.status === 400);

  const canchaBonino = await altaCancha(admin, bonino.id, `Prueba Bonino ${SUF}`);
  if (canchaBonino.body?.id) creado.canchas.push(canchaBonino.body.id);

  // ── PROPIETARIO ──────────────────────────────────────────────────────────
  console.log('\nPROPIETARIO — administra lo suyo y nada más');

  const tokenAbel = await login(abel.email, CLAVE);
  const tokenBonino = await login(bonino.email, CLAVE);

  const altaPorDuenio = await altaCancha(tokenAbel, abel.id, `Propia ${SUF}`);
  check('no puede dar de alta canchas (403)', altaPorDuenio.status === 403, JSON.stringify(altaPorDuenio.body));

  const editada = await pedir('PATCH', `/canchas/${canchaAbel.body.id}`, {
    token: tokenAbel,
    body: { precioPorHora: 25000 },
  });
  check('edita su propia cancha', editada.status === 200 && editada.body.precioPorHora === 25000);

  const ajena = await pedir('PATCH', `/canchas/${canchaAbel.body.id}`, {
    token: tokenBonino,
    body: { precioPorHora: 1 },
  });
  check('tocar la cancha de otro da 404, no 403', ajena.status === 404);

  const mias = await pedir('GET', '/canchas/mias', { token: tokenAbel });
  check(
    'sólo ve sus canchas en /canchas/mias',
    mias.body.every((c) => c.propietarioId === abel.id),
  );

  // ── CLIENTE ──────────────────────────────────────────────────────────────
  console.log('\nCLIENTE — gestiona sus propios turnos');

  const registro = await pedir('POST', '/auth/register', {
    body: {
      nombre: 'Cliente de prueba',
      email: `cliente.${SUF}@prueba.local`,
      password: CLAVE,
    },
  });
  if (registro.body?.id) creado.usuarios.push(registro.body.id);

  check('el registro público crea un CLIENTE', registro.body?.rol === 'CLIENTE');

  const tokenCliente = await login(registro.body.email, CLAVE);

  const reserva = await pedir('POST', '/reservas', {
    token: tokenCliente,
    body: {
      canchaId: canchaAbel.body.id,
      fecha: enDias(7),
      horaInicio: '19:00',
      horaFin: '20:00',
    },
  });
  if (reserva.body?.id) creado.reservas.push(reserva.body.id);

  check('reserva un turno', reserva.status === 201, JSON.stringify(reserva.body));

  const movida = await pedir('PATCH', `/reservas/${reserva.body.id}`, {
    token: tokenCliente,
    body: { fecha: enDias(8), horaInicio: '20:00', horaFin: '22:00' },
  });
  check('mueve su turno de día y hora', movida.status === 200, JSON.stringify(movida.body));
  check('el precio se recalcula (2 horas)', movida.body?.precioTotal === 50000, String(movida.body?.precioTotal));

  const soloFin = await pedir('PATCH', `/reservas/${reserva.body.id}`, {
    token: tokenCliente,
    body: { horaFin: '23:00' },
  });
  check('estirarlo no lo hace chocar consigo mismo', soloFin.status === 200, JSON.stringify(soloFin.body));

  const fueraDeHora = await pedir('PATCH', `/reservas/${reserva.body.id}`, {
    token: tokenCliente,
    body: { horaInicio: '15:00', horaFin: '16:00' },
  });
  check('no lo puede mover fuera de 17 a 23 (400)', fueraDeHora.status === 400);

  const conCancha = await pedir('PATCH', `/reservas/${reserva.body.id}`, {
    token: tokenCliente,
    body: { canchaId: canchaBonino.body.id },
  });
  check('no puede mudarlo a otra cancha (400)', conCancha.status === 400);

  const porAjeno = await pedir('PATCH', `/reservas/${reserva.body.id}`, {
    token: tokenBonino,
    body: { horaInicio: '18:00', horaFin: '19:00' },
  });
  check('el dueño de otro complejo no lo mueve (404)', porAjeno.status === 404);

  const porDuenio = await pedir('PATCH', `/reservas/${reserva.body.id}`, {
    token: tokenAbel,
    body: { horaInicio: '18:00', horaFin: '19:00' },
  });
  check('el dueño de la cancha sí lo mueve', porDuenio.status === 200, JSON.stringify(porDuenio.body));

  // ── Aislamiento entre complejos ──────────────────────────────────────────
  console.log('\nAISLAMIENTO — un dueño no ve lo del otro');

  const deAbel = await pedir('GET', '/reservas', { token: tokenAbel });
  const deBonino = await pedir('GET', '/reservas', { token: tokenBonino });
  const idsAbel = deAbel.body.map((r) => r.id);
  const idsBonino = deBonino.body.map((r) => r.id);

  check('Abel ve la reserva de su cancha', idsAbel.includes(reserva.body.id));
  check('Bonino no la ve', !idsBonino.includes(reserva.body.id));
  check('no comparten ninguna reserva', idsAbel.every((id) => !idsBonino.includes(id)));

  const filtrada = await pedir('GET', `/reservas?canchaId=${canchaAbel.body.id}`, {
    token: tokenBonino,
  });
  check('filtrar por la cancha ajena devuelve vacío', filtrada.body.length === 0);

  const todas = await pedir('GET', '/reservas', { token: admin });
  check('el ADMIN las ve todas', todas.body.some((r) => r.id === reserva.body.id));

  check(
    'el dueño ve quién reservó',
    deAbel.body.find((r) => r.id === reserva.body.id)?.usuario?.email ===
      registro.body.email,
  );

  // ── Cancelación ──────────────────────────────────────────────────────────
  console.log('\nCANCELACIÓN');

  const cancelada = await pedir('PATCH', `/reservas/${reserva.body.id}/cancelar`, {
    token: tokenCliente,
  });
  check('el cliente cancela su turno', cancelada.status === 200 && cancelada.body.estado === 'CANCELADA');

  const trasCancelar = await pedir('PATCH', `/reservas/${reserva.body.id}`, {
    token: tokenCliente,
    body: { horaInicio: '20:00', horaFin: '21:00' },
  });
  check('una cancelada ya no se puede mover (409)', trasCancelar.status === 409);

  return { env, creado };
}

/** Borra lo que creó la corrida, en orden de claves foráneas. */
async function limpiar(env, creado) {
  const client = new pg.Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT ?? 5432),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  await client.connect();

  try {
    await client.query('DELETE FROM reservas WHERE id = ANY($1)', [creado.reservas]);
    await client.query('DELETE FROM canchas WHERE id = ANY($1)', [creado.canchas]);
    await client.query('DELETE FROM usuarios WHERE id = ANY($1)', [creado.usuarios]);

    console.log(
      `\nLimpieza: ${creado.reservas.length} reserva(s), ` +
        `${creado.canchas.length} cancha(s) y ${creado.usuarios.length} usuario(s) de prueba borrados.`,
    );
  } finally {
    await client.end();
  }
}

let resultado;

try {
  resultado = await main();
} catch (error) {
  console.error(`\n${error.message}`);
}

if (resultado && !DEJAR) {
  await limpiar(resultado.env, resultado.creado);
} else if (DEJAR) {
  console.log('\n--dejar: los datos de prueba quedan en la base.');
}

console.log(`\n${ok} ok, ${fallas.length} fallas`);

if (fallas.length > 0 || !resultado) {
  if (fallas.length > 0) console.log(fallas.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
