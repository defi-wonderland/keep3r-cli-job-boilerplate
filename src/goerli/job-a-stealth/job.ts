import { getStealthHash, Job, JobWorkableGroup, makeid, prelog, toKebabCase } from '@keep3r-network/cli-utils';
import { getGoerliSdk } from '../../eth-sdk-build';
import metadata from './metadata.json';

const jobAddress = '0x9DC52d978290f13b73692C5AeA21B4C8954e909A';
const stealthRelayerAddress = '0xD44A48001A4BAd6f23aD8750eaD0036765A35d4b';

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
	const { jobAStealth: job, stealthRelayer } = getGoerliSdk(signer);

  const workData: string = job.interface.encodeFunctionData('work');
  const stealthHash: string = getStealthHash();

  try {
    // check if job is workable
    await stealthRelayer.callStatic.execute(job.address, workData, stealthHash, args.advancedBlock, {
      blockTag: args.advancedBlock,
    });

    logConsole.log(`Found workable block`);

    const workableGroups: JobWorkableGroup[] = [];
    
    // create a workable group every bundle burst
    for (let index = 0; index < args.bundleBurst; index++) {

      // create work tx
      const tx = await stealthRelayer
        .populateTransaction.execute(jobAddress, workData, stealthHash, args.targetBlock + index, {
          nonce: args.keeperNonce,
          gasLimit: args.block.gasLimit,
          type: 2,
        });

      workableGroups.push({
        targetBlock: args.targetBlock + index,
        txs: [tx],
        logId: `${logMetadata.logId}-${makeid(5)}`,
      });
    }

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
