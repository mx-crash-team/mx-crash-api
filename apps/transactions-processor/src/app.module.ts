import { Module } from '@nestjs/common';
import {
  ApiMetricsController,
  CommonConfigModule,
  DynamicModuleUtils,
  HealthCheckController,
  WebSocketPublisherModule,
} from '@libs/common';
import { ApiMetricsModule } from '@libs/common';
import { LoggingModule } from '@multiversx/sdk-nestjs-common';
import { AppConfigModule } from './config/app-config.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ProcessorService } from './processor/processor.service';

@Module({
  imports: [
    LoggingModule,
    ApiMetricsModule,
    AppConfigModule,
    CommonConfigModule,
    ScheduleModule.forRoot(),
    DynamicModuleUtils.getCachingModule(),
    WebSocketPublisherModule,
  ],
  providers: [
    ProcessorService,
    DynamicModuleUtils.getPubSubService(),
  ],
  controllers: [
    ApiMetricsController,
    HealthCheckController,
  ],
})
export class AppModule { }
