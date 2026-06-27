import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
