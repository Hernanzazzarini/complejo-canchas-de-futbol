import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Reserva } from './reserva.entity';
import { Usuario } from '../../auth/entities/usuario.entity';

@Entity('canchas')
// El nombre es único por dueño, no global: dos complejos distintos pueden
// tener cada uno su "Cancha 1" sin pisarse.
@Index('uq_cancha_nombre_propietario', ['propietario', 'nombre'], {
  unique: true,
})
export class Cancha {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  nombre: string;

  @Column({ default: true })
  techada: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'precio_por_hora' })
  precioPorHora: number;

  @Column({ default: true })
  activa: boolean;

  /**
   * Dueño del complejo. Es la única fuente del aislamiento entre
   * administradores: todo lo que ve un PROPIETARIO se filtra por esta columna.
   * `RESTRICT` para que borrar la cuenta no deje canchas huérfanas.
   */
  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'propietario_id' })
  propietario: Relation<Usuario>;

  @OneToMany(() => Reserva, (reserva) => reserva.cancha)
  reservas: Relation<Reserva>[];
}
