import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const privateKey = (process.env.SEPOLIA_PRIVATE_KEY || "").trim();

const validPrivateKey =
  /^(0x)?[0-9a-fA-F]{64}$/.test(privateKey);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    hardhat: {
      chainId: 31337,
    },

    localhost: {
      url: "http://127.0.0.1:8545",
    },

    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "http://127.0.0.1:8545",
      chainId: 11155111,
      accounts: validPrivateKey
        ? [
            privateKey.startsWith("0x")
              ? privateKey
              : `0x${privateKey}`,
          ]
        : [],
    },
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
