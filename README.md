# Renovi Integrações

Software de integrações da Renovi Saúde. Recebe webhooks do **RD Station
Marketing/CRM**, estrutura os dados e os repassa para outros sistemas — a
primeira integração entrega **nome, sobrenome e telefone** ao **BotConversa**
para automações de WhatsApp.

> Stack: **Next.js (App Router)** + **TypeScript** · **Drizzle ORM** + **Neon
> Postgres** · monorepo **pnpm + Turborepo** · testes com **Vitest** (TDD) ·
> deploy na **Vercel**.

## Arquitetura (monorepo)

```
packages/core   @renovi/core  Domínio puro, sem I/O (testável em ms):
                              extractLeadContact · formatPhoneBR · splitName
                              · buildBotconversaPayload · dedupeKey
packages/db     @renovi/db    Schema Drizzle, cliente Neon e repositórios
                              (logs, fila, destinos). Migrations em drizzle/.
apps/web        @renovi/web   Next.js: endpoint do webhook, cron e admin.
```

### Fluxo da Funcionalidade 1 (RD Station → BotConversa)

1. **`POST /api/webhooks/rdstation`** — endpoint a cadastrar no RD Station.
   Loga o payload bruto em `webhook_logs` e, para cada lead **com telefone
   válido**, enfileira um item estruturado em `send_queue` (idempotente por
   `event_uuid` do RD). Leads sem telefone são apenas logados (`no_phone`).
2. **`/api/cron/process-queue`** — disparado pelo Vercel Cron a cada minuto.
   Roda em **self-loop** por ~55s, processando a fila **a cada 5s**: pega o
   próximo item `pending`, faz `POST` do payload para o link ativo do
   BotConversa e marca `sent`/`failed` (com backoff e retentativas).
3. **`/admin`** — cadastra o link do BotConversa e mostra logs + fila em tempo
   real (polling de 4s).

O telefone é normalizado para `+55 (DD) NNNNNNNNN`; o nome é dividido em
primeira palavra (nome) e o restante (sobrenome).

## Banco de dados

Três tabelas (`packages/db/src/schema.ts`):

- **`webhook_logs`** — auditoria do payload bruto recebido.
- **`botconversa_destinations`** — link(s) do BotConversa; o registro
  `is_active` mais recente é o usado nos envios.
- **`send_queue`** — fila estruturada (`pending` → `processing` →
  `sent`/`failed`) com `dedupe_key`, `attempts`, `next_attempt_at` (backoff).

## Desenvolvimento

```bash
pnpm install
cp .env.example .env            # preencha DATABASE_URL (Neon)
pnpm db:generate                # (re)gera SQL de migration a partir do schema
pnpm db:migrate                 # aplica as migrations no banco
pnpm --filter @renovi/web dev   # http://localhost:3000  (→ /admin)
pnpm test                       # roda toda a suíte (core + db + web)
```

Os testes do `@renovi/db` e do `@renovi/web` usam **PGlite** (Postgres real em
processo), então **não precisam de banco externo**.

### Rodando com Docker

Há um `docker-compose.yml` na raiz com quatro serviços: `db` (Postgres),
`migrate` (aplica as migrations e encerra), `web` (a aplicação) e `cron` (um
sidecar que chama o endpoint de processamento a cada 60s, simulando o Vercel
Cron localmente).

```bash
# Stack completa (banco + migrations + app + cron simulado):
docker compose up --build
#   → app em http://localhost:3000  (→ /admin)

# Apenas o banco de dados (rodando o app no host com `pnpm dev`):
docker compose up db
#   No .env use:
#   DATABASE_URL=postgresql://renovi:renovi@localhost:5432/renovi
#   DATABASE_URL_UNPOOLED=postgresql://renovi:renovi@localhost:5432/renovi
#   pnpm db:migrate && pnpm --filter @renovi/web dev
```

> O banco persiste no volume `pgdata`. Para zerar tudo: `docker compose down -v`.

### Teste manual rápido

```bash
# Simula um webhook do RD Station:
curl -X POST http://localhost:3000/api/webhooks/rdstation \
  -H 'content-type: application/json' \
  --data @packages/core/test/fixtures/rdstation/iolanda.json

# Cadastre um link de teste em /admin (ex.: https://webhook.site/...)
# e dispare o processamento da fila:
curl http://localhost:3000/api/cron/process-queue
```

## Deploy na Vercel

1. **Importar o repositório** e definir **Root Directory = `apps/web`**
   (framework Next.js detectado automaticamente). O `pnpm install` na raiz
   resolve os workspaces; `transpilePackages` compila `@renovi/core` e
   `@renovi/db`.
2. **Banco**: provisione **Neon** pelo Vercel Marketplace (popula
   `DATABASE_URL`). Defina também `DATABASE_URL_UNPOOLED` para migrations.
   Rode `pnpm db:migrate` (localmente apontando para o Neon, ou num passo de
   build/release).
3. **Cron**: já configurado em `apps/web/vercel.json`
   (`* * * * *` → `/api/cron/process-queue`).

> ⚠️ **Plano necessário para o cron de 1 minuto.** O Vercel Cron só dispara em
> intervalos de minuto no plano **Pro**. No **Hobby** ele roda ~1x/dia, o que
> quebra o processamento da fila. Opções:
> - usar plano **Pro** (recomendado); ou
> - manter Hobby e apontar um **agendador externo** (cron-job.org, Upstash
>   QStash, etc.) para `GET https://SEU_DOMINIO/api/cron/process-queue` a cada
>   1 minuto — o mesmo endpoint atende os dois casos.

### Variáveis de ambiente

| Variável                | Uso                                                  |
| ----------------------- | ---------------------------------------------------- |
| `DATABASE_URL`          | Conexão Neon com pool (app/runtime).                 |
| `DATABASE_URL_UNPOOLED` | Conexão sem pool (migrations `drizzle-kit`).         |
| `CRON_TICK_MS`          | Intervalo entre ticks da fila (padrão `5000`).       |
| `CRON_MAX_RUNTIME_MS`   | Duração do self-loop por invocação (padrão `55000`). |
| `CRON_BATCH_SIZE`       | Itens processados por tick (padrão `1`).             |

## Próximas integrações

O padrão está pronto para reuso: adicione lógica de domínio pura em
`@renovi/core` (com testes), repositórios em `@renovi/db` e rotas/handlers finos
em `apps/web`. Mantenha o ciclo **TDD (Red → Green → Refactor)**.
