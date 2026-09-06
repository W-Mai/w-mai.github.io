import { EventEmitter } from "node:events";
import { createServer, request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { AstroConfig, AstroIntegration } from "astro";
import type { Connect } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PDF_JS_RUNTIME_ASSET_DIRECTORY } from "./assets";
import pdfJsAssetsIntegration, { listPdfJsRuntimeAssets } from "./integration";

describe("PDF.js runtime asset publishing", () => {
  let integration: AstroIntegration;
  let output: string;
  const cleanup: (() => Promise<void>)[] = [];

  async function hook(
    name: keyof AstroIntegration["hooks"],
    parameters: unknown = {},
  ) {
    const callback = integration.hooks[name] as
      | ((value: unknown) => unknown)
      | undefined;
    return callback?.(parameters);
  }

  beforeEach(async () => {
    integration = pdfJsAssetsIntegration();
    output = await mkdtemp(join(tmpdir(), "pdfjs-runtime-assets-"));
    const config = { base: "/docs" } as AstroConfig;
    await hook("astro:config:setup", { config });
    await hook("astro:config:done", { config });
  });

  afterEach(async () => {
    for (const close of cleanup.splice(0)) await close();
    await rm(output, { recursive: true, force: true });
  });

  async function development() {
    let middleware: Connect.NextHandleFunction;
    const server = createServer((request, response) => {
      const incoming = request as Connect.IncomingMessage;
      incoming.originalUrl = incoming.url;
      if (incoming.url?.startsWith("/docs/")) {
        incoming.url = incoming.url.slice("/docs".length);
      }
      middleware(incoming, response, () => {
        response.writeHead(404);
        response.end();
      });
    });
    await hook("astro:server:setup", {
      server: {
        middlewares: {
          use: (value: Connect.NextHandleFunction) => {
            middleware = value;
          },
        },
        watcher: new EventEmitter(),
      },
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    cleanup.push(
      () =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        ),
    );
    const port = (server.address() as AddressInfo).port;
    return (
      path: string,
      method = "GET",
    ): Promise<{
      body: Buffer;
      headers: import("node:http").IncomingHttpHeaders;
      status: number;
    }> =>
      new Promise((resolve, reject) => {
        const request = httpRequest(
          {
            hostname: "127.0.0.1",
            port,
            path,
            method,
            headers: { Connection: "close" },
          },
          (response) => {
            const chunks: Buffer[] = [];
            response.on("data", (chunk: Buffer) => chunks.push(chunk));
            response.on("end", () =>
              resolve({
                body: Buffer.concat(chunks),
                headers: response.headers,
                status: response.statusCode!,
              }),
            );
          },
        );
        request.on("error", reject);
        request.end();
      });
  }

  it("serves Base-14 fallback fonts and packed CMaps from exact versioned paths", async () => {
    const assets = await listPdfJsRuntimeAssets();
    const font = assets.find(
      ({ relativePath }) =>
        relativePath === "standard_fonts/LiberationSans-Regular.ttf",
    )!;
    const cMap = assets.find(
      ({ relativePath }) => relativePath === "cmaps/Adobe-Japan1-UCS2.bcmap",
    )!;
    const request = await development();
    const mount = `/docs/${PDF_JS_RUNTIME_ASSET_DIRECTORY}`;

    const fontResponse = await request(`${mount}/${font.relativePath}?cache=1`);
    expect(fontResponse.status).toBe(200);
    expect(fontResponse.body).toEqual(await readFile(font.sourcePath));
    expect(fontResponse.headers["content-type"]).toBe("font/ttf");
    expect(fontResponse.headers["cache-control"]).toContain("immutable");
    expect(fontResponse.headers["x-content-type-options"]).toBe("nosniff");

    const cMapResponse = await request(`${mount}/${cMap.relativePath}`, "HEAD");
    expect(cMapResponse.status).toBe(200);
    expect(cMapResponse.body).toHaveLength(0);
    expect(Number(cMapResponse.headers["content-length"])).toBe(
      (await readFile(cMap.sourcePath)).byteLength,
    );
    expect((await request(`${mount}/cmaps/missing.bcmap`)).status).toBe(404);
    expect((await request(`${mount}/${font.relativePath}`, "POST")).status).toBe(
      405,
    );
    expect((await request(`/${PDF_JS_RUNTIME_ASSET_DIRECTORY}/${font.relativePath}`)).status).toBe(
      404,
    );
  });

  it("copies the complete runtime inventory and its license notices", async () => {
    const assets = await listPdfJsRuntimeAssets();
    await hook("astro:build:start");
    await hook("astro:build:generated", { dir: pathToFileURL(`${output}/`) });

    for (const relativePath of [
      "standard_fonts/LiberationSans-Regular.ttf",
      "standard_fonts/FoxitSerif.pfb",
      "cmaps/Adobe-Japan1-UCS2.bcmap",
      "standard_fonts/LICENSE_FOXIT",
      "standard_fonts/LICENSE_LIBERATION",
      "cmaps/LICENSE",
    ]) {
      const source = assets.find((asset) => asset.relativePath === relativePath)!;
      expect(
        await readFile(
          join(output, PDF_JS_RUNTIME_ASSET_DIRECTORY, relativePath),
        ),
      ).toEqual(await readFile(source.sourcePath));
    }
  });
});
