import { Job, JobWorkableGroup, makeid, prelog, toKebabCase } from '@keep3r-network/cli-utils';
import { getGoerliSdk } from '../../eth-sdk-build';
import metadata from './metadata.json';

const getWorkableTxs: Job['getWorkableTxs'] = async (args) => {
  // setup logs
  const correlationId = toKebabCase(metadata.name);
  const logMetadata = {
    job: metadata.name,
    block: args.advancedBlock,
    logId: makeid(5),
  };
  const logConsole = prelog(logMetadata);

  // skip job if already in progress
  if (args.skipIds.includes(correlationId)) {
    logConsole.log(`Skipping job`);
    return args.subject.complete();
  }

  logConsole.log(`Trying to work`);

  // setup job
	const signer = args.fork.ethersProvider.getSigner(args.keeperAddress);
	const { jobA: job } = getGoerliSdk(signer);

  try {
    // check if job is workable
    await job.callStatic.work({
      blockTag: args.advancedBlock,
    });

    logConsole.log(`Job is workable`);

    // create work tx
    const tx = await job.populateTransaction.work({
      nonce: args.keeperNonce,
      gasLimit: 2_000_000,
      type: 2,
    });

    // create a workable group every bundle burst
    const workableGroups: JobWorkableGroup[] = new Array(args.bundleBurst).fill(null).map((_, index) => ({
      targetBlock: args.targetBlock + index,
      txs: [tx],
      logId: `${logMetadata.logId}-${makeid(5)}`,
    }));

    // submit all bundles
    args.subject.next({
      workableGroups,
      correlationId,
    });
  } catch (err: unknown) {
    logConsole.warn('Simulation failed, probably in cooldown');
  }

  // finish job process
  args.subject.complete();
};

module.exports = {
  getWorkableTxs,
} as Job;
