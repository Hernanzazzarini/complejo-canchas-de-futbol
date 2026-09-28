import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { EstadoDto } from './dtos/estado.dto';

@ApiTags('Estado')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Estado del servicio',
    description: 'Confirma que la API responde y que la base está conectada.',
  })
  @ApiResponse({ status: 200, type: EstadoDto })
  @ApiResponse({ status: 503, description: 'La base de datos no responde' })
  estado(): Promise<EstadoDto> {
    return this.appService.estado();
  }
}
