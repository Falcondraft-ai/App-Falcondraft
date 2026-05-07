import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

function findLocalChromeExecutable() {
  const chromeRoot = join(process.cwd(), ".cache", "browsers", "chrome");

  if (!existsSync(chromeRoot)) {
    return undefined;
  }

  const versions = readdirSync(chromeRoot).sort().reverse();

  for (const version of versions) {
    const executable = join(chromeRoot, version, "chrome-linux64", "chrome");

    if (existsSync(executable)) {
      return executable;
    }
  }

  return undefined;
}

const localChromeExecutable = findLocalChromeExecutable();
const localBrowserLibraryPath = join(
  process.cwd(),
  ".cache",
  "browser-libs",
  "usr",
  "lib",
  "x86_64-linux-gnu",
);
const launchEnvironment =
  localChromeExecutable && existsSync(localBrowserLibraryPath)
    ? {
        ...process.env,
        LD_LIBRARY_PATH: [localBrowserLibraryPath, process.env.LD_LIBRARY_PATH]
          .filter(Boolean)
          .join(":"),
      }
    : undefined;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    launchOptions: localChromeExecutable
      ? {
          executablePath: localChromeExecutable,
          env: launchEnvironment,
        }
      : undefined,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
