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

/** DocuSeal text tag dropped (invisibly) in the client signature box when
 *  rendering the "for signature" variant. The role MUST match the submitter
 *  role used in lib/broker/docuseal.ts. */
const CLIENT_SIGNATURE_TAG = "{{Signature;role=Client;type=signature}}";

export async function renderDevoirConseilPdf(
  data: AdviceDocumentData,
  logo?: Buffer | null,
  opts?: { forSignature?: boolean },
): Promise<Buffer> {
  return renderToBuffer(
    <DevoirConseilDocument
      data={data}
      logo={logo}
      signatureTag={opts?.forSignature ? CLIENT_SIGNATURE_TAG : null}
    />,
  );
}
