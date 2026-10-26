import json
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv
from web3 import Web3

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

load_dotenv(BACKEND_DIR / ".env")

RPC_URL = os.getenv("FUNDTRACE_RPC_URL", "http://127.0.0.1:8545")
CONTRACT_ADDRESS = os.getenv("FUNDTRACE_CONTRACT_ADDRESS", "")
PRIVATE_KEY = os.getenv("FUNDTRACE_PRIVATE_KEY", "")

ARTIFACT_PATH = (
    PROJECT_ROOT
    / "blockchain"
    / "artifacts"
    / "contracts"
    / "FundTraceLedger.sol"
    / "FundTraceLedger.json"
)


def main():
    if not CONTRACT_ADDRESS or not PRIVATE_KEY:
        raise RuntimeError(
            "Contract address or test key is missing from backend/.env"
        )

    w3 = Web3(
        Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 15})
    )

    if not w3.is_connected():
        raise RuntimeError("Cannot connect to the local Hardhat node.")

    if w3.eth.chain_id != 31337:
        raise RuntimeError("Wrong chain. Expected local Hardhat chain 31337.")

    with ARTIFACT_PATH.open("r", encoding="utf-8") as file:
        artifact = json.load(file)

    account = w3.eth.account.from_key(PRIVATE_KEY)

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(CONTRACT_ADDRESS),
        abi=artifact["abi"],
    )

    if account.address.lower() != contract.functions.owner().call().lower():
        raise RuntimeError("Configured account is not the contract owner.")

    project_id = "PRJ-001"

    if contract.functions.projects(project_id).call()[7] == 0:
        raise RuntimeError(f"Project {project_id} does not exist.")

    donation_id = "TEST-" + secrets.token_hex(8).upper()
    commitment_hash = Web3.keccak(secrets.token_bytes(32))

    print("Network: Hardhat Local")
    print("Project:", project_id)
    print("Test donation ID:", donation_id)
    print("Submitting blinded commitment...")

    transaction = contract.functions.anchorDonationCommitmentBlinded(
        donation_id,
        project_id,
        commitment_hash,
    ).build_transaction(
        {
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "chainId": w3.eth.chain_id,
            "gas": 300000,
            "gasPrice": w3.eth.gas_price,
        }
    )

    signed = account.sign_transaction(transaction)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

    print("Transaction hash:", tx_hash.hex())
    print("Transaction status:", receipt.status)
    print("Block number:", receipt.blockNumber)

    if receipt.status != 1:
        raise RuntimeError("The transaction failed.")

    result = contract.functions.verifyDonationCommitment(
        donation_id,
        commitment_hash,
    ).call()

    print("\nCommitment verification")
    print("Matches:", result[0])
    print("Project ID:", result[1])
    print("Recorded block:", result[2])

    if not result[0] or result[1] != project_id:
        raise RuntimeError("Commitment verification failed.")

    print("\nSUCCESS: Blinded commitment recorded and verified.")


if __name__ == "__main__":
    main()
