import fs from "node:fs";
import path from "node:path";

const domains: Array<{ name: string; route: string; module: string }> = [
  { name: "Employees", route: "employees", module: "employees" },
  { name: "Leave", route: "leave", module: "leave" },
  { name: "Overtime", route: "overtime", module: "overtime" },
  { name: "Expenses", route: "expenses", module: "expenses" },
  { name: "Payroll", route: "payroll", module: "payroll" },
  { name: "Roster", route: "roster", module: "roster" },
  { name: "ShiftSwaps", route: "shift-swaps", module: "shift-swaps" },
  { name: "Shifts", route: "shifts", module: "shifts" },
  { name: "CalendarEvents", route: "calendar-events", module: "calendar" },
  { name: "Training", route: "training", module: "training" },
  { name: "Assets", route: "assets", module: "assets" },
  { name: "Documents", route: "documents", module: "documents" },
  { name: "Notifications", route: "notifications", module: "notifications" },
  { name: "Reports", route: "reports", module: "reports" },
  { name: "Organizations", route: "organizations", module: "organizations" },
  { name: "Requests", route: "requests", module: "requests" },
  { name: "Dashboard", route: "dashboard", module: "dashboard" },
  { name: "Me", route: "me", module: "me" },
  { name: "Kiosk", route: "kiosk", module: "kiosk" },
];

const base = path.resolve("apps/touchorbit-api/src");

for (const d of domains) {
  const dir = path.join(base, d.module);
  fs.mkdirSync(dir, { recursive: true });

  const serviceName = `${d.name}Service`;
  const controllerName = `${d.name}Controller`;
  const moduleName = `${d.name}Module`;
  const filePrefix = d.module;
  const serviceProp = `${filePrefix.replace(/-/g, "")}Service`;

  const serviceFile = path.join(dir, `${filePrefix}.service.ts`);
  const controllerFile = path.join(dir, `${filePrefix}.controller.ts`);
  const moduleFile = path.join(dir, `${filePrefix}.module.ts`);

  const guardImport =
    d.module === "me" || d.module === "kiosk"
      ? ""
      : `import { RequireModule } from "../common/decorators/require-module.decorator";`;

  const requireModule =
    d.module === "me" || d.module === "kiosk"
      ? ""
      : `@RequireModule("touchorbit", "${d.route === "calendar-events" ? "calendar" : d.route === "shift-swaps" ? "attendance" : d.route}")`;

  const serviceContent = `import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class ${serviceName} {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(_organizationId: string) {
    return [];
  }
}
`;

  const controllerContent = `import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
${guardImport}
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { ${serviceName} } from "./${filePrefix}.service";

@ApiTags("${d.route}")
@Controller("${d.route}")
@UseGuards(SessionAuthGuard)
export class ${controllerName} {
  constructor(private readonly ${serviceProp}: ${serviceName}) {}

  @Get()
  ${requireModule}
  @ApiOperation({ summary: "List ${d.route}" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.${serviceProp}.findAll(organizationId);
    return { ok: true, data: rows };
  }
}
`;

  const moduleContent = `import { Module } from "@nestjs/common";
import { ${controllerName} } from "./${filePrefix}.controller";
import { ${serviceName} } from "./${filePrefix}.service";

@Module({
  controllers: [${controllerName}],
  providers: [${serviceName}],
  exports: [${serviceName}],
})
export class ${moduleName} {}
`;

  fs.writeFileSync(serviceFile, serviceContent);
  fs.writeFileSync(controllerFile, controllerContent);
  fs.writeFileSync(moduleFile, moduleContent);

  console.log(`Generated ${dir}`);
}

console.log("Done.");
