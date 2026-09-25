import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(__dirname, "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  experimental: {
    // Com o proxy.ts ativo, o Next limita o corpo das requisições a 10 MB e
    // corta o excedente. As planilhas do SIG passam disso (o LISTAS FOLHA tem
    // 23 MB); o limite de fato é o UPLOAD_MAX_MB do backend.
    proxyClientMaxBodySize: "60mb",
  },
  // Monorepo: dependências ficam em node_modules na raiz (npm workspaces)
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  webpack: (config) => {
    const rootModules = path.join(monorepoRoot, "node_modules");

    config.resolve.modules = [rootModules, ...(config.resolve.modules ?? [])];

    // Peer deps do Recharts (monorepo — webpack não sobe a árvore a partir de node_modules/recharts)
    config.resolve.alias = {
      ...config.resolve.alias,
      "react-redux": path.join(rootModules, "react-redux"),
    };

    return config;
  },
};

export default nextConfig;
