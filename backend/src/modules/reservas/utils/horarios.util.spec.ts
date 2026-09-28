import {
  aHora,
  aMinutos,
  duracionEnHoras,
  grillaDeTurnos,
  normalizarHora,
  seSolapan,
} from './horarios.util';

describe('horarios.util', () => {
  describe('normalizarHora', () => {
    it('completa los segundos de una hora HH:MM', () => {
      expect(normalizarHora('19:00')).toBe('19:00:00');
    });

    it('deja intacta una hora que ya viene de Postgres', () => {
      expect(normalizarHora('19:30:00')).toBe('19:30:00');
    });

    it('agrega el cero inicial', () => {
      expect(normalizarHora('9:05')).toBe('09:05:00');
    });
  });

  describe('aMinutos / aHora', () => {
    it('convierte en ambos sentidos', () => {
      expect(aMinutos('19:30')).toBe(1170);
      expect(aHora(1170)).toBe('19:30:00');
    });
  });

  describe('duracionEnHoras', () => {
    it('calcula horas enteras', () => {
      expect(duracionEnHoras('19:00', '21:00')).toBe(2);
    });

    it('calcula fracciones', () => {
      expect(duracionEnHoras('19:00', '20:30')).toBe(1.5);
    });
  });

  describe('seSolapan', () => {
    it('detecta un solapamiento parcial', () => {
      expect(seSolapan('19:00', '20:00', '19:30', '20:30')).toBe(true);
    });

    it('detecta un turno contenido en otro', () => {
      expect(seSolapan('19:00', '22:00', '20:00', '21:00')).toBe(true);
    });

    it('no considera solapados dos turnos consecutivos', () => {
      expect(seSolapan('19:00', '20:00', '20:00', '21:00')).toBe(false);
    });

    it('no considera solapados dos turnos separados', () => {
      expect(seSolapan('19:00', '20:00', '21:00', '22:00')).toBe(false);
    });
  });

  describe('grillaDeTurnos', () => {
    const turnos = grillaDeTurnos();

    it('arranca a la hora de apertura y termina a la de cierre', () => {
      expect(turnos[0]).toEqual({
        horaInicio: '17:00:00',
        horaFin: '18:00:00',
      });
      expect(turnos[turnos.length - 1]).toEqual({
        horaInicio: '22:00:00',
        horaFin: '23:00:00',
      });
    });

    it('son 6 turnos de una hora entre las 17 y las 23', () => {
      expect(turnos).toHaveLength(6);
    });

    it('no deja huecos entre turnos', () => {
      turnos.slice(1).forEach((turno, i) => {
        expect(turno.horaInicio).toBe(turnos[i].horaFin);
      });
    });
  });
});
