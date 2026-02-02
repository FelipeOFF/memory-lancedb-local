# memory-lancedb-local

Fork of OpenClaw’s LanceDB memory plugin, modified to support **local embeddings** (GGUF via `node-llama-cpp`) and add extra **PII safety** for auto-capture.

## What’s inside

- **LanceDB-backed long-term memory** (auto-recall + auto-capture)
- **Embeddings provider**:
  - `local`: GGUF embeddings via `node-llama-cpp`
  - `openai`: OpenAI embeddings (optional)
- **PII guardrails**: auto-capture is blocked when text contains emails or phone numbers.

## Install (local plugin)

OpenClaw discovers plugins from:
- `~/.openclaw/extensions/*` (and workspace/global extensions dirs)
- `plugins.load.paths` (extra directories/files)

For local development, the easiest is linking:

```bash
# from your OpenClaw host
openclaw plugins install -l /path/to/memory-lancedb-local

# then restart the gateway (config changes require restart)
openclaw gateway restart
```

Alternatively, add it via config:

```json5
{
  plugins: {
    load: {
      paths: ["/path/to/memory-lancedb-local"],
    },
  },
}
```

## Configure

This plugin is a **memory** plugin, so you typically select it via the memory slot:

```json5
{
  plugins: {
    slots: {
      memory: "memory-lancedb-local",
    },
    entries: {
      "memory-lancedb-local": {
        enabled: true,
        config: {
          embedding: {
            provider: "local",
            // optional if you keep your GGUF in ~/.openclaw/models/embeddings/
            // modelPath: "~/.openclaw/models/embeddings/bge-base-en-v1.5-q4_k_m.gguf",
            model: "bge-base-en-v1.5-q4_k_m.gguf"
          },
          dbPath: "~/.openclaw/memory/lancedb",
          autoCapture: true,
          autoRecall: true
        }
      }
    }
  }
}
```

If you want OpenAI embeddings instead:

```json5
embedding: {
  provider: "openai",
  apiKey: "${OPENAI_API_KEY}",
  model: "text-embedding-3-small"
}
```

## Notes

- Plugin manifests are **required** (`openclaw.plugin.json`). Config is validated strictly before code runs.
- Don’t commit `node_modules/` (this repo includes a `.gitignore`).
