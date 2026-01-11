import type { jsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";

export type SavePdfResult = "shared" | "downloaded";

/**
 * Saves a jsPDF document.
 * - Web: triggers a normal browser download.
 * - Native (Capacitor): writes the file to app Documents and opens the share sheet so users can save/open it.
 */
export async function savePdfDocument(doc: jsPDF, filename: string): Promise<SavePdfResult> {
  const safeName = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;

  // Capacitor webviews typically don't support blob <a download> reliably.
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);

    const dataUri = doc.output("datauristring");
    const base64 = dataUri.split(",")[1];

    if (!base64) {
      throw new Error("Failed to generate PDF data");
    }

    await Filesystem.writeFile({
      path: safeName,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });

    const { uri } = await Filesystem.getUri({
      path: safeName,
      directory: Directory.Documents,
    });

    await Share.share({
      title: safeName,
      text: "PDF report",
      url: uri,
      dialogTitle: "Share / Save PDF",
    });

    return "shared";
  }

  const pdfBlob = doc.output("blob");
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return "downloaded";
}
