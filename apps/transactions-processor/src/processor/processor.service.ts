import { EventProcessor } from "@multiversx/sdk-event-processor";
import { CacheService } from "@multiversx/sdk-nestjs-cache";
import {
  Account,
  Address,
  Transaction,
  AbiRegistry,
  ApiNetworkProvider,
  TransactionWatcher,
  QueryRunnerAdapter,
  SmartContractQueriesController,
  TransactionsFactoryConfig,
  SmartContractTransactionsFactory,
  SmartContractTransactionsOutcomeParser,
  TransactionComputer,
  TransactionEventsParser,
  findEventsByFirstTopic, TransactionsConverter, TransactionEvent,
} from '@multiversx/sdk-core/out';
import { Constants, Locker } from '@multiversx/sdk-nestjs-common';
import { Inject, Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { promises } from "fs";
import { UserSigner } from "@multiversx/sdk-wallet/out";
import { CacheInfo, CommonConfigService } from "@libs/common";
import { AppConfigService } from "../config/app-config.service";
import * as contractAbi from "../../../../contracts/the-crash.abi.json"
import { WebSocketPublisherService } from '@libs/common/websocket';

@Injectable()
export class ProcessorService {
  private readonly eventProcessor: EventProcessor =  new EventProcessor();
  private lastEventProcessedTimestamp: number = 0;
  private contractsQueryController: SmartContractQueriesController;
  private transactionFactory: SmartContractTransactionsFactory;
  private readonly apiNetworkProvider: ApiNetworkProvider;
  private readonly scTransactionParser: SmartContractTransactionsOutcomeParser;
  private readonly txEventParser: TransactionEventsParser;

  constructor(
    private readonly cacheService: CacheService,
    private readonly commonConfigService: CommonConfigService,
    private readonly appConfigService: AppConfigService,
    private readonly websocketService: WebSocketPublisherService,
  ) {
    this.apiNetworkProvider = new ApiNetworkProvider(this.commonConfigService.config.urls.api, { clientName: "mx-crash-game" });
    const queryRunner = new QueryRunnerAdapter({
      networkProvider: this.apiNetworkProvider
    });

    const abi = AbiRegistry.create(contractAbi);

    this.contractsQueryController = new SmartContractQueriesController({
      queryRunner: queryRunner,
      abi,
    });

    const factoryConfig = new TransactionsFactoryConfig({ chainID: "D" });
    this.transactionFactory = new SmartContractTransactionsFactory({ config: factoryConfig, abi });

    this.scTransactionParser = new SmartContractTransactionsOutcomeParser({ abi });
    this.txEventParser = new TransactionEventsParser({ abi });
  }

  @Cron('*/1 * * * * *')
  async handleNewEvents() {
    await Locker.lock('newEvents', async () => {
      await this.eventProcessor.start({
        elasticUrl: 'https://devnet-index.multiversx.com',
        eventIdentifiers: ['submitBet'],
        emitterAddresses: [this.appConfigService.config.crashGameContractAddress],
        pageSize: 1000,
        scrollTimeout: "1m",
        delayBetweenRequestsInMilliseconds: 100,
        getLastProcessedTimestamp: async () => {
          return await this.cacheService.getRemote('lastProcessedTimestamp') || 0;
        },
        setLastProcessedTimestamp: async (timestamp: number) => {
          await this.cacheService.setRemote('lastProcessedTimestamp', timestamp, Constants.oneMonth());
        },
        onEventsReceived: async (highestTimestamp: any, events: any) => {
          let parsedEvents = events.map((event: any) => {
            return this.txEventParser.parseEvent({ event: new TransactionEvent({
                ...event,
                topics: event.topics.map((topic: string) => Buffer.from(topic, 'hex')),
            })});
          });

          parsedEvents = parsedEvents.map((event: any) => {
            return {
              address: event.user.bech32(),
              bet: event.bet,
              cash_out: event.cash_out,
            }
          });

          console.log(parsedEvents);

          await this.websocketService.onNewBets(parsedEvents);
        },
      });
    });
  }

  @Cron('*/2 * * * * *')
  async handleGameProcessLoop() {
    // 1. Get current game status
    await Locker.lock('handleGameProcessLoop', async () => {
      const currentGame = await this.getCurrentGame();

      await this.websocketService.onGameStatus(currentGame);

      console.log('current status', currentGame.status);
      switch (currentGame.status) {
        case 'Ended': // Keep in mind that when no game has (ever) started, status is Ended
          await this.startNewGame();
          break;
        case 'Ongoing':
          if (currentGame.current_timestamp.minus(currentGame.init_moment.plus(currentGame.duration)).comparedTo(0) > 0) {
            await this.endGame();
          }
          break;

        case 'Awarding':
          await this.computePrizes();
          break;
        default:
          throw new Error("invalid game status")
      }
    });
  }

  async startNewGame() {
    const signer = await this.loadWallet();
    let transaction = this.transactionFactory.createTransactionForExecute({
      sender: signer.getAddress(),
      contract: Address.fromBech32(this.appConfigService.config.crashGameContractAddress),
      function: "newGame",
      gasLimit: BigInt(6000000),
      arguments: [ 600 ] // Duration = 10 minutes
    });

    transaction = await this.addSignature(transaction, signer);

    const txHash = await this.apiNetworkProvider.sendTransaction(transaction);
    const txOnNetwork = await new TransactionWatcher(this.apiNetworkProvider)
      .awaitCompleted(txHash);

    await this.websocketService.onStartNewGame("");
  }

  async endGame() {
    const signer = await this.loadWallet();
    let transaction = this.transactionFactory.createTransactionForExecute({
      sender: signer.getAddress(),
      contract: Address.fromBech32(this.appConfigService.config.crashGameContractAddress),
      function: "endGame",
      gasLimit: BigInt(6000000),
    });

    transaction = await this.addSignature(transaction, signer);

    const txHash = await this.apiNetworkProvider.sendTransaction(transaction);
    const txOnNetwork = await new TransactionWatcher(this.apiNetworkProvider)
      .awaitCompleted(txHash);

    // Get crash point
    const txConverter = new TransactionsConverter();
    const outcome = txConverter.transactionOnNetworkToOutcome(txOnNetwork);
    const [event] = findEventsByFirstTopic(outcome, "ended_game");

    const parsedEvent = this.txEventParser.parseEvent({ event });
    console.log("having parsed event should get crash_point for nonce", parsedEvent);
    await this.websocketService.onEndGame(parsedEvent);
  }

  async computePrizes() {
    const signer = await this.loadWallet();

    let transaction = this.transactionFactory.createTransactionForExecute({
      sender: signer.getAddress(),
      contract: Address.fromBech32(this.appConfigService.config.crashGameContractAddress),
      function: "computePrizes",
      gasLimit: BigInt(60000000),
    });

    transaction = await this.addSignature(transaction, signer);

    const txHash = await this.apiNetworkProvider.sendTransaction(transaction);
    const txOnNetwork = await new TransactionWatcher(this.apiNetworkProvider)
      .awaitCompleted(txHash);

    return txOnNetwork;
  }

  async addSignature(transaction: Transaction, signer: UserSigner) {
    const account = await this.loadAccount(signer);
    transaction.nonce = BigInt(account.getNonceThenIncrement().valueOf());

    const txComputer = new TransactionComputer();
    transaction.signature = await signer.sign(
      txComputer.computeBytesForSigning(transaction)
    );

    return transaction;
  }

  async getCurrentGame() {
    const query = this.contractsQueryController.createQuery({
      contract: this.appConfigService.config.crashGameContractAddress,
      function: "getGameDetails",
      arguments: [],
    });
    const response = await this.contractsQueryController.runQuery(query);
    const parsedResponse = this.contractsQueryController.parseQueryResponse(response);

    return {
      status: parsedResponse[0].status.name,
      nonce: parsedResponse[0].nonce,
      duration: parsedResponse[0].duration,
      init_moment: parsedResponse[0].init_moment,
      current_timestamp: parsedResponse[0].current_timestamp,
    }
  }

  async loadWallet() {
    const pemText = await promises.readFile("./wallets/admin.pem", { encoding: "utf8" });
    const signer = UserSigner.fromPem(pemText);

    return signer;
  }

  async loadAccount(wallet: UserSigner): Promise<Account> {
    const acc = new Account(wallet.getAddress());
    const accOnNetwork = await this.apiNetworkProvider.getAccount(wallet.getAddress());
    acc.update(accOnNetwork);

    return acc;
  }
}
