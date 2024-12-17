import { AddressUtils } from "@multiversx/sdk-nestjs-common";
import { Injectable } from "@nestjs/common";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from 'socket.io';

@Injectable()
@WebSocketGateway(3099, {
  cors: {
    origin: "*"
  }
})
export class WebSocketPublisherService {
  private readonly maxAddressesSize = 16;

  @WebSocketServer()
  server: Server | undefined;

  constructor(
  ) { }

  async handleDisconnect(socket: Socket) {
    const { addresses, error } = this.getAddressesFromSocketQuery(socket);
    if (error) {
      socket.emit('error', error);
      return;
    }

    for (const address of addresses) {
      await socket.leave(address);
    }
  }

  async handleConnection(socket: Socket) {
    const { addresses, error } = this.getAddressesFromSocketQuery(socket);
    if (error) {
      socket.emit('error', error);
      return;
    }

    await socket.join(addresses);
  }

  async onStartNewGame(event: any) {
    this.server?.to("erd1deaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaqtv0gag").emit("onStartNewGame", event);
  }

  async onGameStatus(event: any) {
    this.server?.to("erd1deaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaqtv0gag").emit("onGameStatus", event);
  }

  async onEndGame(event: any) {
    this.server?.to("erd1deaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaqtv0gag").emit("onEndGame", event);
  }

  async onNewBets(event: any) {
    console.log('emmiting', event);
    this.server?.to("erd1deaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaqtv0gag").emit("onNewBets", event);
  }

  private getAddressesFromSocketQuery(socket: Socket): { addresses: string[], error?: string } {
    const rawAddresses = socket.handshake.query.address as string | undefined;
    if (!rawAddresses) {
      return { addresses: [], error: 'Validation failed (an address is expected)' };
    }

    const addresses = rawAddresses.split(',');
    if (addresses.length > this.maxAddressesSize) {
      return { addresses: [], error: `Validation failed for 'address' (less than ${this.maxAddressesSize} comma separated values expected)` };
    }

    const distinctAddresses = addresses.distinct() as string[];
    for (const address of distinctAddresses) {
      if (!AddressUtils.isAddressValid(address)) {
        return { addresses: [], error: `Validation failed for 'address' (a bech32 address is expected)` };
      }
    }

    return { addresses: distinctAddresses };
  }
}
