"use client";

export function ReceiptUpload({ receiptName, onReceiptName, onReceiptDataUrl }: { receiptName: string; onReceiptName: (name: string) => void; onReceiptDataUrl: (dataUrl: string) => void }) {
  function readReceipt(file: File) {
    onReceiptName(file.name);
    const reader = new FileReader();
    reader.onload = () => onReceiptDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <h2>Payment</h2>
      <p className="step-copy">Make payment to the account below and upload your receipt.</p>
      <div className="bank-card">
        <div>
          <span>Account Name</span>
          <strong>HOUR COFFEE</strong>
        </div>
        <div>
          <span>Account No.</span>
          <strong>3242195227</strong>
        </div>
        <div>
          <span>Bank</span>
          <strong>Public Bank Berhad</strong>
        </div>
      </div>
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
