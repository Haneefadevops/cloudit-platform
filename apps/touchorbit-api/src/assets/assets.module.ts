import { Module } from "@nestjs/common";
import {
  AssetAssignmentsController,
  AssetCategoriesController,
  AssetsController,
} from "./assets.controller";
import { AssetsService } from "./assets.service";

@Module({
  controllers: [
    AssetsController,
    AssetCategoriesController,
    AssetAssignmentsController,
  ],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
