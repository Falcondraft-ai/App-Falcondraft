import { promises as fs } from "node:fs";
import path from "node:path";
import * as React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { DevoirConseilDocument } from "./devoir-conseil";
import type {
  AdviceDocumentData,
  CabinetInfo,
} from "@/lib/broker/advice-document";

/** Loads the cabinet logo (local public asset only, for now) as a Buffer. */
export async function loadCabinetLogo(
  cabinet: CabinetInfo,
): Promise<Buffer | null> {
  const url = cabinet.logoUrl?.trim();
  if (!url || !url.startsWith("/")) return null;
  try {
    const filePath = path.join(process.cwd(), "public", url.replace(/^\//, ""));
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

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
