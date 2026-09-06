import { constants } from "node:fs";
import { copyFile, mkdir, open, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import type { AstroConfig, AstroIntegration } from "astro";
import type { Connect } from "vite";
import { PDF_JS_RUNTIME_ASSET_DIRECTORY } from "./assets";

type PdfJsRuntimeAsset = {
  mediaType: string;
  relativePath: string;
  sourcePath: string;
};

type AssetGroup = {
  directory: string;
  extensions: ReadonlySet<string>;
  filenames?: ReadonlySet<string>;
  mediaType: string;
};

const require = createRequire(import.meta.url);
const PDF_JS_PACKAGE_ROOT = dirname(require.resolve("pdfjs-dist/package.json"));
const ASSET_GROUPS: readonly AssetGroup[] = [
  {
    directory: "cmaps",
    extensions: new Set([".bcmap"]),
    mediaType: "application/octet-stream",
  },
  {
    directory: "standard_fonts",
    extensions: new Set([".pfb"]),
    mediaType: "application/x-font-type1",
  },
  {
    directory: "standard_fonts",
    extensions: new Set([".ttf"]),
    mediaType: "font/ttf",
  },
  {
    directory: "cmaps",
    extensions: new Set(),
    filenames: new Set(["LICENSE"]),
    mediaType: "text/plain; charset=utf-8",
  },
  {
    directory: "standard_fonts",
    extensions: new Set(),
    filenames: new Set(["LICENSE_FOXIT", "LICENSE_LIBERATION"]),
    mediaType: "text/plain; charset=utf-8",
  },
];

function extension(name: string): string {
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index).toLowerCase();
}

function mountPath(base: string): string {
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${PDF_JS_RUNTIME_ASSET_DIRECTORY}/`.replace(/\/{2,}/g, "/");
}

/** Enumerate the immutable support files consumed by the PDF.js canvas renderer. */
export async function listPdfJsRuntimeAssets(): Promise<
  PdfJsRuntimeAsset[]
> {
  const assets: PdfJsRuntimeAsset[] = [];
  for (const group of ASSET_GROUPS) {
    const sourceDirectory = join(PDF_JS_PACKAGE_ROOT, group.directory);
    const entries = await readdir(sourceDirectory, { withFileTypes: true });
    for (const entry of entries) {
      const included =
        group.extensions.has(extension(entry.name)) ||
        group.filenames?.has(entry.name);
      if (!entry.isFile() || !included) {
        continue;
      }
      if (!/^[A-Za-z0-9_.-]+$/.test(entry.name)) {
        throw new Error(`Unexpected PDF.js runtime asset name: ${entry.name}`);
      }
      assets.push({
        mediaType: group.mediaType,
        relativePath: `${group.directory}/${entry.name}`,
        sourcePath: join(sourceDirectory, entry.name),
      });
    }
  }
  assets.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
  if (
    !assets.some(
      ({ relativePath }) =>
        relativePath === "standard_fonts/LiberationSans-Regular.ttf",
    )
  ) {
    throw new Error("PDF.js standard font assets are incomplete.");
  }
  if (
    !assets.some(
      ({ relativePath }) => relativePath === "cmaps/Adobe-Japan1-UCS2.bcmap",
    )
  ) {
    throw new Error("PDF.js CMap assets are incomplete.");
  }
  return assets;
}

function runtimeAssetMiddleware(
  base: string,
  assets: readonly PdfJsRuntimeAsset[],
): Connect.NextHandleFunction {
  const mount = mountPath(base);
  const published = new Map(
    assets.map((asset) => [`${mount}${asset.relativePath}`, asset]),
  );
  return (request, response, next) => {
    const pathname = (request.originalUrl ?? request.url ?? "").split("?")[0];
    if (!pathname.startsWith(mount)) {
      next();
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }
    const asset = published.get(pathname);
    if (!asset) {
      response.writeHead(404);
      response.end();
      return;
    }
    void (async () => {
      const handle = await open(
        asset.sourcePath,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      try {
        const stat = await handle.stat();
        if (!stat.isFile()) {
          response.writeHead(404);
          response.end();
          return;
        }
        response.writeHead(200, {
          "Content-Type": asset.mediaType,
          "Content-Length": stat.size,
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        });
        if (request.method === "HEAD") {
          response.end();
          return;
        }
        await pipeline(handle.createReadStream({ autoClose: false }), response);
      } finally {
        await handle.close();
      }
    })().catch((error: unknown) => {
      if (response.headersSent || response.destroyed) {
        response.destroy(error instanceof Error ? error : undefined);
        return;
      }
      next(error);
    });
  };
}

/** Publish versioned PDF.js CMaps and standard fonts in development and static output. */
export default function pdfJsAssetsIntegration(): AstroIntegration {
  let config: AstroConfig;
  let assetsPromise: Promise<PdfJsRuntimeAsset[]> | undefined;
  const assets = () => (assetsPromise ??= listPdfJsRuntimeAssets());

  return {
    name: "pdf-js-runtime-assets",
    hooks: {
      "astro:config:setup": ({ config: initialConfig }) => {
        config = initialConfig;
      },
      "astro:config:done": ({ config: resolvedConfig }) => {
        config = resolvedConfig;
      },
      "astro:server:setup": async ({ server }) => {
        server.middlewares.use(runtimeAssetMiddleware(config.base, await assets()));
      },
      "astro:build:start": async () => {
        await assets();
      },
      "astro:build:generated": async ({ dir }) => {
        const outputRoot = join(
          fileURLToPath(dir),
          PDF_JS_RUNTIME_ASSET_DIRECTORY,
        );
        for (const asset of await assets()) {
          const target = join(outputRoot, asset.relativePath);
          await mkdir(dirname(target), { recursive: true });
          await copyFile(asset.sourcePath, target, constants.COPYFILE_EXCL);
        }
      },
    },
  };
}
