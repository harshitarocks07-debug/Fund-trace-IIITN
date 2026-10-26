
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from web3 import Web3

# Load backend environment variables
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

load_dotenv(BACKEND_DIR / ".env")

RPC_URL = os.getenv("FUNDTRACE_RPC_URL", "http://127.0.0.1:8545")
CONTRACT_ADDRESS = os.getenv("FUNDTRACE_CONTRACT_ADDRESS", "")
EXPECTED_CHAIN_ID = int(os.getenv("FUNDTRACE_CHAIN_ID", "31337"))

ARTIFACT_PATH = (
    PROJECT_ROOT
    / "blockchain"
    / "artifacts"
    / "contracts"
    / "FundTraceLedger.sol"
    / "FundTraceLedger.json"
)


def main():
    print("Connecting to FundTrace blockchain...")

    w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 10}))

    if not w3.is_connected():
        raise RuntimeError("Cannot connect to the blockchain RPC.")

    actual_chain_id = w3.eth.chain_id

    print(f"RPC connection: OK")
    print(f"Chain ID: {actual_chain_id}")

    if actual_chain_id != EXPECTED_CHAIN_ID:
        raise RuntimeError(
            f"Wrong network. Expected {EXPECTED_CHAIN_ID}, "
            f"received {actual_chain_id}."
        )

    if not Web3.is_address(CONTRACT_ADDRESS):
        raise RuntimeError("FUNDTRACE_CONTRACT_ADDRESS is invalid.")

    contract_address = Web3.to_checksum_address(CONTRACT_ADDRESS)

    if not ARTIFACT_PATH.is_file():
        raise FileNotFoundError(f"Contract artifact not found: {ARTIFACT_PATH}")

    with ARTIFACT_PATH.open("r", encoding="utf-8") as file:
        artifact = json.load(file)

    abi = artifact.get("abi")
    if not abi:
        raise RuntimeError("Contract ABI is missing from the artifact.")

    contract_code = w3.eth.get_code(contract_address)
    if not contract_code:
        raise RuntimeError(
            f"No contract code found at {contract_address} "
            f"on chain {actual_chain_id}."
        )

    contract = w3.eth.contract(address=contract_address, abi=abi)

    print(f"Contract address: {contract_address}")
    print(f"Contract code: FOUND ({len(contract_code)} bytes)")
    print(f"ABI loaded: OK")

    functions = [
        item["name"]
        for item in abi
        if item.get("type") == "function"
    ]

    print("Available contract functions:")
    for name in sorted(set(functions)):
        print(f"  - {name}")

    print("\nSUCCESS: Blockchain connection and contract loading passed.")
    print("No transaction was submitted.")


if __name__ == "__main__":
    main()

