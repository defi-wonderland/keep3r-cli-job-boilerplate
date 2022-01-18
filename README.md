[![image](https://img.shields.io/npm/v/@defi-wonderland/keep3r-cli-job-boilerplate.svg?style=flat-square)](https://www.npmjs.org/package/@defi-wonderland/keep3r-cli-job-boilerplate)

# Keep3r CLI Job Boilerplate

`@defi-wonderland/keep3r-cli-job-boilerplate` aims to provide protocols an easy way of creating a CLI compatible job, just start by forking this repo.

As well, this repository includes testnet jobs that can be installed and tested without any real costs.


## Using testnet jobs

This repository comes with some jobs deployed to goerli that serve as a safe and easy way to test whether users running Keep3r CLI have setup their keepers correctly. These jobs are:

- [Job A](https://github.com/defi-wonderland/keep3r-cli-job-boilerplate/blob/main/src/goerli/job-a/README.md)
- [Job A Stealth](https://github.com/defi-wonderland/keep3r-cli-job-boilerplate/blob/main/src/goerli/job-a-stealth/README.md)
- [Job Strategies](https://github.com/defi-wonderland/keep3r-cli-job-boilerplate/blob/main/src/goerli/job-strategies/README.md)


## Creating a new job

1. Fork this repository
2. Update organization and package name inside:
* `package.json`
* `README.md`
* `LICENSE`
3. Create a github repository and add a secret named `NPM_TOKEN`

    This token can be generated in [npmjs.com](https://www.npmjs.com) -> account -> access tokens -> generate new token -> add name and select the publish type
4. Update `eth-sdk/config.ts` with your relevant contracts and chain
5. Adapt `src` to fit your job while maintaining the same structure
6. As soon as you merge into a branch called `main`, a deployment to npm will occur



## Job specifics

- `metadata.json`: Super simple `.json` file containing the name of the job. This is an example of how it would look like if your job was called `My First Job`.
    
    ```bash
    {
      "name": "My First Job"
    }
    ```
    
    Right now this file seems unimportant, but in future versions it will be used to add extra information about each specific job. An example of this, would be the tokens the job uses to pay the keepers—right now we assume they pay in KP3R or ETH—which will help the Keep3r-CLI properly calculate the profitability of the transaction. In the current version, the name is used to create an id for each job, which will help the Keep3r-CLI know which job is currently in progress to avoid rerunning it unnecessarily. 
    
- `job.ts`: This file will contain the logic of the job script, and therefore it will be the file the Keep3r-CLI runs when it intends to work your job. Writing the logic in this file can sound like a daunting task at first, but we have built everything so that there's a lot of shared logic between scripts, which makes creating a script for your job a simple task. 
After going through the examples you will find that all the jobs follow a similar pattern to this one:
    - Declare a variable that contains the address of your job.
    - Create an async function called `getWorkableTxs` which will take `args` as arguments. This function will contain all the important logic to create what we call **workable groups** and send them along with an id to the Keep3r-CLI.
    A workable group is an array that contains objects that have:
        - The target block at which to perform a transaction.
        - An array containing the populated transactions to be performed
        - An id to identify each array in the workable group, so it's easier for keepers to read the logs.
        
        For example, let's say `ExampleJob` needs a keeper to call the `work` function and let's say the keeper establishes `100` as the target block. When a keeper executes `getWorkableTxs`, this function will output the following working group:
        
        ```bash
        workableGroup = [{
        	targetBlock: 100,
        	txs: [populated tx data to call work],
        	logId: some randomly generated id
        }]
        ```
        
        This working group will then be passed to the Keep3r-CLI `job-wrapper.ts` file, for additional checks before sending the transactions to flashbots.
        **All of the following points will be different points of logic inside `getWorkableTxs`**
        
    - Create a `correlationId`, which will be used to track if the current job being executed to avoid rerunning it unnecessarily.
    - Create an if check that checks, using the `correlationId`, whether that job should be rerun in a block or not. For example: the keeper runs your job at block `100`, but specifies `105` as its target block. The `correlationId` and this additional check will prevent all the logic to check whether the job is workable or not from being rerun in the blocks `101, 102, 103, 104`, where it's not necessary.
    - Create a variable `logMetadata` containing all the relevant information you would like the keeper to see in their logs. We recommend creating an object containing the name of your job, the current block, and a logId to help identify each job.
    - Create a `logConsole` variable that calls the `prelog` utility function passing in the `logMetadata` as an argument. This is simply used to log better logs. It appends all the information established in `logMetadata` to each log that uses `logConsole` instead of `console.log`
    - Create a variable containing your job's contract. This will be used to populate the transactions the keeper will end up running.
    - Create a try catch finally statement.
    - The try statement will call the `work` function to check if, in the current block, that job can be worked or if it's on cooldown. If it is workable, it adds a log and then creates a `workableGroup` variable initialized to an empty array.
    Things get interesting after this. Because we know the job is workable, we can now populate the transactions we will need to send to flashbots in order to execute this job, and then push an object containing those transactions along with the target block and id of each one to our `workableGroup`. 
    To populate transactions for consequent blocks we use a for loop that will push as many objects to `workableGroups` as the keeper has passed as the `bundleBurst` parameter. In these objects, the array of populated transactions will always be the same, but the target block and the id will change.
    If everything went well, `getWorkableTxs` sends an object containing the workable groups and the current job `correlationId` to the Keep3r-CLI, which will be received by `job-wrapper.ts`.
    - The catch statement will catch any error and log out a message for the keeper to read. The most common error that will occur is that the job is currently in cooldown, therefore it can't be worked.
    - The finally statement will kill the process once it has concluded.
    - Lastly, and outside the `getWorkableTxs` function, we export `getWorkableTxs`.
    
    This is the shared structure among jobs and it's exactly the structure that can be found in the `JobA` example we provide. However, some jobs will have protocol-specific logic that will modify this structure ever-so-slightly. 
    
    For example: some jobs will have multiple strategies that need to be run. Others will require the keeper to call a function before calling the `work` function. For these two cases we have provided examples that show how to modify the basic structure to add protocol-specific features:
    
    - Strategies are covered in `harvest-v2`, `tend-v2`, `tend-v2-2`.
    - Jobs that require a previous function to be called is covered in `dca`
    - Jobs that use relayers are covered in `harvest-v2`, `jobAStealth`

If you still have doubts as to how to implement a script for your job, reach out to us!
