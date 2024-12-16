// import { AbiRegistry } from "@multiversx/sdk-core";
import { EventProcessor } from "@multiversx/sdk-event-processor";
// import { CacheService } from "@multiversx/sdk-nestjs-cache";
import { Locker } from "@multiversx/sdk-nestjs-common";
// import { TransactionProcessor } from "@multiversx/sdk-transaction-processor";
import { Injectable, /* Logger */ } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
// import { CacheInfo, CommonConfigService } from "@libs/common";
// import { AppConfigService } from "../config/app-config.service";

// import * as contractAbi from "../../../../contracts/the-crash.abi.json"
// import { TransactionDecoder } from '@multiversx/sdk-transaction-decoder/lib/src/transaction.decoder';

@Injectable()
export class ProcessorService {
  // private transactionProcessor: TransactionProcessor = new TransactionProcessor();
  // private readonly logger: Logger;
  private readonly eventProcessor: EventProcessor =  new EventProcessor();
  private lastEventProcessedTimestamp: number = 0;

  constructor(
    // private readonly cacheService: CacheService,
    // private readonly commonConfigService: CommonConfigService,
    // private readonly appConfigService: AppConfigService,
  ) {
    // this.logger = new Logger(ProcessorService.name);
  }

  // @Cron('*/1 * * * * *')
  // async handleNewTransactions() {
  //   await Locker.lock('newTransactions', async () => {
  //     await this.transactionProcessor.start({
  //       gatewayUrl: this.commonConfigService.config.urls.api,
  //       maxLookBehind: this.appConfigService.config.maxLookBehind,
  //       // eslint-disable-next-line require-await
  //       onTransactionsReceived: async (_shardId, _nonce, transactions, _statistics) => {
  //         // this.logger.log(`Received ${transactions.length} transactions on shard ${shardId} and nonce ${nonce}. Time left: ${statistics.secondsLeft}`);
  //         let transactionsForContract = transactions.filter(tx => tx.receiver === this.appConfigService.config.crashGameContractAddress);
  //         transactionsForContract.map(tx => {
  //           const decoded = new TransactionDecoder().getTransactionMetadata({
  //             sender: tx.sender || '',
  //             receiver: tx.receiver || '',
  //             data: tx.data || '',
  //             value: tx.value
  //           });
  //
  //           this.logger.log('called function', decoded.functionName);
  //           console.log(decoded.functionArgs);
  //         });
  //       },
  //       getLastProcessedNonce: async (shardId) => {
  //         return await this.cacheService.getRemote(CacheInfo.LastProcessedNonce(shardId).key);
  //       },
  //       setLastProcessedNonce: async (shardId, nonce) => {
  //         await this.cacheService.setRemote(CacheInfo.LastProcessedNonce(shardId).key, nonce, CacheInfo.LastProcessedNonce(shardId).ttl);
  //       },
  //     });
  //   });
  // }

  // @Cron('*/1 * * * * *')
  // async pushContractStatus() {
  //
  // }

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
