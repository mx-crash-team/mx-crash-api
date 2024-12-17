import { OriginLogger } from "@multiversx/sdk-nestjs-common";
import { Controller } from "@nestjs/common";
import { EventPattern } from "@nestjs/microservices";
import { WebSocketPublisherService } from '@libs/common/websocket/web-socket-publisher-service';

@Controller()
export class WebSocketPublisherController {
  private logger = new OriginLogger(WebSocketPublisherController.name);

  constructor(
    private readonly webSocketPublisherService: WebSocketPublisherService,
  ) { }

  @EventPattern('newGameStarted')
  async newGameStarted(status: any) {
    await this.webSocketPublisherService.onStartNewGame(status);
  }
}
