/**
 * Postgres devuelve las columnas `time` como 'HH:MM:SS' y los DTOs aceptan
 * 'HH:MM'. Todo se normaliza a 'HH:MM:SS' para poder comparar como texto.
 */

/** Horario en el que el complejo toma turnos. */
export const HORA_APERTURA = '17:00:00';
export const HORA_CIERRE = '23:00:00';
/** Duración de un turno, en minutos. */
export const DURACION_TURNO_MIN = 60;

export function normalizarHora(hora: string): string {
  const [hh = '00', mm = '00', ss = '00'] = hora.split(':');
  return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:${ss.padStart(2, '0')}`;
}

export function aMinutos(hora: string): number {
  const [hh, mm] = normalizarHora(hora).split(':');
  return Number(hh) * 60 + Number(mm);
}

export function aHora(minutos: number): string {
  const hh = Math.floor(minutos / 60);
  const mm = minutos % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
}

/** Duración en horas (puede ser fraccionaria) entre dos horarios. */
export function duracionEnHoras(inicio: string, fin: string): number {
  return (aMinutos(fin) - aMinutos(inicio)) / 60;
}

/** Fecha de hoy en formato 'YYYY-MM-DD', en horario local. */
export function hoyISO(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

/** Hora actual 'HH:MM:SS', en horario local. */
export function ahoraISO(): string {
  const ahora = new Date();
  return `${String(ahora.getHours()).padStart(2, '0')}:${String(
    ahora.getMinutes(),
  ).padStart(2, '0')}:00`;
}

/** Turnos de `DURACION_TURNO_MIN` entre apertura y cierre. */
export function grillaDeTurnos(): { horaInicio: string; horaFin: string }[] {
  const turnos: { horaInicio: string; horaFin: string }[] = [];
  const cierre = aMinutos(HORA_CIERRE);

  for (
    let minuto = aMinutos(HORA_APERTURA);
    minuto + DURACION_TURNO_MIN <= cierre;
    minuto += DURACION_TURNO_MIN
  ) {
    turnos.push({
      horaInicio: aHora(minuto),
      horaFin: aHora(minuto + DURACION_TURNO_MIN),
    });
  }

  return turnos;
}

/** Dos rangos se solapan si cada uno empieza antes de que el otro termine. */
export function seSolapan(
  inicioA: string,
  finA: string,
  inicioB: string,
  finB: string,
): boolean {
  return (
    aMinutos(inicioA) < aMinutos(finB) && aMinutos(finA) > aMinutos(inicioB)
  );
}
