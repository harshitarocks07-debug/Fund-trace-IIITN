import json
import os
from pathlib import Path

from dotenv import load_dotenv
from web3 import Web3

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

load_dotenv(BACKEND_DIR / ".env")

rpc_url = os.getenv("FUNDTRACE_RPC_URL", "http://127.0.0.1:8545")
contract_address = os.getenv("FUNDTRACE_CONTRACT_ADDRESS", "")

artifact_path = (
    PROJECT_ROOT
    / "blockchain"
    / "artifacts"
    / "contracts"
    / "FundTraceLedger.sol"
    / "FundTraceLedger.json"
)


def main():
    if not contract_address:
        raise RuntimeError("Contract address is missing from backend/.env")

    if not artifact_path.is_file():
        raise FileNotFoundError(f"Artifact not found: {artifact_path}")

    w3 = Web3(
        Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 10})
    )

    if not w3.is_connected():
        raise RuntimeError("Cannot connect to Hardhat. Check that it is running.")

    with artifact_path.open("r", encoding="utf-8") as file:
        artifact = json.load(file)

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(contract_address),
        abi=artifact["abi"],
    )

    print("Connected to blockchain")
    print("Chain ID:", w3.eth.chain_id)
    print("Contract owner:", contract.functions.owner().call())

    count = contract.functions.getProjectCount().call()
    print("Registered project count:", count)

    project_id = input(
        "Enter a project ID to inspect, or press Enter to skip: "
    ).strip()

    if project_id:
        try:
            summary = contract.functions.getProjectSummary(project_id).call()
            print("\nProject summary")
            print("----------------")
            print("Name:", summary[0])
            print("Budget:", summary[1])
            print("Total donated:", summary[2])
            print("Approved spending:", summary[3])
            print("Active:", summary[4])
        except Exception as error:
            print("Could not retrieve project:", error)

    print("\nRead-only test completed.")
    print("No transaction was submitted.")


if __name__ == "__main__":
    main()
