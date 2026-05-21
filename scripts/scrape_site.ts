import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import * as XLSX from "xlsx";

const baseUrl = "https://juikaifui.ru/";
const outDir = path.join(process.cwd(), "public", "scrape_artifacts");
const rawDir = path.join(outDir, "raw");

type MenuRow = {
  id: string;
  category: string;
  name: string;
  description: string;
  sale_price: number;
  image_url: string;
  product_url: string;
  is_active: boolean;
  tax_rate: string;
  delivery_available: boolean;
  source: "IMPORTED_MENU";
  source_note: string;
};

type SiteProduct = {
  id: string;
  name: string;
  category_id?: string;
  description?: string;
  parameters?: Array<{ cost?: string; description?: string }>;
  images?: { small?: string; medium?: string; large?: string };
  fullUrl?: string;
  seo?: { friendly_url?: string };
};

type SiteCategory = {
  id: string;
  name: string;
};

function priceFromText(text: string) {
  const match = text.replace(/\s+/g, " ").match(/(\d{2,5})(?:[.,]\d{1,2})?\s*(?:₽|руб|р)/i);
  return match ? Number(match[1]) : 0;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/(^-|-$)/g, "");
}

function extractBalancedJson(source: string, start: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") inString = false;
      continue;
    }
    if (char === "\"") inString = true;
    if (char === "[" || char === "{") depth += 1;
    if (char === "]" || char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  return "";
}

function extractStateArray<T>(html: string, marker: string): T[] {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return [];
  const start = html.indexOf("[", markerIndex);
  if (start < 0) return [];
  const json = extractBalancedJson(html, start);
  if (!json) return [];
  return JSON.parse(json.replace(/\\u003c/g, "<")) as T[];
}

function normalizeUrl(url?: string) {
  if (!url) return "";
  if (url.startsWith("https:///")) return url.replace("https:///", "https://juikaifui.ru/");
  if (url.startsWith("/")) return `https://juikaifui.ru${url}`;
  return url;
}

async function main() {
  await fs.mkdir(rawDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const responses: Array<{ url: string; status: number; contentType: string; bodyPath?: string }> = [];

  page.on("response", async (response) => {
    const contentType = response.headers()["content-type"] ?? "";
    const url = response.url();
    if (!/json|html|text/i.test(contentType)) return;
    try {
      const body = await response.text();
      const file = path.join(rawDir, `${responses.length}-${slug(url).slice(0, 80)}.${contentType.includes("json") ? "json" : "txt"}`);
      await fs.writeFile(file, body);
      responses.push({ url, status: response.status(), contentType, bodyPath: path.relative(process.cwd(), file) });
    } catch {
      responses.push({ url, status: response.status(), contentType });
    }
  });

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 });
  await page.screenshot({ path: path.join(outDir, "home.png"), fullPage: true });
  const homeHtml = await page.content();
  await fs.writeFile(path.join(outDir, "home.html"), homeHtml);

  const links = await page.locator("a[href]").evaluateAll((nodes) =>
    [...new Set(nodes.map((node) => (node as HTMLAnchorElement).href).filter((href) => href.startsWith(location.origin)))]
  );
  for (const link of links.slice(0, 80)) {
    try {
      await page.goto(link, { waitUntil: "networkidle", timeout: 45000 });
      await fs.writeFile(path.join(rawDir, `${slug(link).slice(0, 100)}.html`), await page.content());
    } catch {
      continue;
    }
  }

  const stateProducts = extractStateArray<SiteProduct>(homeHtml, "\"products\":{\"all\":");
  const stateCategories = extractStateArray<SiteCategory>(homeHtml, "\"categories\":{\"all\":");
  const categoryById = new Map(stateCategories.map((category) => [String(category.id), category.name]));

  const domRows = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll("article, [class*='product'], [class*='card'], li, [data-product]"));
    return candidates.map((node) => {
      const el = node as HTMLElement;
      const text = el.innerText || "";
      const img = el.querySelector("img") as HTMLImageElement | null;
      const link = el.querySelector("a") as HTMLAnchorElement | null;
      const title =
        (el.querySelector("h1,h2,h3,h4,[class*='title'],[class*='name']") as HTMLElement | null)?.innerText?.trim() ||
        text.split("\n").map((part) => part.trim()).find(Boolean) ||
        "";
      return {
        category: "",
        name: title,
        description: text,
        image_url: img?.src || "",
        product_url: link?.href || location.href
      };
    });
  });

  const stateMenu: MenuRow[] = stateProducts.map((product) => ({
    id: `site-${product.id}`,
    category: categoryById.get(String(product.category_id)) ?? "Uncategorized",
    name: product.name,
    description: [product.description, product.parameters?.[0]?.description].filter(Boolean).join(" "),
    sale_price: Number(product.parameters?.[0]?.cost ?? 0),
    image_url: product.images?.large ?? product.images?.medium ?? product.images?.small ?? "",
    product_url: normalizeUrl(product.fullUrl),
    is_active: true,
    tax_rate: "",
    delivery_available: true,
    source: "IMPORTED_MENU",
    source_note: "Extracted from public FoodSoul page state; verify manually before financial decisions"
  }));

  const domMenu: MenuRow[] = domRows
    .map((row) => ({
      id: `site-${slug(row.name).slice(0, 64)}`,
      category: row.category || "Uncategorized",
      name: row.name,
      description: row.description,
      sale_price: priceFromText(row.description),
      image_url: row.image_url,
      product_url: row.product_url,
      is_active: true,
      tax_rate: "",
      delivery_available: true,
      source: "IMPORTED_MENU" as const,
      source_note: "Extracted by Playwright crawler; verify manually before financial decisions"
    }))
    .filter((row) => row.name && row.sale_price > 0);

  const dedup = new Map<string, MenuRow>();
  [...stateMenu, ...domMenu].forEach((row) => dedup.set(row.id || row.name, row));
  const menu = [...dedup.values()].filter((row) => row.name && row.sale_price > 0);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(menu), "menu");
  XLSX.writeFile(workbook, path.join(outDir, "scraped_menu.xlsx"));
  await fs.writeFile(path.join(outDir, "scraped_menu.json"), JSON.stringify(menu, null, 2));
  await fs.writeFile(path.join(outDir, "responses.json"), JSON.stringify(responses, null, 2));
  await browser.close();
  console.log(`Extracted ${menu.length} candidate menu rows. Artifacts: ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
