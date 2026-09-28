import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { EstadoReserva } from '../enums/estados-reserva.enum';
import { Cancha } from './cancha.entity';
import { Usuario } from '../../auth/entities/usuario.entity';

@Entity('reservas')
// Índice único parcial: sólo una reserva CONFIRMADA por cancha/fecha/hora, pero
// sin límite de canceladas (un @Unique con `estado` adentro sólo dejaría
// cancelar una vez por turno).
@Index('uq_turno_confirmado', ['cancha', 'fecha', 'horaInicio'], {
  unique: true,
  where: `estado = 'CONFIRMADA'`,
})
// Acelera las consultas de disponibilidad, que siempre filtran cancha + fecha.
@Index('idx_reserva_cancha_fecha', ['cancha', 'fecha'])
export class Reserva {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'time', name: 'hora_inicio' })
  horaInicio: string;

  @Column({ type: 'time', name: 'hora_fin' })
  horaFin: string;

  @Column({
    type: 'enum',
    enum: EstadoReserva,
    default: EstadoReserva.CONFIRMADA,
  })
  estado: EstadoReserva;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'precio_total',
    default: 0,
  })
  precioTotal: number;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  // `Relation<T>` evita que emitDecoratorMetadata evalúe la clase importada al
  // definir la propiedad: Reserva y Usuario/Cancha se importan mutuamente y en
  // ESM eso rompe con "Cannot access 'Usuario' before initialization".
  @ManyToOne(() => Cancha, (cancha) => cancha.reservas, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  cancha: Relation<Cancha>;

  @ManyToOne(() => Usuario, (usuario) => usuario.reservas, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  usuario: Relation<Usuario>;
}
