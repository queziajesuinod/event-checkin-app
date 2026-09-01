import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// URL da API pública (mesmo backend que o front consome). Em produção deve
// apontar para o backend real via variável de ambiente API_URL.
const API_BASE =
  process.env.API_URL || process.env.VITE_API_URL || "http://localhost:3005";

// ── Helpers para montar as meta tags de compartilhamento ─────────────────────

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// A descrição do evento pode conter HTML (texto rico); para o preview usamos só o texto.
const stripHtml = (value: string): string =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const truncate = (value: string, max = 200): string =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;

interface EventMeta {
  title?: string;
  description?: string;
  imageUrl?: string;
}

// Cache curto em memória: um crawler (WhatsApp, Facebook, etc.) pode bater várias
// vezes no mesmo link, então evitamos consultar a API a cada requisição.
const metaCache = new Map<string, { data: EventMeta | null; expires: number }>();
const META_TTL = 5 * 60 * 1000; // 5 min para sucesso
const META_TTL_ERROR = 30 * 1000; // 30s para falha

async function fetchEvento(id: string): Promise<EventMeta | null> {
  const cached = metaCache.get(id);
  if (cached && cached.expires > Date.now()) return cached.data;

  try {
    const res = await fetch(`${API_BASE}/api/public/events/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as EventMeta;
    metaCache.set(id, { data, expires: Date.now() + META_TTL });
    return data;
  } catch (error) {
    console.error(`[og] falha ao buscar evento ${id}:`, error);
    metaCache.set(id, { data: null, expires: Date.now() + META_TTL_ERROR });
    return null;
  }
}

// Resolve a URL de imagem para o og:image. Crawlers exigem URL http(s) absoluta:
// - data:base64  → servimos via /og-image/:id (que decodifica os bytes)
// - http(s)      → usa direto
// - relativa     → prefixa com a origem
function resolveOgImageUrl(evento: EventMeta, id: string, origin: string): string {
  const image = evento.imageUrl?.trim() || "";
  if (!image) return "";
  if (/^data:/i.test(image)) return `${origin}/og-image/${encodeURIComponent(id)}`;
  if (/^https?:\/\//i.test(image)) return image;
  return `${origin}${image.startsWith("/") ? "" : "/"}${image}`;
}

function buildMetaTags(
  evento: EventMeta,
  id: string,
  pageUrl: string,
  origin: string
): { title: string; tags: string } {
  const rawTitle = evento.title?.trim() || "Portal Gerencial - IECG";
  const title = escapeHtml(rawTitle);
  const description = evento.description
    ? escapeHtml(truncate(stripHtml(evento.description)))
    : "Inscreva-se neste evento da IECG.";

  const image = resolveOgImageUrl(evento, id, origin);
  const imageEsc = escapeHtml(image);
  const url = escapeHtml(pageUrl);

  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="IECG" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    image ? `<meta property="og:image" content="${imageEsc}" />` : "",
    image ? `<meta property="og:image:secure_url" content="${imageEsc}" />` : "",
    image ? `<meta property="og:image:alt" content="${title}" />` : "",
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    image ? `<meta name="twitter:image" content="${imageEsc}" />` : "",
  ]
    .filter(Boolean)
    .join("\n    ");

  return { title: rawTitle, tags };
}

// Extrai (mime, buffer) de uma data URI base64; null se não for uma.
function parseDataUri(value: string): { contentType: string; buffer: Buffer } | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(value.trim());
  if (!match) return null;
  try {
    return { contentType: match[1], buffer: Buffer.from(match[2], "base64") };
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  const indexPath = path.join(staticPath, "index.html");

  app.use(express.static(staticPath));

  // Serve a imagem do evento como um arquivo de imagem real. A API guarda a
  // imagem como data URI base64, que os crawlers (WhatsApp/Facebook) NÃO aceitam
  // em og:image — então decodificamos e devolvemos os bytes com Content-Type.
  app.get("/og-image/:id", async (req, res, next) => {
    try {
      const evento = await fetchEvento(req.params.id);
      const image = evento?.imageUrl?.trim();
      if (!image) return next();

      const dataUri = parseDataUri(image);
      if (dataUri) {
        res.setHeader("Content-Type", dataUri.contentType);
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.send(dataUri.buffer);
      }
      // Já é uma URL http(s): redireciona para ela.
      if (/^https?:\/\//i.test(image)) {
        return res.redirect(302, image);
      }
      return next();
    } catch (error) {
      console.error("[og] erro ao servir imagem do evento:", error);
      return next();
    }
  });

  // Página de um evento específico: injeta título/descrição/imagem do evento nas
  // meta tags Open Graph/Twitter para gerar o preview ao compartilhar o link.
  // Precisa vir ANTES do catch-all abaixo.
  app.get("/eventos/:id", async (req, res, next) => {
    try {
      const evento = await fetchEvento(req.params.id);
      if (!evento?.title) {
        // Sem dados do evento: entrega o index.html padrão.
        return res.sendFile(indexPath);
      }

      const html = await readFile(indexPath, "utf-8");
      const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol;
      const host = req.get("host") ?? "";
      const origin = `${proto}://${host}`;
      const pageUrl = `${origin}${req.originalUrl}`;
      const { title, tags } = buildMetaTags(evento, req.params.id, pageUrl, origin);

      // Troca o <title> e injeta as meta tags logo em seguida.
      const rendered = html.replace(
        /<title>.*?<\/title>/i,
        `<title>${escapeHtml(title)}</title>\n    ${tags}`
      );

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      // Cache curto no CDN/navegador; crawlers costumam respeitar.
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.send(rendered);
    } catch (error) {
      console.error("[og] erro ao renderizar meta tags do evento:", error);
      return next();
    }
  });

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(indexPath);
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
