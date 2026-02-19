/**
 * Playwright fixtures for MSW-based network interception.
 *
 * Import `{ test, expect }` from this file in MSW-based spec files
 * instead of `@playwright/test`.
 *
 * The `network` fixture is enabled automatically for every test. Individual
 * tests can call `network.use(...handlers)` to add per-test overrides on top
 * of the base handler set.
 *
 * The `handlers` fixture accepts an optional override array so that tests can
 * supply a custom handler list:
 *
 * ```ts
 * test('my test', async ({ network, page }) => {
 *   network.use(http.get('/api/v1/users', () => HttpResponse.json({ users: [] })));
 *   await page.goto('/users');
 * });
 * ```
 */

import { test as testBase, expect } from "@playwright/test";
import { type AnyHandler } from "msw";
import { defineNetworkFixture, type NetworkFixture } from "@msw/playwright";

interface Fixtures {
  /** Base handler list. Defaults to an empty array; tests may override. */
  handlers: Array<AnyHandler>;
  /** The live network fixture — call `network.use()` for per-test overrides. */
  network: NetworkFixture;
}

const test = testBase.extend<Fixtures>({
  // An empty default handler list. Tests that need a specific base set can
  // override this fixture option or call `network.use()` inline.
  handlers: [[], { option: true }],

  // Wire the MSW handlers into Playwright's browser context via page.route().
  // `auto: true` means the fixture runs for every test without being listed
  // explicitly in the test function parameters.
  network: [
    async ({ context, handlers }, use) => {
      const network = defineNetworkFixture({
        context,
        handlers,
      });

      await network.enable();
      await use(network);
      await network.disable();
    },
    { auto: true },
  ],
});

export { test, expect };
