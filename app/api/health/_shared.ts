import { NextResponse } from "next/server";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

type DeploymentEnvironment = "production" | "preview" | "development";

export function createHealthResponse<TPayload extends object>(
  payload: TPayload,
  status = 200,
) {
  return NextResponse.json(payload, {
    status,
    headers: noStoreHeaders,
  });
}

export function getHealthTimestamp() {
  return new Date().toISOString();
}

export function getDeploymentEnvironment(): DeploymentEnvironment {
  const vercelEnvironment = process.env.VERCEL_ENV;

  if (
    vercelEnvironment === "production" ||
    vercelEnvironment === "preview" ||
    vercelEnvironment === "development"
  ) {
    return vercelEnvironment;
  }

  return process.env.NODE_ENV === "production" ? "production" : "development";
}
