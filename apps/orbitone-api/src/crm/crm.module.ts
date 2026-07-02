import { Module } from "@nestjs/common";
import { CrmController } from "./crm.controller";
import { CrmService } from "./crm.service";
import { ActivityTypesModule } from "./activity-types/activity-types.module";
import { AutomationModule } from "./automation/automation.module";
import { BulkModule } from "./bulk/bulk.module";
import { CustomFieldsModule } from "./custom-fields/custom-fields.module";
import { PipelinesModule } from "./pipelines/pipelines.module";
import { TemplatesModule } from "./templates/templates.module";
import { WebhooksModule } from "./webhooks/webhooks.module";

@Module({
  imports: [
    ActivityTypesModule,
    AutomationModule,
    BulkModule,
    CustomFieldsModule,
    PipelinesModule,
    TemplatesModule,
    WebhooksModule,
  ],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [
    ActivityTypesModule,
    AutomationModule,
    BulkModule,
    CustomFieldsModule,
    PipelinesModule,
    TemplatesModule,
    WebhooksModule,
    CrmService,
  ],
})
export class CrmModule {}
