import { jsPDF } from "jspdf";

/**
 * Anchoran's "Print" action: renders plain text into a real PDF
 * (client-side, via jsPDF — no server, no native print dialog) and
 * hands it to the main process to open with the user's actual Windows
 * PDF viewer, the same as double-clicking a PDF anywhere else.
 */
export async function printTextAsPdf(title: string, body: string) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginX = 56;
  const marginTop = 64;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, marginX, marginTop);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(body || "(empty)", maxWidth) as string[];

  let y = marginTop + 28;
  const lineHeight = 15;
  for (const line of lines) {
    if (y > pageHeight - 56) {
      doc.addPage();
      y = marginTop;
    }
    doc.text(line, marginX, y);
    y += lineHeight;
  }

  const fileName = `${title.replace(/[\\/:*?"<>|]/g, "_") || "Document"}.pdf`;

  if (typeof window !== "undefined" && window.anchoran) {
    const base64 = doc.output("datauristring").split(",")[1];
    const result = await window.anchoran.saveAndOpenFile(fileName, base64);
    return result;
  }

  // Plain-browser preview fallback: open the PDF in a new tab instead.
  doc.output("dataurlnewwindow");
  return { success: true };
}
