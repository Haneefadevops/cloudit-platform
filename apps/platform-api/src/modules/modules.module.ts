import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService],
})
export class ModulesModule {}
