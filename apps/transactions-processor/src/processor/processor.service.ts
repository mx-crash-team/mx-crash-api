import { EventProcessor } from "@multiversx/sdk-event-processor";
import { Locker } from "@multiversx/sdk-nestjs-common";
import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

@Injectable()
export class ProcessorService {
  private readonly eventProcessor: EventProcessor =  new EventProcessor();
  private lastEventProcessedTimestamp: number = 0;

  constructor(

  ) {

  }

  @Cron('*/1 * * * * *')
  async handleNewEvents() {
    await Locker.lock('newEvents', async () => {
      await this.eventProcessor.start({
        elasticUrl: 'https://devnet-index.multiversx.com',
        eventIdentifiers: ['newGame'],
        emitterAddresses: ['erd1qqqqqqqqqqqqqpgqttgxw8gr9lunvg5z9862kjwn4e2x6eameyvs5kykra'],
        pageSize: 1000,
        scrollTimeout: "1m",
        delayBetweenRequestsInMilliseconds: 100,
        getLastProcessedTimestamp: async () => {
          return this.lastEventProcessedTimestamp;
        },
        setLastProcessedTimestamp: async (timestamp: number) => {
          this.lastEventProcessedTimestamp = timestamp;
        },
        onEventsReceived: async (highestTimestamp: any, events: any) => {
          console.log(`Received ${events.length} events with the highest timestamp ${highestTimestamp}`);
          if (events.length > 0) {
             console.log(events);
          }
        },
      });
    });
  }

  @Cron('*/2 * * * * *')
  async handleGameProcessLoop() {

  }
}
