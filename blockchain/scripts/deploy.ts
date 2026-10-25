import { ethers, network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

async function main() {
  console.log("Deploying FundTraceLedger smart contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const FundTraceLedger = await ethers.getContractFactory("FundTraceLedger");
  const ledger = await FundTraceLedger.deploy();
  await ledger.waitForDeployment();

  const ledgerAddress = await ledger.getAddress();
  const deploymentTx = ledger.deploymentTransaction();

  console.log("FundTraceLedger deployed to:", ledgerAddress);

  // Register a sample project.
  const registerTx = await ledger.registerProject(
    "PRJ-001",
    "Rural School Construction",
    deployer.address,
    1_000_000
  );

  await registerTx.wait();
  console.log("Sample project PRJ-001 registered on-chain.");

  // Save deployment information.
  const deploymentInfo = {
    contractName: "FundTraceLedger",
    address: ledgerAddress,
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    deploymentTransaction: deploymentTx?.hash ?? null,
    projectId: "PRJ-001",
    deployedAt: new Date().toISOString(),
  };

  const outputDirectory = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outputDirectory, { recursive: true });

  const outputFile = path.join(
    outputDirectory,
    `${network.name}.json`
  );

  fs.writeFileSync(
    outputFile,
    JSON.stringify(deploymentInfo, null, 2),
    "utf8"
  );

  console.log("Deployment information saved to:", outputFile);
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
