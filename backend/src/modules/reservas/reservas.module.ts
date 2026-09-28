import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cancha } from './entities/cancha.entity';
import { Reserva } from './entities/reserva.entity';
import { CanchasService } from './services/canchas.service';
import { ReservasService } from './services/reservas.service';
import { CanchasController } from './controllers/canchas.controller';
import { ReservasController } from './controllers/reservas.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule aporta JwtAuthGuard y RolesGuard, que protegen estos endpoints.
  imports: [TypeOrmModule.forFeature([Cancha, Reserva]), AuthModule],
  controllers: [CanchasController, ReservasController],
  providers: [CanchasService, ReservasService],
  exports: [CanchasService, ReservasService],
})
export class ReservasModule {}
