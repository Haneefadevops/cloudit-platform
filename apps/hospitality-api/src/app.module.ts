import { Module, MiddlewareConsumer } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { ProductModulesModule } from "./modules/modules.module";
import { PropertiesModule } from "./properties/properties.module";
import { RoomTypesModule } from "./room-types/room-types.module";
import { RoomsModule } from "./rooms/rooms.module";
import { GuestsModule } from "./guests/guests.module";
import { ReservationsModule } from "./reservations/reservations.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { TaxesModule } from "./taxes/taxes.module";
import { ReportsModule } from "./reports/reports.module";
import { EventsModule } from "./events/events.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { ModuleGuard } from "./common/guards/module.guard";
import { RequestLoggingInterceptor } from "./common/interceptors/request-logging.interceptor";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { TimeoutInterceptor } from "./common/interceptors/timeout.interceptor";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: "default",
            ttl: Number(configService.get("THROTTLE_TTL", 60000)),
            limit: Number(configService.get("THROTTLE_LIMIT", 100)),
          },
        ],
        skipIf: (context) => {
          const req = context.switchToHttp().getRequest<{ url: string }>();
          return (
            req.url.startsWith("/api/health") || req.url.startsWith("/api/docs")
          );
        },
      }),
    }),
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get("JWT_SECRET"),
        signOptions: { expiresIn: "1d" },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    HealthModule,
    ProductModulesModule,
    PropertiesModule,
    RoomTypesModule,
    RoomsModule,
    GuestsModule,
    ReservationsModule,
    InvoicesModule,
    TaxesModule,
    ReportsModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ModuleGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
