import { Type } from "@sinclair/typebox";
import fs from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type MemoryConfig = {
  embedding: {
    provider: "openai" | "local";
    model?: string;
    modelPath?: string;
    apiKey?: string;
  };
  dbPath?: string;
  autoCapture?: boolean;
  autoRecall?: boolean;
};

export const MEMORY_CATEGORIES = ["preference", "fact", "decision", "entity", "other"] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_LOCAL_MODEL = "bge-base-en-v1.5-q4_k_m.gguf";
const LEGACY_STATE_DIRS: string[] = [];

function resolveDefaultDbPath(): string {
  const home = homedir();
  const preferred = join(home, ".openclaw", "memory", "lancedb");
  try {
    if (fs.existsSync(preferred)) return preferred;
  } catch {
    // best-effort
  }

  for (const legacy of LEGACY_STATE_DIRS) {
    const candidate = join(home, legacy, "memory", "lancedb");
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // best-effort
    }
  }

  return preferred;
}

const DEFAULT_DB_PATH = resolveDefaultDbPath();

const EMBEDDING_DIMENSIONS: Record<string, number> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "bge-base-en-v1.5-q4_k_m.gguf": 768,
};

function assertAllowedKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) return;
  throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
}

export function vectorDimsForModel(model: string): number {
  const dims = EMBEDDING_DIMENSIONS[model];
  if (!dims) {
    throw new Error(`Unsupported embedding model: ${model}`);
  }
  return dims;
}

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
    const envValue = process.env[envVar];
    if (!envValue) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    return envValue;
  });
}

function resolveEmbeddingModel(embedding: Record<string, unknown>): string {
  const model = typeof embedding.model === "string" ? embedding.model : DEFAULT_MODEL;
  vectorDimsForModel(model);
  return model;
}

export const memoryConfigSchema = {
  parse(value: unknown): MemoryConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("memory config required");
    }
    const cfg = value as Record<string, unknown>;
    assertAllowedKeys(cfg, ["embedding", "dbPath", "autoCapture", "autoRecall"], "memory config");

    const embedding = cfg.embedding as Record<string, unknown> | undefined;
    if (!embedding) {
      throw new Error("embedding config is required");
    }
    assertAllowedKeys(embedding, ["provider", "apiKey", "model", "modelPath"], "embedding config");

    const provider = (embedding.provider as string) === "local" ? "local" : "openai";

    if (provider === "openai" && typeof embedding.apiKey !== "string") {
      throw new Error("embedding.apiKey is required for openai provider");
    }

    let model = typeof embedding.model === "string" ? embedding.model : DEFAULT_MODEL;
    if (provider === "local") {
        model = typeof embedding.model === "string" ? embedding.model : DEFAULT_LOCAL_MODEL;
    }
    
    // Validate model dimensions if known, otherwise warn or default?
    // For now, we only support known models in EMBEDDING_DIMENSIONS to ensure DB consistency.
    vectorDimsForModel(model);

    return {
      embedding: {
        provider,
        model,
        modelPath: typeof embedding.modelPath === "string" ? embedding.modelPath : undefined,
        apiKey: typeof embedding.apiKey === "string" ? resolveEnvVars(embedding.apiKey) : undefined,
      },
      dbPath: typeof cfg.dbPath === "string" ? cfg.dbPath : DEFAULT_DB_PATH,
      autoCapture: cfg.autoCapture !== false,
      autoRecall: cfg.autoRecall !== false,
    };
  },
  uiHints: {
    "embedding.provider": {
        label: "Provider",
        options: ["openai", "local"],
        default: "openai",
    },
    "embedding.apiKey": {
      label: "OpenAI API Key",
      sensitive: true,
      placeholder: "sk-proj-...",
      help: "API key for OpenAI embeddings (required for openai provider)",
    },
    "embedding.model": {
      label: "Embedding Model",
      placeholder: DEFAULT_MODEL,
      help: "Model name (e.g. text-embedding-3-small or bge-base...)",
    },
    "embedding.modelPath": {
        label: "Local Model Path",
        placeholder: "/path/to/model.gguf",
        help: "Path to GGUF model file (required for local provider if not using default)",
        advanced: true,
    },
    dbPath: {
      label: "Database Path",
      placeholder: "~/.openclaw/memory/lancedb",
      advanced: true,
    },
    autoCapture: {
      label: "Auto-Capture",
      help: "Automatically capture important information from conversations",
    },
    autoRecall: {
      label: "Auto-Recall",
      help: "Automatically inject relevant memories into context",
    },
  },
};
