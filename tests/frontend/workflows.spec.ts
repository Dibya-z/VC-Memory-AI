import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const analysis = {
  summary: "Fixture analysis of the selected deck.",
  positiveSignals: ["A recorded strength."],
  risks: ["More evidence needed."],
  founderQuestions: ["How has retention changed?"],
  recommendation: "Needs partner review.",
  similarCompanies: [],
};
const brief = {
  company: "FlowAI",
  overview: "A fictional brief for interface verification.",
  problem: "Manual workflows.",
  solution: "Automation.",
  market: "Business tools.",
  founderSignals: "Recorded team.",
  traction: "Recorded traction.",
  strengths: ["A strength."],
  risks: ["A risk."],
  similarPastDeals: [],
  questionsForFounder: ["What changed?"],
  recommendation: "Needs partner review.",
};
const quote = "FlowAI founder meeting notes.";
const chat = {
  answer: "FlowAI has recorded meeting notes. [P1]",
  status: "answered",
  activeCompanyId: "fixture-flowai",
  citations: [
    {
      companyId: "fixture-flowai",
      companyName: "FlowAI",
      documentId: "fixture-document",
      documentName: "flowai-notes.txt",
      evidenceId: "P1",
      snippet: quote,
      quote,
      location: { start: 0, end: quote.length },
    },
  ],
};

async function open(page: Page, url: string) {
  await page.goto(url);
  // A server-rendered button may be clickable before React attaches handlers.
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll("button")).some((element) =>
      Object.keys(element).some(
        (key) =>
          key.startsWith("__reactProps$") &&
          typeof (element as unknown as Record<string, { onClick?: unknown }>)[
            key
          ].onClick === "function",
      ),
    ),
  );
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - innerWidth,
      main:
        document.querySelector("main")!.scrollWidth -
        document.querySelector("main")!.clientWidth,
    })),
  ).toEqual({ document: 0, main: 0 });
}
async function accessibility(page: Page) {
  await page.addScriptTag({
    path: path.resolve("node_modules/axe-core/axe.min.js"),
  });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: typeof import("axe-core") }).axe;
    const result = await axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
      },
    });
    return result.violations.map((v) => ({
      id: v.id,
      elements: v.nodes.map((n) => n.target),
    }));
  });
  expect(violations).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) =>
    route.request().method() === "GET"
      ? route.continue()
      : route.fulfill({
          status: 503,
          json: { error: "Test blocked an unexpected write or provider call." },
        }),
  );
});

test("dashboard and long company cards fit mobile, tablet and desktop widths", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1024, 1280, 1440, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "/");
    await expect(
      page.getByText("Companies in memory", { exact: true }),
    ).toBeVisible();
    await noOverflow(page);
    if ([390, 1024, 1440].includes(width))
      await page.screenshot({
        path: test.info().outputPath(`dashboard-${width}.png`),
        fullPage: true,
      });
    if (width === 1024)
      expect(
        (await page.getByRole("heading", { level: 1 }).boundingBox())!.width,
      ).toBeGreaterThan(400);
    await open(page, "/companies");
    await expect(
      page.getByText("Showing 1–24 of 27 companies", { exact: true }),
    ).toBeVisible();
    await noOverflow(page);
    if (width === 320)
      await page.screenshot({
        path: test.info().outputPath("companies-320.png"),
        fullPage: true,
      });
  }
});

test("mobile drawer contains focus, closes on Escape and returns focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await open(page, "/chat");
  const trigger = page.getByRole("button", { name: "Open menu", exact: true });
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "Workspace navigation" });
  await expect(drawer).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(
    await drawer.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  for (let i = 0; i < 10; i++) await page.keyboard.press("Tab");
  expect(
    await drawer.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await accessibility(page);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("brief retains old content with a visible regeneration error and prints correctly", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/brief", (route) =>
    route.fulfill(
      ++calls === 1
        ? { json: { brief } }
        : { status: 503, json: { error: "Fixture regeneration unavailable." } },
    ),
  );
  await open(page, "/companies/fixture-flowai");
  const trigger = page.getByRole("button", {
    name: "Generate investment brief",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Investment brief: FlowAI",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close investment brief", exact: true }),
  ).toBeFocused();
  await dialog.getByRole("button", { name: "Regenerate", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Showing the previous brief",
  );
  await expect(dialog.getByText(brief.overview, { exact: true })).toBeVisible();
  await accessibility(page);
  await page.emulateMedia({ media: "print" });
  await expect(dialog).toBeVisible();
  expect((await dialog.boundingBox())!.height).toBeGreaterThan(500);
  await page.emulateMedia({ media: "screen" });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "View investment brief", exact: true }),
  ).toBeFocused();
});

test("analyzer uses one source, locks pending edits and retains editable input", async ({
  page,
}) => {
  let release!: () => void;
  let requestBody = "";
  await page.route("**/api/analyze", async (route) => {
    requestBody = route.request().postData() ?? "";
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({ json: { analysis, filename: "first.md" } });
  });
  await open(page, "/analyzer");
  await page.locator('input[type="file"]').setInputFiles({
    name: "first.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("A fictional source deck with sufficient content."),
  });
  const remove = page.getByRole("button", { name: "Remove file", exact: true });
  let openedPicker = false;
  page.on("filechooser", () => {
    openedPicker = true;
  });
  await remove.focus();
  await page.keyboard.press("Enter");
  await expect(remove).toHaveCount(0);
  expect(openedPicker).toBe(false);
  await page.getByRole("radio", { name: "Paste text", exact: true }).check();
  await page
    .getByRole("textbox", { name: "Deck or memo text", exact: true })
    .fill("Different pasted source with enough context for analysis.");
  const request = page.waitForRequest("**/api/analyze");
  await page.getByRole("button", { name: "Analyze deal", exact: true }).click();
  await request;
  await expect(
    page.getByRole("textbox", { name: "Deck or memo text", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("radio", { name: "Upload file", exact: true }),
  ).toBeDisabled();
  expect(requestBody).toContain("Different pasted source");
  expect(requestBody).not.toContain('filename="first.md"');
  release();
  await expect(
    page.getByRole("heading", { name: /Analysis.*Pasted deck/ }),
  ).toBeFocused();
  await expect(page.getByText(/No comparable/).first()).toBeVisible();
  await page.getByRole("button", { name: "Edit source", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Deck or memo text", exact: true }),
  ).toHaveValue("Different pasted source with enough context for analysis.");
  await accessibility(page);
});

test("upload displays queued work immediately and processes one request at a time", async ({
  page,
}) => {
  const releases: (() => void)[] = [];
  let started = 0;
  await page.route("**/api/upload", async (route) => {
    started++;
    await new Promise<void>((resolve) => releases.push(resolve));
    await route.fulfill({
      json: {
        results: [
          { filename: "fixture.md", ok: true, companyId: "fixture-flowai" },
        ],
      },
    });
  });
  await open(page, "/upload");
  const first = page.waitForRequest("**/api/upload");
  await page.getByRole("button", { name: "NovaLedger", exact: true }).click();
  await first;
  await expect(
    page.getByRole("button", { name: "NovaLedger · In list", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Copilotry", exact: true }).click();
  await expect(page.getByText("Queued", { exact: true })).toBeVisible();
  expect(started).toBe(1);
  const second = page.waitForRequest("**/api/upload");
  releases[0]();
  await second;
  await expect.poll(() => started).toBe(2);
  releases[1]();
  await expect(page.getByText("Added to memory", { exact: true })).toHaveCount(
    2,
  );
  await expect(
    page.getByRole("link", { name: "Open company", exact: true }),
  ).toHaveCount(2);
  await accessibility(page);
});

test("filters apply together, use recorded facets, paginate and announce results", async ({
  page,
}) => {
  await open(page, "/companies");
  await expect(
    page.getByRole("link", { name: "Next page", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Sector", exact: true })
    .selectOption("SaaS (AI workflow automation)");
  await page
    .getByRole("combobox", { name: "Decision", exact: true })
    .selectOption("Tracking");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(page).toHaveURL(/sector=SaaS.*decision=Tracking/);
  await expect(
    page.getByRole("heading", { name: "FlowAI", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Showing 1–1 of 1 company", { exact: true }),
  ).toBeVisible();
  await accessibility(page);
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("heading", { name: "Company memory", exact: true }),
  ).toBeVisible();
});

test("chat retries preserve drafts, citations open retained passages, saving is opt-in", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/chat", (route) =>
    route.fulfill(
      ++requests === 1
        ? { status: 503, json: { error: "Fixture network interruption." } }
        : { json: chat },
    ),
  );
  await open(page, "/chat");
  const input = page.getByRole("textbox", {
    name: "Ask the firm’s memory",
    exact: true,
  });
  await input.fill("Prep me for a meeting with FlowAI.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText("Fixture network interruption.", { exact: true }),
  ).toBeVisible();
  await input.fill("A draft for my next question");
  await page
    .getByRole("button", { name: "Retry last question", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "View source P1", exact: true }),
  ).toBeVisible();
  await expect(input).toHaveValue("A draft for my next question");
  await expect(
    page.getByRole("article", { name: "Your question" }),
  ).toHaveCount(1);
  await page.getByRole("link", { name: "View source P1", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Read passage in document", exact: true }),
  ).toBeVisible();
  await accessibility(page);
  await page
    .getByRole("checkbox", { name: "Keep this chat in this tab", exact: true })
    .check();
  await page.reload();
  await expect(
    page.getByRole("link", { name: "View source P1", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View source P1", exact: true }).click();
  await page
    .getByRole("link", { name: "Read passage in document", exact: true })
    .click();
  await expect(page.locator("mark#source-passage")).toHaveText(quote);
  await expect(page).toHaveTitle(/flowai-notes.txt.*FlowAI/);
  await noOverflow(page);
});

test("an unsaved chat disappears on refresh and inaccessible records have recovery", async ({
  page,
}) => {
  await page.route("**/api/chat", (route) => route.fulfill({ json: chat }));
  await open(page, "/chat");
  await page
    .getByRole("textbox", { name: "Ask the firm’s memory", exact: true })
    .fill("Tell me about FlowAI.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "View source P1", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Try asking", exact: true }),
  ).toBeVisible();
  await open(page, "/companies/fixture-flowai/documents/missing");
  await expect(
    page.getByRole("heading", {
      name: "This record isn’t available",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Find a company", exact: true }),
  ).toBeVisible();
});

test("cancelled analyzer requests keep their source, and explicit saving restores results", async ({
  page,
}) => {
  let release!: () => void;
  let calls = 0;
  await page.route("**/api/analyze", async (route) => {
    if (++calls === 1)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await route.fulfill({ json: { analysis } }).catch(() => {});
  });
  await open(page, "/analyzer");
  await page.getByRole("radio", { name: "Paste text", exact: true }).check();
  const source = page.getByRole("textbox", {
    name: "Deck or memo text",
    exact: true,
  });
  await source.fill(
    "A preserved fictional source with enough detail to analyze.",
  );
  const pending = page.waitForRequest("**/api/analyze");
  await page.getByRole("button", { name: "Analyze deal", exact: true }).click();
  await pending;
  await page
    .getByRole("button", { name: "Cancel analysis", exact: true })
    .click();
  await expect(source).toBeEnabled();
  await expect(source).toHaveValue(
    "A preserved fictional source with enough detail to analyze.",
  );
  release();
  await page
    .getByRole("checkbox", { name: /Keep source text and result/ })
    .check();
  await page.getByRole("button", { name: "Analyze deal", exact: true }).click();
  await expect(page.getByText(analysis.summary, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(analysis.summary, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit source", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Deck or memo text", exact: true }),
  ).toHaveValue("A preserved fictional source with enough detail to analyze.");
});

test("closing a regenerating brief restores focus and prevents a late reopening", async ({
  page,
}) => {
  let calls = 0,
    release!: () => void;
  await page.route("**/api/brief", async (route) => {
    if (++calls > 1)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await route.fulfill({ json: { brief } }).catch(() => {});
  });
  await open(page, "/companies/fixture-flowai");
  await page
    .getByRole("button", { name: "Generate investment brief", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Investment brief: FlowAI",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const pending = page.waitForRequest("**/api/brief");
  await dialog.getByRole("button", { name: "Regenerate", exact: true }).click();
  await pending;
  await dialog
    .getByRole("button", { name: "Close investment brief", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "View investment brief", exact: true }),
  ).toBeFocused();
  release();
  await expect(dialog).toHaveCount(0);
});

test("database read failures show a recoverable page instead of a digest screen", async ({
  page,
}) => {
  await open(page, "/companies/fixture-db-error");
  await expect(
    page.getByRole("heading", {
      name: "We couldn’t load this page",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry page", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Return to dashboard", exact: true }),
  ).toBeVisible();
});

test("an upload already running on the server can be checked and replayed without a duplicate", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/upload", (route) =>
    route.fulfill({
      json: {
        results: [
          ++calls === 1
            ? {
                ok: false,
                filename: "novaledger-deck.md",
                pending: true,
                retryAfterSeconds: 2,
                error:
                  "This document is already processing. Check again shortly.",
              }
            : {
                ok: true,
                filename: "novaledger-deck.md",
                reused: true,
                companyId: "fixture-flowai",
                documentId: "fixture-document",
              },
        ],
      },
    }),
  );
  await open(page, "/upload");
  await page.getByRole("button", { name: "NovaLedger", exact: true }).click();
  await expect(
    page.getByText("Processing on server", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Failed", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Check upload status for novaledger-deck.md",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      "This document was already stored. The existing result was reused.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open company", exact: true }),
  ).toHaveAttribute("href", "/companies/fixture-flowai");
  expect(calls).toBe(2);
});
