import { createForks, GanacheFork, Job, JobWorkableGroup, makeid, prelog, TransactionError } from '@keep3r-network/cli-utils';
import { getGoerliSdk } from '../../eth-sdk-build';
import metadata from './metadata.json';

const expectedErrors: string[] = ['V2Keep3rJob::work:not-workable', '!authorized', '!healthcheck'];
const maxStrategiesPerFork = 5;

const getWorkableTxs: Job['getWorkableTxs'] = async (args) => {
  // setup logs
  const logMetadata = {
    job: metadata.name,
    block: args.advancedBlock,
    logId: makeid(5),
  };
  const logConsole = prelog(logMetadata);

  logConsole.log(`Trying to work`);

  // setup job with default fork provider
	const signer = args.fork.ethersProvider.getSigner(args.keeperAddress);
	const { jobStrategies: defaultJob } = getGoerliSdk(signer);

  // get strategies to work
  const strategies: string[] = args.retryId ? [args.retryId] : await defaultJob.jobs();
  logConsole.log(args.retryId ? `Retrying strategy` : `Simulating ${strategies.length} strategies`);

  // create needed forks in order to work in parallel
  const forksToCreate = Math.ceil(strategies.length / maxStrategiesPerFork) - 1;
  const forks: GanacheFork[] = [args.fork, ...(await createForks(forksToCreate, args))];
  logConsole.debug(`Created ${forks.length} forks in order to work in parellel`);

  // for each fork
  const workPromises = forks.map(async (fork, forkIndex) => {

    // setup job using fork provider
    const signer = fork.ethersProvider.getSigner(args.keeperAddress);
    const { jobStrategies: forkJob } = getGoerliSdk(signer);

    const forkStrategies = strategies.slice(forkIndex * maxStrategiesPerFork, forkIndex * maxStrategiesPerFork + maxStrategiesPerFork);

    // for each strategy
    for (const [index, strategy] of forkStrategies.entries()) {

      // setup logs for strategy
      const strategyIndex = forkIndex * maxStrategiesPerFork + index;
      const strategyLogId = `${logMetadata.logId}-${makeid(5)}`;
      const strategyConsole = prelog({ ...logMetadata, logId: strategyLogId });

      // skip strategy if already in progress
      if (args.skipIds.includes(strategy)) {
        strategyConsole.info('Skipping strategy', { strategy });
        continue;
      }

      try {
        // check if strategy is workable
        await forkJob.callStatic.execute(strategy, {
          blockTag: args.advancedBlock,
        });
        strategyConsole.log(`Strategy #${strategyIndex} is workable`, { strategy });

        // create work tx
        const tx = await forkJob.populateTransaction.execute(strategy, {
          nonce: args.keeperNonce,
          gasLimit: 5_000_000,
          type: 2,
        });

        // create a workable group every bundle burst
        const workableGroups: JobWorkableGroup[] = new Array(args.bundleBurst).fill(null).map((_, index) => ({
          targetBlock: args.targetBlock + index,
          txs: [tx],
          logId: `${strategyLogId}-${makeid(5)}`,
        }));

        // submit all bundles
        args.subject.next({
          workableGroups,
          correlationId: strategy,
        });

      } catch (err: any) {
        // handle error logs
        const isExpectedError = expectedErrors.find((expectedError) => {
          return (err as TransactionError).message?.includes(expectedError);
        });

        if (!isExpectedError) {
          strategyConsole.warn(`Strategy #${strategyIndex} failed with unknown error`, {
            strategy,
            message: err.message,
          });
        } else {
          strategyConsole.log(`Strategy #${strategyIndex} is not workable`, { strategy });
        }
      }
    }
  });

  // wait for all parallel forks to finish
  await Promise.all(workPromises);

  // finish job process
  args.subject.complete();
};

module.exports = {
  getWorkableTxs,
} as Job;
