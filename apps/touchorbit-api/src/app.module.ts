import { Module, MiddlewareConsumer } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { DatabaseModule } from "./database/database.module";
import { RedisModule } from "./redis/redis.module";
import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { ProductModulesModule } from "./modules/modules.module";
import { EmployeesModule } from "./employees/employees.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { PayrollModule } from "./payroll/payroll.module";
import { EventsModule } from "./events/events.module";
import { StorageModule } from "./storage/storage.module";
import { TasksModule } from "./tasks/tasks.module";
import { LeaveModule } from "./leave/leave.module";
import { OvertimeModule } from "./overtime/overtime.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { RosterModule } from "./roster/roster.module";
import { ShiftSwapsModule } from "./shift-swaps/shift-swaps.module";
import { ShiftsModule } from "./shifts/shifts.module";
import { CalendarEventsModule } from "./calendar/calendar.module";
import { TrainingModule } from "./training/training.module";
import { AssetsModule } from "./assets/assets.module";
import { DocumentsModule } from "./documents/documents.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { ReportsModule } from "./reports/reports.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { RequestsModule } from "./requests/requests.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { MeModule } from "./me/me.module";
import { KioskModule } from "./kiosk/kiosk.module";
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
    DatabaseModule,
    RedisModule,
    AuthModule,
    PrismaModule,
    HealthModule,
    ProductModulesModule,
    EmployeesModule,
    AttendanceModule,
    PayrollModule,
    StorageModule,
    TasksModule,
    EventsModule,
    LeaveModule,
    OvertimeModule,
    ExpensesModule,
    RosterModule,
    ShiftSwapsModule,
    ShiftsModule,
    CalendarEventsModule,
    TrainingModule,
    AssetsModule,
    DocumentsModule,
    NotificationsModule,
    ReportsModule,
    OrganizationsModule,
    RequestsModule,
    DashboardModule,
    MeModule,
    KioskModule,
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
