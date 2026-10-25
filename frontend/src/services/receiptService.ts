import type { ReceiptMetadata, ReceiptVerifyResponse, ReceiptOCRResult } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedType?: string;
}

export const receiptService = {
  validateFile(file: File): FileValidationResult {
    if (!file) {
      return { valid: false, error: "No file selected." };
    }

    if (file.size === 0) {
      return { valid: false, error: "The selected file is empty (0 bytes)." };
    }

    if (file.size > MAX_RECEIPT_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `File size (${sizeMB} MB) exceeds maximum allowed limit of 10 MB.`
      };
    }

    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: `File type '${ext}' is not supported. Please upload a PDF, PNG, JPG, or WEBP document.`
      };
    }

    // Verify declared MIME type if present
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `MIME type '${file.type}' is not recognized as a valid receipt format.`
      };
    }

    return {
      valid: true,
      detectedType: ext === ".pdf" ? "PDF Document" : "Receipt Image"
    };
  },

  async computeFileSha256(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const digestBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(digestBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  },

  async extractReceiptOCR(file: File): Promise<ReceiptOCRResult> {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || "File validation failed.");
    }

    const token = localStorage.getItem("fundtrace_auth_token");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${BASE_URL}/receipts/ocr-extract`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        let errDetail = `OCR extraction failed with status ${response.status}`;
        try {
          const json = await response.json();
          if (json.detail) {
            errDetail = typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail);
          }
        } catch {
          // Fallback
        }
        throw new Error(errDetail);
      }

      return (await response.json()) as ReceiptOCRResult;
    } catch (err: unknown) {
      // Offline fallback: try reading text from file
      if (err instanceof TypeError && err.message.includes("fetch")) {
        return this.fallbackClientSideOCR(file);
      }
      throw err;
    }
  },

  async triggerStoredReceiptOCR(receiptId: string): Promise<ReceiptOCRResult> {
    const token = localStorage.getItem("fundtrace_auth_token");
    const response = await fetch(`${BASE_URL}/receipts/${receiptId}/ocr`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to run OCR on receipt ${receiptId}`);
    }

    return (await response.json()) as ReceiptOCRResult;
  },

  async fallbackClientSideOCR(file: File): Promise<ReceiptOCRResult> {
    try {
      const text = await file.text();
      const vendorMatch = text.match(/(?:Vendor|Merchant|Billed\s*By|From)[\s.:\-]+([^\n\r]+)/i);
      const invMatch = text.match(/(?:Invoice|Inv|Bill|Receipt)[\s.:\-]*(?:No|Num|#)?[\s.:\-]*([A-Za-z0-9\-_]+)/i);
      const dateMatch = text.match(/(?:Date)[\s.:\-]*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i);
      const amtMatch = text.match(/(?:Total|Amount)[\s.:\-]*(?:INR|Rs\.?|₹)?[\s]*([0-9,]+(?:\.[0-9]{2})?)/i);

      let amountVal: number | undefined = undefined;
      if (amtMatch) {
        amountVal = parseFloat(amtMatch[1].replace(/,/g, ""));
      }

      const warnings: string[] = [];
      if (!vendorMatch) warnings.push("Vendor could not be recognized.");
      if (!invMatch) warnings.push("Invoice number not found.");
      if (!dateMatch) warnings.push("Date not found.");
      if (amountVal === undefined) warnings.push("Amount not found.");

      return {
        vendor: vendorMatch ? vendorMatch[1].trim() : undefined,
        invoiceNumber: invMatch ? invMatch[1].trim() : undefined,
        date: dateMatch ? dateMatch[1].trim() : undefined,
        amount: amountVal,
        confidence: amountVal ? 0.75 : 0.4,
        ocrStatus: "COMPLETED",
        rawText: text.slice(0, 400),
        warnings,
      };
    } catch {
      return {
        confidence: 0.0,
        ocrStatus: "FAILED",
        warnings: ["Client-side fallback could not parse file."],
      };
    }
  },

  async uploadReceipt(file: File, expenseId?: string): Promise<ReceiptMetadata> {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || "File validation failed.");
    }

    const token = localStorage.getItem("fundtrace_auth_token");
    const formData = new FormData();
    formData.append("file", file);
    if (expenseId) {
      formData.append("expense_id", expenseId);
    }

    try {
      const response = await fetch(`${BASE_URL}/receipts/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        let errDetail = `Upload failed with status ${response.status}`;
        try {
          const json = await response.json();
          if (json.detail) {
            errDetail = typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail);
          }
        } catch {
          // Fallback
        }
        throw new Error(errDetail);
      }

      return (await response.json()) as ReceiptMetadata;
    } catch (err: unknown) {
      // Offline fallback: compute SHA-256 in browser and return simulated receipt metadata
      if (err instanceof TypeError && err.message.includes("fetch")) {
        const hash = await this.computeFileSha256(file);
        return {
          id: `RCP-${Date.now().toString().slice(-4)}`,
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type || "application/octet-stream",
          sha256_hash: hash,
          expense_id: expenseId,
          created_at: new Date().toISOString(),
        };
      }
      throw err;
    }
  },

  getReceiptDownloadUrl(receiptId: string): string {
    return `${BASE_URL}/receipts/${receiptId}/download`;
  },

  async verifyReceiptHash(receiptHash: string): Promise<ReceiptVerifyResponse> {
    const token = localStorage.getItem("fundtrace_auth_token");
    const response = await fetch(`${BASE_URL}/receipts/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ receiptHash }),
    });

    if (!response.ok) {
      throw new Error(`Verification failed (${response.status})`);
    }

    return (await response.json()) as ReceiptVerifyResponse;
  },

  formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
};
