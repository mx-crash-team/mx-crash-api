import { Module } from "@nestjs/common";
import { WebSocketPublisherService } from "./web-socket-publisher-service";
import { WebSocketPublisherController } from "./web-socket-publisher-controller";
import { CommonConfigModule, DynamicModuleUtils } from '@libs/common';

@Module({
  imports: [
    CommonConfigModule,
  ],
  controllers: [
    WebSocketPublisherController,
  ],
  providers: [
    WebSocketPublisherService,
    DynamicModuleUtils.getPubSubService(),
  ],
  exports: [
    WebSocketPublisherService,
    'PUBSUB_SERVICE',
  ],
})
export class WebSocketPublisherModule { }
