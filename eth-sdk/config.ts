import { defineConfig } from '@dethcrypto/eth-sdk';

export default defineConfig({
	outputPath: 'src/eth-sdk-build',
	contracts: {
		goerli: {
			jobA: '0xd50345ca88e0B2cF9a6f5eD29C1F1f9d76A16C3c',
			jobAStealth: '0x9DC52d978290f13b73692C5AeA21B4C8954e909A',
			stealthRelayer: '0xD44A48001A4BAd6f23aD8750eaD0036765A35d4b',
			jobStrategies: '0x8CeA64dc82515D56c22d072167Da44Abd3211B6f',
		},
	},
});
