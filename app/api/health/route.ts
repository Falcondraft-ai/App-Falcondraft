import {
  createHealthResponse,
  getDeploymentEnvironment,
  getHealthTimestamp,
} from "./_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  return createHealthResponse({
    status: "ok",
    service: "falcondraft-app",
    timestamp: getHealthTimestamp(),
    environment: getDeploymentEnvironment(),
  });
}
