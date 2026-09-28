/**
 * Fechas en horario local. `new Date('2026-09-25')` se interpreta como UTC y
 * en Argentina (UTC-3) cae el día anterior, así que ni se arma ni se lee un
 * ISO con el constructor de string.
 */

/** Hoy como 'YYYY-MM-DD'. Espejo de hoyISO() del backend. */
export function hoyISO(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

/** 'YYYY-MM-DD' + días, como 'YYYY-MM-DD'. */
export function sumarDias(iso: string, dias: number): string {
  const fecha = aDateLocal(iso);
  fecha.setDate(fecha.getDate() + dias);
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** '19:00:00' → '19:00'. Lo que se muestra en pantalla. */
export function hhmm(hora: string): string {
  return hora.slice(0, 5);
}

/** 'viernes 25 de septiembre'. */
export function fechaLarga(iso: string): string {
  return aDateLocal(iso).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Si ese turno ya empezó. Misma regla que usa el backend para rechazarlo. */
export function turnoPasado(fecha: string, horaInicio: string): boolean {
  const [hh, mm] = horaInicio.split(':');
  const cuando = aDateLocal(fecha);
  cuando.setHours(Number(hh), Number(mm), 0, 0);
  return cuando.getTime() <= Date.now();
}

function aDateLocal(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}
