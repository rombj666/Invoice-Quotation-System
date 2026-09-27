"use client";

const HOUR_COFFEE_ACCOUNT = {
  accountName: "HOUR COFFEE",
  accountNo: "3242195227",
  bank: "Public Bank Berhad"
};

export function ReceiptUpload({
  receiptName,
  receiptAmount,
  receiptAccount,
  receiptBank,
  expectedAmount,
  onReceiptName,
  onReceiptAmount,
  onReceiptAccount,
  onReceiptBank,
  onReceiptDataUrl
}: {
  receiptName: string;
  receiptAmount: string;
  receiptAccount: string;
  receiptBank: string;
  expectedAmount: number;
  onReceiptName: (name: string) => void;
  onReceiptAmount: (value: string) => void;
  onReceiptAccount: (value: string) => void;
  onReceiptBank: (value: string) => void;
  onReceiptDataUrl: (dataUrl: string) => void;
}) {
  function readReceipt(file: File) {
    onReceiptName(file.name);
    const reader = new FileReader();
    reader.onload = () => onReceiptDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  const enteredAmount = Number(receiptAmount);
  const amountInvalid = receiptAmount.trim() !== "" && !Number.isFinite(enteredAmount);
  const amountDiffers = receiptAmount.trim() !== "" && Number.isFinite(enteredAmount) && Math.abs(enteredAmount - expectedAmount) > 0.01;
  const accountDiffers = receiptAccount.trim() !== "" && receiptAccount.trim().replace(/\s/g, "") !== HOUR_COFFEE_ACCOUNT.accountNo;

  return (
    <div>
      <h2>Payment</h2>
      <p className="step-copy">Make payment to the account below, enter the receipt amount and upload your receipt.</p>
      <div className="bank-card">
        <div>
          <span>Account Name</span>
          <strong>{HOUR_COFFEE_ACCOUNT.accountName}</strong>
        </div>
        <div>
          <span>Account No.</span>
          <strong>{HOUR_COFFEE_ACCOUNT.accountNo}</strong>
        </div>
        <div>
          <span>Bank</span>
          <strong>{HOUR_COFFEE_ACCOUNT.bank}</strong>
        </div>
      </div>

      <label className="hc-field">
        <span>Receipt amount (RM)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={receiptAmount}
          onChange={(event) => onReceiptAmount(event.target.value)}
          placeholder={`Expected: RM ${expectedAmount.toFixed(2)}`}
        />
      </label>
      <label className="hc-field">
        <span>Payer account number</span>
        <input
          value={receiptAccount}
          onChange={(event) => onReceiptAccount(event.target.value)}
          placeholder={HOUR_COFFEE_ACCOUNT.accountNo}
        />
      </label>
      <label className="hc-field">
        <span>Payer bank</span>
        <input
          value={receiptBank}
          onChange={(event) => onReceiptBank(event.target.value)}
          placeholder={HOUR_COFFEE_ACCOUNT.bank}
        />
      </label>

      {amountInvalid ? <p className="verification-warning">Please enter a valid receipt amount.</p> : null}
      {amountDiffers ? <p className="verification-warning">The receipt amount does not match the invoice total (RM {expectedAmount.toFixed(2)}). This receipt will be marked for manual review.</p> : null}
      {accountDiffers ? <p className="verification-warning">The payer account number does not match our recorded account. This receipt will be marked for manual review.</p> : null}
      {!amountInvalid && !amountDiffers && !accountDiffers && receiptAmount.trim() !== "" ? <p className="verification-ok">Amount and account match our records. This receipt can be verified automatically.</p> : null}

      <label className="upload-box">
        <strong>Tap to upload receipt</strong>
        <span>PDF, JPG or PNG</span>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) readReceipt(file);
          }}
        />
      </label>
      {receiptName ? <p className="upload-ok">Uploaded: {receiptName}</p> : null}
    </div>
  );
}
