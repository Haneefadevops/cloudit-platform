import { Module, MiddlewareConsumer } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { CommonModule } from "./common/common.module";
import { DatabaseModule } from "./database/database.module";
import { RedisModule } from "./redis/redis.module";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { ProductModulesModule } from "./modules/modules.module";
import { EventsModule } from "./events/events.module";
import { AuthModule } from "./auth/auth.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { BillingModule } from "./billing/billing.module";
import { DocumentsModule } from "./documents/documents.module";
import { FeedbackModule } from "./feedback/feedback.module";
import { RatingsModule } from "./ratings/ratings.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AccountsModule } from "./accounts/accounts.module";
import { CrmModule } from "./crm/crm.module";
import { CustomersModule } from "./customers/customers.module";
import { SchedulingModule } from "./scheduling/scheduling.module";
import { PublicBookingModule } from "./public-booking/public-booking.module";
import { SessionAuthGuard } from "./common/guards/session-auth.guard";
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
    CommonModule,
    DatabaseModule,
    RedisModule,
    PrismaModule,
    HealthModule,
    ProductModulesModule,
    EventsModule,
    AuthModule,
    ProfilesModule,
    OrganizationsModule,
    BillingModule,
    DocumentsModule,
    FeedbackModule,
    RatingsModule,
    DashboardModule,
    AnalyticsModule,
    AccountsModule,
    CrmModule,
    CustomersModule,
    SchedulingModule,
    PublicBookingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard,
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
