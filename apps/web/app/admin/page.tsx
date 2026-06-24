"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const REFRESH_MS = 4000;

interface Destination {
  id: string;
  name: string;
  webhookUrl: string;
  isActive: boolean;
  createdAt: string;
}
interface QueueItem {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}
interface LogItem {
  id: string;
  source: string;
  receivedAt: string;
  leadCount: number;
  status: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "var(--amber)",
  processing: "var(--blue)",
  sent: "var(--green)",
  failed: "var(--red)",
  parsed: "var(--green)",
  no_phone: "var(--muted)",
  received: "var(--blue)",
  error: "var(--red)",
};

function Badge({ value }: { value: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: "#0b0f17",
        background: STATUS_COLOR[value] ?? "var(--muted)",
      }}
    >
      {value}
    </span>
  );
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR");
}

export default function AdminPage() {
  const [destination, setDestination] = useState<Destination | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("BotConversa");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const liveRef = useRef(live);
  liveRef.current = live;

  const refresh = useCallback(async () => {
    try {
      const [d, q, l] = await Promise.all([
        fetch("/api/admin/destinations").then((r) => r.json()),
        fetch("/api/admin/queue?limit=100").then((r) => r.json()),
        fetch("/api/admin/logs?limit=100").then((r) => r.json()),
      ]);
      setDestination(d.active ?? null);
      setQueue(q.items ?? []);
      setLogs(l.logs ?? []);
    } catch {
      /* mantém últimos dados em caso de falha transitória */
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      if (liveRef.current) refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/destinations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, webhookUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Falha ao salvar.");
      } else {
        setMessage("Link salvo com sucesso.");
        setUrl("");
        await refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function resend(id: string) {
    setResendingId(id);
    setResendMsg(null);
    try {
      const res = await fetch("/api/admin/queue/resend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok) {
        setResendMsg("Reenviado com sucesso ✅");
      } else if (data.reason === "no_destination") {
        setResendMsg("Cadastre o link do BotConversa primeiro.");
      } else if (data.reason === "send_failed") {
        setResendMsg(`Falha no envio: ${data.error ?? "erro desconhecido"}`);
      } else {
        setResendMsg(data.error ?? "Falha ao reenviar.");
      }
      await refresh();
    } finally {
      setResendingId(null);
    }
  }

  const counts = queue.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: 24 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Renovi Integrações</h1>
          <p style={{ margin: "2px 0 0", color: "var(--muted)" }}>
            RD Station → BotConversa
          </p>
        </div>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={live}
            onChange={(e) => setLive(e.target.checked)}
          />
          <span style={{ color: "var(--muted)" }}>
            Atualização em tempo real ({REFRESH_MS / 1000}s)
          </span>
        </label>
      </header>

      <Panel title="Link do BotConversa">
        <form
          onSubmit={save}
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <input
            placeholder="Nome (opcional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle(180)}
          />
          <input
            placeholder="https://backend.botconversa.com.br/api/webhooks/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={inputStyle(440)}
          />
          <button type="submit" disabled={saving} style={btnStyle}>
            {saving ? "Salvando…" : "Salvar link"}
          </button>
        </form>
        {message && (
          <p style={{ marginBottom: 0, color: "var(--muted)" }}>{message}</p>
        )}
        <p style={{ marginBottom: 0, color: "var(--muted)" }}>
          Ativo:{" "}
          {destination ? (
            <code style={{ color: "var(--text)" }}>
              {destination.webhookUrl}
            </code>
          ) : (
            <em>nenhum link cadastrado</em>
          )}
        </p>
      </Panel>

      <Panel
        title={`Fila de envios (${queue.length})`}
        subtitle={Object.entries(counts)
          .map(([k, v]) => `${k}: ${v}`)
          .join("  ·  ")}
      >
        {resendMsg && (
          <p style={{ marginTop: 0, color: "var(--muted)" }}>{resendMsg}</p>
        )}
        <Table
          head={[
            "Criado",
            "Nome",
            "Sobrenome",
            "Telefone",
            "Status",
            "Tent.",
            "Enviado",
            "Último erro",
            "Ações",
          ]}
          rows={queue.map((i) => [
            fmt(i.createdAt),
            i.firstName,
            i.lastName,
            i.phone,
            <Badge key="s" value={i.status} />,
            String(i.attempts),
            fmt(i.sentAt),
            i.lastError ?? "—",
            <button
              key="r"
              onClick={() => resend(i.id)}
              disabled={resendingId === i.id}
              style={smallBtnStyle}
            >
              {resendingId === i.id ? "Enviando…" : "Reenviar"}
            </button>,
          ])}
          empty="Fila vazia."
        />
      </Panel>

      <Panel title={`Logs recebidos (${logs.length})`}>
        <Table
          head={["Recebido", "Origem", "Leads", "Status", "ID"]}
          rows={logs.map((l) => [
            fmt(l.receivedAt),
            l.source,
            String(l.leadCount),
            <Badge key="s" value={l.status} />,
            <code key="id" style={{ color: "var(--muted)" }}>
              {l.id.slice(0, 8)}
            </code>,
          ])}
          empty="Nenhum webhook recebido ainda."
        />
      </Panel>
    </main>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>{title}</h2>
        {subtitle && (
          <span style={{ color: "var(--muted)", fontSize: 12 }}>{subtitle}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Table({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p style={{ color: "var(--muted)", margin: 0 }}>{empty}</p>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "6px 10px",
                  color: "var(--muted)",
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: "6px 10px",
                    borderBottom: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function inputStyle(width: number): React.CSSProperties {
  return {
    width,
    maxWidth: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "#0b0f17",
    color: "var(--text)",
  };
}

const btnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const smallBtnStyle: React.CSSProperties = {
  padding: "3px 10px",
  borderRadius: 6,
  border: "1px solid var(--accent)",
  background: "transparent",
  color: "var(--accent)",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
