import * as React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { DevoirConseilDocument } from "./devoir-conseil";
import type { AdviceDocumentData } from "@/lib/broker/advice-document";

/**
 * Renders the devoir de conseil. One single output: the electronic-signature
 * field is positioned by coordinates (lib/broker/pdf/signature-area.ts), not by
 * an invisible text tag, so the document the client signs is byte-for-byte the
 * document that gets emailed and archived.
 */
export async function renderDevoirConseilPdf(
  data: AdviceDocumentData,
  logo?: Buffer | null,
): Promise<Buffer> {
  return renderToBuffer(<DevoirConseilDocument data={data} logo={logo} />);
}
