import { ethers, network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

const VALIDATOR_COUNT = 5;

function configuredValidators(): string[] {
  const configured = (process.env.FUNDTRACE_VALIDATOR_ADDRESSES || "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);

  if (configured.length !== VALIDATOR_COUNT || configured.some((address) => !ethers.isAddress(address))) {
    throw new Error(
      `Set FUNDTRACE_VALIDATOR_ADDRESSES to exactly ${VALIDATOR_COUNT} comma-separated validator addresses.`,
    );
  }

  const checksummed = configured.map((address) => ethers.getAddress(address));
  if (new Set(checksummed.map((address) => address.toLowerCase())).size !== VALIDATOR_COUNT) {
    throw new Error("Validator addresses must be distinct.");
  }
  return checksummed;
}

async function main(): Promise<void> {
  const localNetwork = network.name === "hardhat" || network.name === "localhost";
  if (network.name === "sepolia" && !process.env.SEPOLIA_RPC_URL?.trim()) {
    throw new Error("SEPOLIA_RPC_URL must be configured before deploying to Sepolia.");
  }
  if (network.name === "polygonAmoy" && !process.env.POLYGON_AMOY_RPC_URL?.trim()) {
    throw new Error("POLYGON_AMOY_RPC_URL must be configured before deploying to Polygon Amoy.");
  }
  const actualChainId = Number((await ethers.provider.getNetwork()).chainId);
  const expectedChainId = network.name === "sepolia"
    ? 11155111
    : network.name === "polygonAmoy"
      ? 80002
      : actualChainId;
  if (actualChainId !== expectedChainId) {
    throw new Error(
      `Refusing deployment: connected chain ID ${actualChainId} does not match ${expectedChainId}.`,
    );
  }

  const validatorAddresses = localNetwork
    ? (await ethers.getSigners()).slice(0, VALIDATOR_COUNT).map((signer) => signer.address)
    : configuredValidators();

  const Escrow = await ethers.getContractFactory("FundTraceEscrow");
  const escrow = await Escrow.deploy(validatorAddresses);
  await escrow.waitForDeployment();

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const deploymentTx = escrow.deploymentTransaction();
  const deploymentInfo = {
    contractName: "FundTraceEscrow",
    address: await escrow.getAddress(),
    network: network.name,
    chainId,
    validators: validatorAddresses,
    quorum: 3,
    deploymentTransaction: deploymentTx?.hash ?? null,
    deployedAt: new Date().toISOString(),
  };

  const outputDirectory = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outputDirectory, { recursive: true });
  const outputFile = path.join(outputDirectory, `${network.name}-escrow.json`);
  fs.writeFileSync(outputFile, JSON.stringify(deploymentInfo, null, 2), "utf8");

  console.log("FundTraceEscrow deployed:", deploymentInfo.address);
  console.log("Deployment information saved to:", outputFile);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
