import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobile-iphone14", width: 375, height: 812 },
  { name: "mobile-pixel7", width: 412, height: 915 },
  { name: "mobile-iphone-se", width: 360, height: 780 },
  { name: "tablet-ipad", width: 768, height: 1024 },
  { name: "desktop-small", width: 1280, height: 800 },
  { name: "desktop-large", width: 1440, height: 900 },
] as const;

const ROUTES = [
  { path: "/", name: "home" },
  { path: "/login", name: "login" },
  { path: "/dashboard", name: "dashboard" },
  { path: "/dashboard/deals", name: "deals" },
  {
    path: "/dashboard/deals/00000000-0000-0000-0000-000000000000",
    name: "deal-detail",
  },
  { path: "/dashboard/transcripts", name: "transcripts" },
  { path: "/dashboard/settings", name: "settings" },
] as const;

// Allowance for sub-pixel rounding noise from various layout engines.
const OVERFLOW_TOLERANCE_PX = 2;

test.describe("Responsive layout", () => {
  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
      });

      for (const route of ROUTES) {
        test(`${route.name} fits without horizontal overflow`, async ({
          page,
        }) => {
          await page.goto(route.path, { waitUntil: "domcontentloaded" });
          await page
            .waitForLoadState("networkidle", { timeout: 8_000 })
            .catch(() => {
              /* tolerate slow polling endpoints */
            });

          // Capture screenshot regardless of any subsequent assertion outcomes.
          await page.screenshot({
            path: `tests/screenshots/${viewport.name}-${route.name}.png`,
            fullPage: true,
          });

          // 1. Document should not exceed viewport width.
          const { docWidth, viewportWidth } = await page.evaluate(() => ({
            docWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
          }));
          expect(
            docWidth,
            `Document width ${docWidth}px exceeded viewport ${viewportWidth}px`,
          ).toBeLessThanOrEqual(viewportWidth + OVERFLOW_TOLERANCE_PX);

          // 2. No non-fixed element should render past the right edge,
          // ignoring anything clipped by an ancestor's overflow:hidden /
          // overflow:auto / overflow:clip (which is visually safe).
          const overflowing = await page.evaluate((tolerance) => {
            const clientWidth = document.documentElement.clientWidth;
            const isClippedByAncestor = (el: Element) => {
              let current: Element | null = el.parentElement;
              while (current && current !== document.documentElement) {
                const style = window.getComputedStyle(current);
                const overflowX = style.overflowX;
                if (
                  overflowX === "hidden" ||
                  overflowX === "auto" ||
                  overflowX === "scroll" ||
                  overflowX === "clip"
                ) {
                  return true;
                }
                current = current.parentElement;
              }
              return false;
            };
            const offenders: { tag: string; cls: string; right: number }[] = [];
            for (const el of Array.from(document.querySelectorAll("*"))) {
              const style = window.getComputedStyle(el);
              if (style.position === "fixed") continue;
              if (style.display === "none") continue;
              if (style.visibility === "hidden") continue;
              if (isClippedByAncestor(el)) continue;
              const rect = el.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) continue;
              if (rect.right > clientWidth + tolerance) {
                offenders.push({
                  tag: el.tagName,
                  cls:
                    typeof el.className === "string"
                      ? el.className.slice(0, 80)
                      : "",
                  right: Math.round(rect.right),
                });
              }
            }
            return offenders.slice(0, 10);
          }, OVERFLOW_TOLERANCE_PX);
          expect(
            overflowing,
            `Elements overflowing the viewport:\n${JSON.stringify(
              overflowing,
              null,
              2,
            )}`,
          ).toHaveLength(0);
        });
      }
    });
  }
});
