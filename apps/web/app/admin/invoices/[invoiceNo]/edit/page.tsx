"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminSectionEditor } from "../../../../../components/admin/AdminSectionEditor";
import { Card } from "../../../../../components/common/Card";
import { InvoicePreview } from "../../../../../components/invoice/InvoicePreview";
import { updateAdminInvoice, uploadAdminInvoiceReceipt } from "../../../../../lib/admin-api";
import { loadInvoiceByNo } from "../../../../../lib/invoice-storage";
import { generatePdfBlob } from "../../../../../lib/pdf-document";
import type { InvoiceDetails } from "../../../../../types/invoice";

export default function AdminInvoiceEditPage() {
  const params = useParams<{ invoiceNo: string }>();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("reference");
  const [data, setData] = useState<InvoiceDetails | null>(null);
  const [error, setError] = useState(""); const [success,setSuccess]=useState(""); const [saving,setSaving]=useState(false);
  const [receiptFile, setReceiptFile] = useState<File>(); const [uploadingReceipt, setUploadingReceipt] = useState(false);
  useEffect(()=>{loadInvoiceByNo(params.invoiceNo).then(setData).catch(()=>setError("Unable to load invoice."));},[params.invoiceNo]);
  if(!data)return <main className="admin-page"><Card className="admin-card"><h1>Edit Invoice</h1><p>{error||"Loading..."}</p></Card></main>;
  const patch=(value:Partial<InvoiceDetails>)=>setData(current=>current?{...current,...value}:current);
  const customer=data.quotation.customer;
  const updateCustomer=(key:keyof typeof customer,value:string)=>patch({quotation:{...data.quotation,customer:{...customer,[key]:value}}});
  async function save(){const currentData=data;if(!currentData)return;if(!window.confirm("Save these invoice changes and replace the current invoice PDF?"))return;setSaving(true);setError("");setSuccess("");try{const pdf=await generatePdfBlob("adminInvoiceEditPreview",{filename:`Hour-Coffee-Invoice-${currentData.invoiceNo}.pdf`});const updated=await updateAdminInvoice(params.invoiceNo,currentData,pdf);setData(updated);setSuccess("Invoice updated and PDF replaced successfully.");if(updated.invoiceNo!==params.invoiceNo)router.replace(`/admin/invoices/${updated.invoiceNo}/edit`);}catch(saveError){setError(saveError instanceof Error?saveError.message:"Unable to update invoice.");}finally{setSaving(false);}}
  async function uploadReceipt(){if(!receiptFile)return setError("Choose a PDF, JPG or PNG receipt.");setUploadingReceipt(true);setError("");setSuccess("");try{const updated=await uploadAdminInvoiceReceipt(params.invoiceNo,receiptFile);setData(updated);setReceiptFile(undefined);setSuccess("Payment receipt uploaded. Customization link is now enabled.");}catch(uploadError){setError(uploadError instanceof Error?uploadError.message:"Unable to upload payment receipt.");}finally{setUploadingReceipt(false);}}
  return <main className="admin-page"><Card className="admin-card admin-edit-card">
    <AdminSectionEditor
      title={`Edit ${params.invoiceNo}`}
      backHref={`/admin/invoices/${params.invoiceNo}`}
      activeSection={activeSection} onSectionChange={setActiveSection} saving={saving} onSave={save}
      sections={[
        { id: "reference", label: "Reference & Status", content: (<section><h2>Reference & Status</h2><label className="admin-field"><span>Invoice number</span><input value={data.invoiceNo} onChange={event=>patch({invoiceNo:event.target.value.toUpperCase()})} /></label><label className="admin-field"><span>Invoice-specific reference</span><input value={data.invoiceReference??""} onChange={event=>patch({invoiceReference:event.target.value})} /></label><label className="admin-field"><span>Invoice status</span><input readOnly value={(data.invoiceStatus ?? "SUBMITTED").replaceAll("_", " ")} /></label><label className="admin-field"><span>Invoice discount percent</span><input type="number" min="0" max="100" step="0.01" value={data.quotation.discountPercent} onChange={event=>patch({quotation:{...data.quotation,discountPercent:Number(event.target.value)}})} /></label></section>) },
        { id: "customer", label: "Customer & Billing", content: (<section><h2>Customer & Billing</h2>{([['name','Name'],['phone','Phone'],['email','Email'],['companyName','Company'],['companyRegNo','Company registration'],['billingAddress','Billing address']] as const).map(([key,label])=><label className="admin-field" key={key}><span>{label}</span><input value={customer[key]} onChange={event=>updateCustomer(key,event.target.value)} /></label>)}</section>) },
        { id: "event", label: "Event Details", content: (<section><h2>Event Details</h2><label className="admin-field"><span>Event address</span><textarea rows={3} value={data.eventAddress} onChange={event=>patch({eventAddress:event.target.value})} /></label><label className="admin-field"><span>Dress code</span><input value={data.dressCode} onChange={event=>patch({dressCode:event.target.value})} /></label><label className="admin-field"><span>Custom dress code</span><input value={data.customDressCode} onChange={event=>patch({customDressCode:event.target.value})} /></label><label className="admin-field"><span>Environment</span><input value={data.environment} onChange={event=>patch({environment:event.target.value})} /></label><label className="admin-field"><span>Environment notes</span><textarea rows={3} value={data.environmentNotes} onChange={event=>patch({environmentNotes:event.target.value})} /></label></section>) },
        { id: "payment", label: "Payment", content: (<section><h2>Payment</h2><p>Receipt status: {data.receiptUrl || data.receiptDataUrl ? "Uploaded" : "Not uploaded"}</p>{data.receiptUrl || data.receiptDataUrl ? <p><a href={data.receiptUrl || data.receiptDataUrl} target="_blank" rel="noreferrer">View / Download {data.receiptName || "receipt"}</a></p> : null}<label className="admin-field"><span>{data.receiptUrl || data.receiptDataUrl ? "Replace payment receipt" : "Upload payment receipt"}</span><input type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" onChange={event=>setReceiptFile(event.target.files?.[0])} /></label>{receiptFile ? <p>{receiptFile.name}</p> : null}<button type="button" className="hc-button hc-button-primary" disabled={!receiptFile||uploadingReceipt} onClick={uploadReceipt}>{uploadingReceipt?"UPLOADING...":"UPLOAD RECEIPT"}</button><p className="admin-muted">Uploading the receipt marks it as received and enables the customization link.</p></section>) },
        { id: "note", label: "Internal Note", content: (<section><h2>Internal Note</h2><label className="admin-field"><span>New note</span><textarea rows={5} value={data.internalNote??""} onChange={event=>patch({internalNote:event.target.value})} /></label><p className="admin-muted">Saving adds this note to the audit trail. Existing notes remain intact.</p></section>) },
        { id: "preview", label: "Preview", content: (<section className="admin-editor-preview"><h2>Invoice Preview</h2><InvoicePreview invoiceNo={data.invoiceNo} quotation={data.quotation} invoice={data} documentId="adminInvoiceEditLive" showDownloadButton={false} /></section>) },
      ]}
    >
      <p className="admin-muted">The original quotation and payment receipt will not be changed.</p>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {success ? <div className="ok-summary">{success}</div> : null}
    </AdminSectionEditor>
    <div className="print-document" aria-hidden="true"><InvoicePreview invoiceNo={data.invoiceNo} quotation={data.quotation} invoice={data} documentId="adminInvoiceEditPreview" showDownloadButton={false} /></div>
  </Card></main>;
}
