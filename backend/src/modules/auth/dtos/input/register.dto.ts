import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Hernán Zazzarini' })
  @IsString()
  @MinLength(3)
  nombre: string;

  @ApiProperty({ example: 'hernan@mail.com' })
  @IsEmail({}, { message: 'El email no es válido' })
  email: string;

  @ApiProperty({ example: 'secreto123', minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @ApiProperty({ example: '3537123456', required: false })
  @IsOptional()
  @IsString()
  telefono?: string;
}
