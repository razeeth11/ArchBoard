import { SB } from "./sbuilder";
import { normalizeProps, type PropSchema, type Props, type SmartDef } from "./types";

const num = (
  key: string,
  label: string,
  min: number,
  max: number,
  def: number,
  help?: string,
): PropSchema => ({ key, label, type: "number", min, max, step: 1, default: def, help });
const sel = (
  key: string,
  label: string,
  options: string[],
  def: string,
  help?: string,
): PropSchema => ({ key, label, type: "select", options, default: def, help });
const bool = (key: string, label: string, def: boolean, help?: string): PropSchema => ({
  key,
  label,
  type: "boolean",
  default: def,
  help,
});
const txt = (key: string, label: string, def: string, maxLength = 40): PropSchema => ({
  key,
  label,
  type: "text",
  default: def,
  maxLength,
});

const DB_ICON: Record<string, string> = {
  Postgres: "logos:postgresql",
  MySQL: "logos:mysql",
  MongoDB: "logos:mongodb-icon",
};
const BROKER_ICON: Record<string, string> = {
  Kafka: "logos:kafka-icon",
  RabbitMQ: "logos:rabbitmq-icon",
  SQS: "logos:aws-sqs",
};
const W = 150;
const H = 88;

function def(
  id: string,
  name: string,
  category: string,
  description: string,
  keywords: string[],
  schema: PropSchema[],
  build: (p: Props, sb: SB) => void | Promise<void>,
  version = 1,
): SmartDef {
  return {
    id,
    name,
    version,
    category,
    description,
    keywords,
    schema,
    generate: async (raw) => {
      const p = normalizeProps(schema, raw);
      const sb = new SB();
      await build(p, sb);
      return sb.done();
    },
  };
}

const n = (v: unknown) => Number(v);
const s = (v: unknown) => String(v);
const range = (count: number) => Array.from({ length: count }, (_, i) => i);

export const SMART_DEFS: SmartDef[] = [
  def(
    "load-balanced-service",
    "Load-balanced service",
    "Scaling",
    "A load balancer in front of N identical replicas, optionally with health checks.",
    ["lb", "replicas", "scale out", "health"],
    [
      num("replicas", "Replicas", 1, 8, 3),
      sel("lbType", "Load balancer", ["L4", "L7"], "L7"),
      bool("showHealthChecks", "Health checks", true),
      txt("serviceName", "Service name", "Orders service"),
    ],
    async (p, sb) => {
      const r = n(p.replicas);
      const gap = 18;
      await sb.node("lb", 30, 40 + ((r - 1) * (H + gap)) / 2, `${s(p.lbType)} load balancer`, {
        cat: "Edge & network",
        icon: "carbon:load-balancer-application",
      });
      for (const i of range(r)) {
        await sb.node(
          `replica-${i + 1}`,
          300,
          40 + i * (H + gap),
          `${s(p.serviceName)} #${i + 1}`,
          { cat: "Compute", icon: "carbon:application" },
        );
        sb.edge(`lb-to-${i + 1}`, "lb", `replica-${i + 1}`, {});
      }
      const members = ["lb", ...range(r).map((i) => `replica-${i + 1}`)];
      if (p.showHealthChecks) {
        await sb.node("health", 30, 40 + ((r - 1) * (H + gap)) / 2 + H + 90, "Health checks", {
          cat: "Operations",
          icon: "mdi:heart-pulse",
          dashed: true,
        });
        sb.edge("health-probe", "health", "lb", { dashed: true, label: "probe" });
        members.push("health");
      }
      sb.wrap("root", `${s(p.serviceName)}`, members);
      sb.port("in", "lb", "Traffic enters here");
      for (const i of range(r))
        sb.port(`replica-${i + 1}`, `replica-${i + 1}`, `Direct connection to replica ${i + 1}`);
    },
  ),

  def(
    "database-with-replicas",
    "Database with replicas",
    "Data",
    "A primary database with read replicas, optionally spread over two availability zones.",
    ["postgres", "mysql", "replication", "read replica", "multi-az", "ha"],
    [
      sel("primary", "Engine", ["Postgres", "MySQL", "MongoDB"], "Postgres"),
      num("readReplicas", "Read replicas", 0, 6, 2),
      bool("multiAZ", "Multi-AZ standby", true),
      bool("showBackups", "Backups", false),
    ],
    async (p, sb) => {
      const icon = DB_ICON[s(p.primary)]!;
      const r = n(p.readReplicas);
      await sb.node("primary", 40, 50, `${s(p.primary)} primary`, { cat: "Data", icon });
      const members = ["primary"];
      for (const i of range(r)) {
        const x = 40 + (i + 1) * (W + 40);
        await sb.node(`replica-${i + 1}`, x, 50, `Read replica ${i + 1}`, { cat: "Data", icon });
        sb.edge(`repl-${i + 1}`, "primary", `replica-${i + 1}`, {
          dashed: true,
          label: "replicates",
        });
        members.push(`replica-${i + 1}`);
      }
      if (p.multiAZ) {
        await sb.node("standby", 40, 230, "Standby (other AZ)", {
          cat: "Data",
          icon,
          dashed: true,
        });
        sb.edge("sync", "primary", "standby", { label: "sync", start: "arrow" });
        members.push("standby");
        sb.wrap("az-b", "Availability zone B", ["standby"]);
        members.push("az-b");
      }
      if (p.showBackups) {
        await sb.node(
          "backup",
          40 + (Math.max(r, 1) + 1) * (W + 40) - (W + 40) + 0,
          230,
          "Backups",
          { cat: "Data", icon: "carbon:data-backup", dashed: true },
        );
        sb.edge("backup-edge", "primary", "backup", { dashed: true, label: "snapshots" });
        members.push("backup");
      }
      sb.wrap("root", `${s(p.primary)} cluster`, members);
      sb.port("write", "primary", "Writes go to the primary");
      for (const i of range(r))
        sb.port(`read-${i + 1}`, `replica-${i + 1}`, `Reads from replica ${i + 1}`);
    },
  ),

  def(
    "queue-with-consumers",
    "Queue with consumers",
    "Messaging",
    "Producers, a broker with partitions, consumer groups and an optional dead-letter queue.",
    ["kafka", "rabbitmq", "sqs", "partitions", "consumer group", "dlq"],
    [
      sel("broker", "Broker", ["Kafka", "RabbitMQ", "SQS"], "Kafka"),
      num("partitions", "Partitions", 1, 12, 6),
      num("consumerGroups", "Consumer groups", 1, 4, 2),
      bool("dlq", "Dead-letter queue", true),
    ],
    async (p, sb) => {
      const parts = n(p.partitions);
      const groups = n(p.consumerGroups);
      const cols = Math.min(parts, 4);
      const rows = Math.ceil(parts / cols);
      const brokerW = cols * 70 + 30;
      const brokerH = rows * 50 + 70;
      await sb.node("producer", 20, 40 + (brokerH - H) / 2, "Producer", {
        cat: "Compute",
        icon: "carbon:application",
      });
      sb.box("broker", 300, 40, brokerW, brokerH, s(p.broker), {
        bg: "#fff3bf",
        stroke: "#f08c00",
        font: 15,
      });
      const unit = s(p.broker) === "Kafka" ? "P" : s(p.broker) === "SQS" ? "msg" : "q";
      for (const i of range(parts)) {
        sb.box(
          `partition-${i + 1}`,
          315 + (i % cols) * 70,
          80 + Math.floor(i / cols) * 50,
          60,
          36,
          `${unit}${i}`,
          { bg: "#ffffff", stroke: "#f08c00", font: 13 },
        );
      }
      sb.edge("produce", "producer", "broker", { label: "publish" });
      const gx = 300 + brokerW + 130;
      const members = ["producer", "broker"];
      for (const g of range(groups)) {
        await sb.node(`group-${g + 1}`, gx, 40 + g * (H + 24), `Consumer group ${g + 1}`, {
          cat: "Compute",
          icon: "mdi:cogs",
        });
        sb.edge(`consume-${g + 1}`, "broker", `group-${g + 1}`, {
          label: g === 0 ? "poll" : undefined,
        });
        members.push(`group-${g + 1}`);
      }
      if (p.dlq) {
        await sb.node("dlq", 300 + (brokerW - W) / 2, 40 + brokerH + 100, "Dead-letter queue", {
          cat: "Security",
          icon: "mdi:message-processing",
          dashed: true,
        });
        sb.edge("to-dlq", "broker", "dlq", { dashed: true, label: "failed after retries" });
        members.push("dlq");
      }
      sb.wrap("root", `${s(p.broker)} messaging`, members);
      sb.port("in", "producer", "Send messages here");
      sb.port("out", "group-1", "Consumed messages leave here");
    },
  ),

  def(
    "cache-aside",
    "Cache-aside",
    "Data",
    "The application checks the cache first and loads from the database on a miss.",
    ["redis", "memcached", "ttl", "lazy loading", "cache"],
    [
      sel("cache", "Cache", ["Redis", "Memcached"], "Redis"),
      sel("db", "Database", ["Postgres", "MySQL", "MongoDB"], "Postgres"),
      txt("ttl", "TTL", "5m", 10),
    ],
    async (p, sb) => {
      await sb.node("app", 20, 120, "Application", { cat: "Compute", icon: "carbon:application" });
      await sb.node("cache", 300, 20, s(p.cache), {
        cat: "Data",
        icon: s(p.cache) === "Redis" ? "logos:redis" : "logos:memcached",
      });
      await sb.node("db", 300, 220, s(p.db), { cat: "Data", icon: DB_ICON[s(p.db)]! });
      sb.edge("get", "app", "cache", { label: "1. GET key" });
      sb.edge("miss", "app", "db", { label: "2. on miss: query" });
      sb.text("ttl-note", 470, 56, `3. SET key\nTTL ${s(p.ttl)}`, { size: 14, stroke: "#e8590c" });
      sb.wrap("root", "Cache-aside read path", ["app", "cache", "db"]);
      sb.port("in", "app", "Requests enter the application");
      sb.port("cache", "cache", "Cache");
      sb.port("db", "db", "Source of truth");
    },
  ),

  def(
    "api-gateway-fanout",
    "API gateway fan-out",
    "Edge",
    "Clients reach N backend services through a gateway with optional auth and rate limiting.",
    ["gateway", "bff", "auth", "rate limit", "routing"],
    [
      num("services", "Services", 1, 8, 4),
      bool("auth", "Authentication", true),
      bool("rateLimit", "Rate limiting", true),
    ],
    async (p, sb) => {
      const svc = n(p.services);
      const midY = 40 + ((svc - 1) * (H + 18)) / 2;
      await sb.node("client", 20, midY, "Clients", { cat: "Clients", icon: "mdi:web" });
      let prev = "client";
      let x = 220;
      const members = ["client"];
      if (p.rateLimit) {
        await sb.node("ratelimit", x, midY, "Rate limiter", {
          cat: "Edge & network",
          icon: "mdi:speedometer",
        });
        sb.edge("e-client-rl", prev, "ratelimit", {});
        prev = "ratelimit";
        members.push("ratelimit");
        x += W + 50;
      }
      if (p.auth) {
        await sb.node("auth", x, midY, "Auth", { cat: "Security", icon: "logos:auth0" });
        sb.edge("e-prev-auth", prev, "auth", {});
        prev = "auth";
        members.push("auth");
        x += W + 50;
      }
      await sb.node("gateway", x, midY, "API gateway", {
        cat: "Edge & network",
        icon: "carbon:gateway",
      });
      sb.edge("e-prev-gw", prev, "gateway", {});
      members.push("gateway");
      for (const i of range(svc)) {
        await sb.node(`svc-${i + 1}`, x + W + 80, 40 + i * (H + 18), `Service ${i + 1}`, {
          cat: "Compute",
          icon: "carbon:microservices-1",
        });
        sb.edge(`route-${i + 1}`, "gateway", `svc-${i + 1}`, {});
        members.push(`svc-${i + 1}`);
      }
      sb.wrap("root", "API gateway", members);
      sb.port("in", "client", "Clients call in here");
      sb.port("gateway", "gateway", "The gateway itself");
      for (const i of range(svc))
        sb.port(`svc-${i + 1}`, `svc-${i + 1}`, `Backend service ${i + 1}`);
    },
  ),

  def(
    "k8s-deployment",
    "Kubernetes deployment",
    "Platform",
    "Ingress, a Service and a Deployment of N pods, with optional autoscaling.",
    ["kubernetes", "k8s", "pods", "hpa", "ingress", "service"],
    [
      num("replicas", "Replicas", 1, 8, 3),
      bool("hpa", "Horizontal Pod Autoscaler", true),
      sel("service", "Service type", ["ClusterIP", "NodePort", "LoadBalancer"], "ClusterIP"),
      bool("ingress", "Ingress", true),
    ],
    async (p, sb) => {
      const r = n(p.replicas);
      const cols = Math.min(r, 4);
      const rows = Math.ceil(r / cols);
      let x = 20;
      const members: string[] = [];
      const mid = 60 + (rows * 70) / 2 - 30;
      let prev: string | null = null;
      if (p.ingress) {
        await sb.node("ingress", x, mid - 10, "Ingress", {
          cat: "Edge & network",
          icon: "carbon:gateway",
          h: 80,
        });
        members.push("ingress");
        prev = "ingress";
        x += W + 60;
      }
      await sb.node("service", x, mid - 10, `Service (${s(p.service)})`, {
        cat: "Edge & network",
        icon: "logos:kubernetes",
        h: 80,
      });
      members.push("service");
      if (prev) sb.edge("ing-svc", prev, "service", {});
      x += W + 140;
      for (const i of range(r)) {
        await sb.node(
          `pod-${i + 1}`,
          x + (i % cols) * 120,
          60 + Math.floor(i / cols) * 90,
          `pod-${i + 1}`,
          { cat: "Compute", icon: "logos:docker-icon", w: 104, h: 76, font: 13 },
        );
        members.push(`pod-${i + 1}`);
      }
      sb.wrap(
        "deployment",
        `Deployment (${r} replicas)`,
        range(r).map((i) => `pod-${i + 1}`),
        { dashed: false, stroke: "#2f9e44" },
      );
      members.push("deployment");
      sb.edge("svc-deploy", "service", "deployment", { label: "selects pods" });
      if (p.hpa) {
        await sb.node("hpa", x + (cols * 120) / 2 - 55, -120, "HPA", {
          cat: "Operations",
          icon: "carbon:rocket",
          w: 110,
          h: 76,
          dashed: true,
        });
        sb.edge("hpa-scale", "hpa", "deployment", { dashed: true, label: "scales" });
        members.push("hpa");
      }
      sb.wrap("root", "Namespace", members);
      if (p.ingress) sb.port("in", "ingress", "External traffic");
      sb.port("service", "service", "Cluster-internal entry point");
    },
  ),

  def(
    "cqrs",
    "CQRS pattern",
    "Patterns",
    "Commands write through a write model; events feed read-optimised projections for queries.",
    ["cqrs", "event", "projection", "read model", "write model"],
    [num("projections", "Read models", 1, 4, 2), bool("showClient", "Show client", true)],
    async (p, sb) => {
      const k = n(p.projections);
      const members: string[] = [];
      if (p.showClient) {
        await sb.node("client", 20, 20, "Client", { cat: "Clients", icon: "mdi:web" });
        members.push("client");
      }
      await sb.node("command", 240, 20, "Command API", {
        cat: "Edge & network",
        icon: "carbon:api",
      });
      await sb.node("write", 500, 20, "Write model", { cat: "Data", icon: "logos:postgresql" });
      await sb.node("bus", 760, 20, "Event bus", { cat: "Messaging", icon: "logos:kafka-icon" });
      sb.edge("cmd-write", "command", "write", { label: "command" });
      sb.edge("write-bus", "write", "bus", { label: "domain events" });
      members.push("command", "write", "bus");
      await sb.node("query", 1420, 20 + ((k - 1) * 110) / 2, "Query API", {
        cat: "Edge & network",
        icon: "carbon:api",
      });
      members.push("query");
      for (const i of range(k)) {
        await sb.node(`projection-${i + 1}`, 980, 20 + i * 110, `Projector ${i + 1}`, {
          cat: "Compute",
          icon: "mdi:cogs",
          h: 88,
        });
        await sb.node(`read-${i + 1}`, 1200, 20 + i * 110, `Read model ${i + 1}`, {
          cat: "Data",
          icon: "logos:elasticsearch",
          h: 88,
        });
        sb.edge(`bus-proj-${i + 1}`, "bus", `projection-${i + 1}`, {});
        sb.edge(`proj-read-${i + 1}`, `projection-${i + 1}`, `read-${i + 1}`, {});
        sb.edge(`read-query-${i + 1}`, `read-${i + 1}`, "query", { dashed: true });
        members.push(`projection-${i + 1}`, `read-${i + 1}`);
      }
      if (p.showClient) sb.edge("client-cmd", "client", "command", {});
      sb.wrap("root", "CQRS", members);
      sb.port("commands", "command", "Send commands here");
      sb.port("queries", "query", "Run queries here");
    },
  ),

  def(
    "saga-orchestrator",
    "Saga orchestrator",
    "Patterns",
    "An orchestrator drives a sequence of local transactions and compensates on failure.",
    ["saga", "orchestration", "distributed transaction", "compensation"],
    [num("steps", "Steps", 2, 8, 4), bool("compensations", "Compensating actions", true)],
    async (p, sb) => {
      const steps = n(p.steps);
      const w = steps * (W + 30);
      await sb.node("orchestrator", 20 + (w - W) / 2 - 15, 20, "Saga orchestrator", {
        cat: "Operations",
        icon: "carbon:workflow-automation",
      });
      const members = ["orchestrator"];
      for (const i of range(steps)) {
        const x = 20 + i * (W + 30);
        await sb.node(`step-${i + 1}`, x, 190, `Step ${i + 1}`, {
          cat: "Compute",
          icon: "carbon:microservices-1",
        });
        sb.edge(`do-${i + 1}`, "orchestrator", `step-${i + 1}`, {
          label: i === 0 ? "execute" : undefined,
        });
        members.push(`step-${i + 1}`);
        if (p.compensations) {
          await sb.node(`undo-${i + 1}`, x, 340, `Undo ${i + 1}`, {
            cat: "Security",
            icon: "mdi:sync",
            dashed: true,
            h: 76,
          });
          sb.edge(`comp-${i + 1}`, `step-${i + 1}`, `undo-${i + 1}`, {
            dashed: true,
            label: i === 0 ? "on failure" : undefined,
          });
          members.push(`undo-${i + 1}`);
        }
      }
      sb.wrap("root", "Saga", members);
      sb.port("start", "orchestrator", "Start the saga");
      for (const i of range(steps))
        sb.port(`step-${i + 1}`, `step-${i + 1}`, `Participant ${i + 1}`);
    },
  ),

  def(
    "event-sourcing",
    "Event sourcing",
    "Patterns",
    "State is the fold of an append-only event log, with projections and optional snapshots.",
    ["event store", "aggregate", "projection", "snapshot", "append only"],
    [
      num("projections", "Projections", 1, 4, 2),
      bool("snapshots", "Snapshots", true),
      num("events", "Events shown", 2, 6, 4),
    ],
    async (p, sb) => {
      const ev = n(p.events);
      const k = n(p.projections);
      await sb.node("command", 20, 100, "Command", {
        cat: "Clients",
        icon: "mdi:gesture-tap-button",
      });
      await sb.node("aggregate", 230, 100, "Aggregate", {
        cat: "Compute",
        icon: "carbon:application",
      });
      sb.edge("cmd-agg", "command", "aggregate", {});
      const storeW = ev * 64 + 24;
      sb.box("store", 440, 90, storeW, 108, "Event store (append-only)", {
        bg: "#fff3bf",
        stroke: "#f08c00",
        font: 14,
      });
      for (const i of range(ev))
        sb.box(`event-${i + 1}`, 452 + i * 64, 138, 54, 40, `e${i + 1}`, {
          bg: "#ffffff",
          stroke: "#f08c00",
          font: 14,
        });
      sb.edge("agg-store", "aggregate", "store", { label: "append" });
      const px = 440 + storeW + 70;
      const members = ["command", "aggregate", "store"];
      for (const i of range(k)) {
        await sb.node(`projection-${i + 1}`, px, 20 + i * 110, `Projection ${i + 1}`, {
          cat: "Data",
          icon: "logos:elasticsearch",
          h: 80,
        });
        sb.edge(`store-proj-${i + 1}`, "store", `projection-${i + 1}`, {});
        members.push(`projection-${i + 1}`);
      }
      if (p.snapshots) {
        await sb.node("snapshot", 440 + (storeW - W) / 2, 260, "Snapshots", {
          cat: "Data",
          icon: "carbon:data-backup",
          dashed: true,
        });
        sb.edge("store-snap", "store", "snapshot", { dashed: true, label: "every N events" });
        members.push("snapshot");
      }
      sb.wrap("root", "Event sourcing", members);
      sb.port("commands", "command", "Commands enter here");
      sb.port("events", "store", "Subscribe to the event log");
    },
  ),

  def(
    "circuit-breaker",
    "Circuit breaker",
    "Resilience",
    "Closed → open → half-open state machine protecting a downstream call.",
    ["resilience", "fault tolerance", "half-open", "fallback"],
    [
      num("threshold", "Failure threshold", 1, 50, 5),
      txt("timeout", "Open timeout", "30s", 10),
      bool("showHalfOpen", "Half-open state", true),
      bool("fallback", "Fallback", true),
    ],
    async (p, sb) => {
      sb.box("closed", 30, 60, 150, 80, "Closed\nrequests flow", {
        shape: "ellipse",
        bg: "#d3f9d8",
        stroke: "#2f9e44",
      });
      sb.box("open", 380, 60, 150, 80, "Open\nfail fast", {
        shape: "ellipse",
        bg: "#ffe3e3",
        stroke: "#e03131",
      });
      sb.edge("trip", "closed", "open", { label: `${n(p.threshold)} failures` });
      const members = ["closed", "open"];
      if (p.showHalfOpen) {
        sb.box("half", 205, 250, 150, 80, "Half-open\nprobe", {
          shape: "ellipse",
          bg: "#fff3bf",
          stroke: "#f08c00",
        });
        sb.edge("timeout", "open", "half", { label: `after ${s(p.timeout)}` });
        sb.edge("recover", "half", "closed", { label: "probe ok" });
        sb.text("relapse-note", 380, 300, "probe fails → Open again", {
          size: 13,
          stroke: "#e03131",
        });
        members.push("half");
      } else {
        sb.edge("reset", "open", "closed", { label: `after ${s(p.timeout)}`, dashed: true });
      }
      if (p.fallback) {
        await sb.node("fallback", 600, 60, "Fallback", {
          cat: "Operations",
          icon: "mdi:shield-check",
          dashed: true,
        });
        sb.edge("use-fallback", "open", "fallback", { dashed: true });
        members.push("fallback");
      }
      sb.wrap("root", "Circuit breaker", members);
      sb.port("closed", "closed", "Normal operation");
      sb.port("open", "open", "Tripped");
    },
  ),

  def(
    "three-tier-web-app",
    "Three-tier web app",
    "Architectures",
    "Presentation, application and data tiers with optional CDN and cache.",
    ["web", "3-tier", "n-tier", "lamp", "classic"],
    [
      num("webInstances", "Web servers", 1, 4, 2),
      num("appInstances", "App servers", 1, 4, 2),
      num("dbReplicas", "DB replicas", 0, 3, 1),
      bool("cdn", "CDN", true),
      bool("cache", "Cache", true),
    ],
    async (p, sb) => {
      const web = n(p.webInstances);
      const app = n(p.appInstances);
      const dbr = n(p.dbReplicas);
      const rows = Math.max(web, app, dbr + 1, 2);
      const mid = 40 + ((rows - 1) * (H + 18)) / 2;
      let x = 20;
      const members: string[] = [];
      await sb.node("users", x, mid, "Users", { cat: "Clients", icon: "mdi:account-group" });
      members.push("users");
      let prev = "users";
      x += W + 50;
      if (p.cdn) {
        await sb.node("cdn", x, mid, "CDN", { cat: "Edge & network", icon: "lucide:globe" });
        sb.edge("users-cdn", prev, "cdn", {});
        prev = "cdn";
        members.push("cdn");
        x += W + 50;
      }
      await sb.node("lb", x, mid, "Load balancer", {
        cat: "Edge & network",
        icon: "carbon:load-balancer-application",
      });
      sb.edge("prev-lb", prev, "lb", {});
      members.push("lb");
      x += W + 60;
      for (const i of range(web)) {
        await sb.node(`web-${i + 1}`, x, 40 + i * (H + 18), `Web ${i + 1}`, {
          cat: "Compute",
          icon: "logos:nginx",
        });
        sb.edge(`lb-web-${i + 1}`, "lb", `web-${i + 1}`, {});
        members.push(`web-${i + 1}`);
      }
      x += W + 60;
      // Every web server reaches an app server and every app server is reachable from a web server.
      const links: [number, number][] = [];
      for (const w of range(web)) links.push([w, w % app]);
      for (const i of range(app)) if (i >= web) links.push([i % web, i]);
      for (const i of range(app)) {
        await sb.node(`app-${i + 1}`, x, 40 + i * (H + 18), `App ${i + 1}`, {
          cat: "Compute",
          icon: "carbon:application",
        });
        for (const [w, ai] of links)
          if (ai === i) sb.edge(`web-${w + 1}-app-${i + 1}`, `web-${w + 1}`, `app-${i + 1}`, {});
        members.push(`app-${i + 1}`);
      }
      x += W + 60;
      await sb.node("db", x, 40, "Primary DB", { cat: "Data", icon: "logos:postgresql" });
      members.push("db");
      for (const i of range(dbr)) {
        await sb.node(`dbr-${i + 1}`, x, 40 + (i + 1) * (H + 18), `Replica ${i + 1}`, {
          cat: "Data",
          icon: "logos:postgresql",
          dashed: true,
        });
        sb.edge(`db-repl-${i + 1}`, "db", `dbr-${i + 1}`, { dashed: true });
        members.push(`dbr-${i + 1}`);
      }
      for (const i of range(app)) sb.edge(`app-${i + 1}-db`, `app-${i + 1}`, "db", {});
      if (p.cache) {
        await sb.node("cache", x - W - 60, 40 + Math.max(app, 1) * (H + 18) + 20, "Cache", {
          cat: "Data",
          icon: "logos:redis",
          dashed: true,
        });
        sb.edge("app-cache", `app-${app}`, "cache", { dashed: true });
        members.push("cache");
      }
      sb.wrap("root", "Three-tier web application", members);
      sb.port("in", p.cdn ? "cdn" : "lb", "Public entry point");
      sb.port("db", "db", "Primary database");
    },
  ),

  def(
    "multi-region-active-passive",
    "Multi-region active/passive",
    "Architectures",
    "A primary region serving traffic with warm standby regions and a failover mechanism.",
    ["dr", "disaster recovery", "failover", "regions", "replication"],
    [
      num("regions", "Regions", 2, 3, 2),
      sel("failover", "Failover", ["DNS", "Global LB"], "DNS"),
      sel("replication", "Replication", ["async", "sync"], "async"),
    ],
    async (p, sb) => {
      const regions = n(p.regions);
      const colW = W + 90;
      const total = regions * colW;
      await sb.node("users", 20 + (total - W) / 2 - 20, 20, "Users", {
        cat: "Clients",
        icon: "mdi:account-group",
      });
      await sb.node(
        "failover",
        20 + (total - W) / 2 - 20,
        160,
        s(p.failover) === "DNS" ? "DNS failover" : "Global load balancer",
        {
          cat: "Edge & network",
          icon: s(p.failover) === "DNS" ? "carbon:dns-services" : "carbon:load-balancer-network",
        },
      );
      sb.edge("users-fo", "users", "failover", {});
      const members = ["users", "failover"];
      for (const i of range(regions)) {
        const x = 20 + i * colW - 20 + (colW - W) / 2 + 20;
        const active = i === 0;
        await sb.node(`app-${i + 1}`, x - 20 + 0, 330, active ? "App (active)" : "App (standby)", {
          cat: "Compute",
          icon: "carbon:application",
          dashed: !active,
        });
        await sb.node(`db-${i + 1}`, x - 20, 480, active ? "DB (primary)" : "DB (replica)", {
          cat: "Data",
          icon: "logos:postgresql",
          dashed: !active,
        });
        sb.edge(`fo-app-${i + 1}`, "failover", `app-${i + 1}`, {
          dashed: !active,
          label: active ? "serves traffic" : "on failover",
        });
        sb.edge(`app-db-${i + 1}`, `app-${i + 1}`, `db-${i + 1}`, { dashed: !active });
        sb.wrap(
          `region-${i + 1}`,
          `Region ${String.fromCharCode(65 + i)}${active ? " (active)" : ""}`,
          [`app-${i + 1}`, `db-${i + 1}`],
          { stroke: active ? "#2f9e44" : "#868e96" },
        );
        members.push(`app-${i + 1}`, `db-${i + 1}`, `region-${i + 1}`);
        if (i > 0)
          sb.edge(`repl-${i + 1}`, "db-1", `db-${i + 1}`, {
            dashed: true,
            label: `${s(p.replication)} replication`,
          });
      }
      sb.wrap(
        "root",
        "Multi-region active/passive",
        members.filter((m) => !m.startsWith("region-")),
      );
      sb.port("in", "failover", "Traffic entry");
      sb.port("active-db", "db-1", "Active database");
    },
  ),

  def(
    "cdn-origin-shield",
    "CDN with origin shield",
    "Edge",
    "Edge locations fall back to a single shield layer that protects the origin.",
    ["cdn", "cache", "shield", "origin", "edge"],
    [
      num("edges", "Edge locations", 1, 6, 3),
      bool("shield", "Origin shield", true),
      txt("origin", "Origin", "Origin", 24),
    ],
    async (p, sb) => {
      const e = n(p.edges);
      const members: string[] = [];
      for (const i of range(e)) {
        await sb.node(
          `user-${i + 1}`,
          20,
          40 + i * (H + 16),
          `Users ${String.fromCharCode(65 + i)}`,
          { cat: "Clients", icon: "mdi:account-group", h: 76 },
        );
        await sb.node(`edge-${i + 1}`, 250, 40 + i * (H + 16), `Edge ${i + 1}`, {
          cat: "Edge & network",
          icon: "lucide:globe",
          h: 76,
        });
        sb.edge(`user-edge-${i + 1}`, `user-${i + 1}`, `edge-${i + 1}`, {});
        members.push(`user-${i + 1}`, `edge-${i + 1}`);
      }
      const mid = 40 + ((e - 1) * (H + 16)) / 2;
      let x = 250 + W + 80;
      let prev = "";
      if (p.shield) {
        await sb.node("shield", x, mid, "Origin shield", {
          cat: "Security",
          icon: "mdi:shield-check",
        });
        for (const i of range(e))
          sb.edge(`edge-shield-${i + 1}`, `edge-${i + 1}`, "shield", {
            dashed: true,
            label: i === 0 ? "cache miss" : undefined,
          });
        members.push("shield");
        prev = "shield";
        x += W + 80;
      }
      await sb.node("origin", x, mid, s(p.origin), { cat: "Compute", icon: "carbon:application" });
      members.push("origin");
      if (prev) sb.edge("shield-origin", prev, "origin", { label: "single fetch" });
      else
        for (const i of range(e))
          sb.edge(`edge-origin-${i + 1}`, `edge-${i + 1}`, "origin", { dashed: true });
      sb.wrap("root", "CDN", members);
      sb.port("origin", "origin", "Origin server");
      sb.port("users", "user-1", "Client traffic");
    },
  ),

  def(
    "etl-pipeline",
    "ETL pipeline",
    "Data",
    "Sources feed ingestion, transformation stages and a warehouse or lake, optionally orchestrated.",
    ["etl", "elt", "batch", "data pipeline", "airflow", "warehouse"],
    [
      num("sources", "Sources", 1, 4, 2),
      num("stages", "Transform stages", 1, 4, 2),
      sel("sink", "Destination", ["Warehouse", "Data lake"], "Warehouse"),
      bool("orchestrator", "Orchestrator", true),
    ],
    async (p, sb) => {
      const src = n(p.sources);
      const st = n(p.stages);
      const midY = 60 + ((src - 1) * (H + 18)) / 2;
      const members: string[] = [];
      for (const i of range(src)) {
        await sb.node(`source-${i + 1}`, 20, 60 + i * (H + 18), `Source ${i + 1}`, {
          cat: "External",
          icon: ["logos:postgresql", "logos:mysql", "mdi:api", "logos:aws-s3"][i]!,
          h: 80,
        });
        members.push(`source-${i + 1}`);
      }
      await sb.node("ingest", 230, midY, "Ingest", {
        cat: "Messaging",
        icon: "logos:kafka-icon",
        h: 80,
      });
      for (const i of range(src)) sb.edge(`src-ingest-${i + 1}`, `source-${i + 1}`, "ingest", {});
      members.push("ingest");
      let prev = "ingest";
      let x = 230 + W + 60;
      for (const i of range(st)) {
        await sb.node(`stage-${i + 1}`, x, midY, `Transform ${i + 1}`, {
          cat: "Compute",
          icon: "logos:apache-spark",
          h: 80,
        });
        sb.edge(`flow-${i + 1}`, prev, `stage-${i + 1}`, {});
        prev = `stage-${i + 1}`;
        members.push(prev);
        x += W + 60;
      }
      const lake = s(p.sink) === "Data lake";
      await sb.node("sink", x, midY, s(p.sink), {
        cat: "Data",
        icon: lake ? "logos:aws-s3" : "logos:snowflake-icon",
        h: 80,
      });
      sb.edge("to-sink", prev, "sink", {});
      members.push("sink");
      if (p.orchestrator) {
        await sb.node("orchestrator", 230 + W / 2 + 40, -90, "Orchestrator", {
          cat: "Operations",
          icon: "carbon:workflow-automation",
          dashed: true,
          h: 76,
        });
        for (const i of range(st))
          sb.edge(`orch-${i + 1}`, "orchestrator", `stage-${i + 1}`, { dashed: true });
        members.push("orchestrator");
      }
      sb.wrap("root", "ETL pipeline", members);
      sb.port("in", "ingest", "Land raw data here");
      sb.port("out", "sink", "Curated data");
    },
  ),

  def(
    "pubsub-fanout",
    "Pub/sub fan-out",
    "Messaging",
    "One publisher, a topic, and N independent subscribers (with an optional dead-letter queue).",
    ["pubsub", "fan out", "sns", "topic", "subscribers"],
    [
      num("subscribers", "Subscribers", 1, 8, 3),
      bool("dlq", "Dead-letter queue", false),
      txt("topic", "Topic", "orders.created", 28),
    ],
    async (p, sb) => {
      const k = n(p.subscribers);
      const mid = 40 + ((k - 1) * (H + 16)) / 2;
      await sb.node("publisher", 20, mid, "Publisher", {
        cat: "Compute",
        icon: "carbon:application",
      });
      await sb.node("topic", 250, mid, s(p.topic), { cat: "Messaging", icon: "mdi:broadcast" });
      sb.edge("publish", "publisher", "topic", {});
      const members = ["publisher", "topic"];
      for (const i of range(k)) {
        await sb.node(`subscriber-${i + 1}`, 500, 40 + i * (H + 16), `Subscriber ${i + 1}`, {
          cat: "Compute",
          icon: "mdi:cogs",
        });
        sb.edge(`deliver-${i + 1}`, "topic", `subscriber-${i + 1}`, {});
        members.push(`subscriber-${i + 1}`);
      }
      if (p.dlq) {
        await sb.node("dlq", 250, mid + H + 60, "Dead letters", {
          cat: "Security",
          icon: "mdi:message-processing",
          dashed: true,
        });
        sb.edge("to-dlq", "topic", "dlq", { dashed: true });
        members.push("dlq");
      }
      sb.wrap("root", "Pub/sub", members);
      sb.port("publish", "publisher", "Publish here");
      for (const i of range(k))
        sb.port(`subscriber-${i + 1}`, `subscriber-${i + 1}`, `Subscriber ${i + 1}`);
    },
  ),

  def(
    "worker-pool",
    "Worker pool",
    "Compute",
    "A queue drained by N workers, with optional autoscaling.",
    ["workers", "queue", "background jobs", "autoscale"],
    [
      num("workers", "Workers", 1, 10, 4),
      sel("queue", "Queue", ["Kafka", "RabbitMQ", "SQS"], "SQS"),
      bool("autoscale", "Autoscaler", true),
    ],
    async (p, sb) => {
      const w = n(p.workers);
      const cols = Math.min(w, 5);
      const rows = Math.ceil(w / cols);
      await sb.node("producer", 20, 60 + (rows * 70) / 2 - 30, "Producer", {
        cat: "Compute",
        icon: "carbon:application",
      });
      await sb.node("queue", 230, 60 + (rows * 70) / 2 - 30, s(p.queue), {
        cat: "Messaging",
        icon: BROKER_ICON[s(p.queue)]!,
      });
      sb.edge("enqueue", "producer", "queue", {});
      const members = ["producer", "queue"];
      for (const i of range(w)) {
        await sb.node(
          `worker-${i + 1}`,
          440 + (i % cols) * 120,
          40 + Math.floor(i / cols) * 90,
          `Worker ${i + 1}`,
          { cat: "Compute", icon: "mdi:cogs", w: 104, h: 76, font: 13 },
        );
        sb.edge(`pull-${i + 1}`, "queue", `worker-${i + 1}`, {});
        members.push(`worker-${i + 1}`);
      }
      if (p.autoscale) {
        await sb.node(
          "autoscaler",
          440 + (cols * 120) / 2 - 60,
          40 + rows * 90 + 30,
          "Autoscaler",
          { cat: "Operations", icon: "carbon:rocket", w: 120, h: 76, dashed: true },
        );
        sb.edge("scale", "autoscaler", "worker-1", { dashed: true, label: "queue depth" });
        members.push("autoscaler");
      }
      sb.wrap("root", "Worker pool", members);
      sb.port("enqueue", "producer", "Enqueue jobs");
      sb.port("queue", "queue", "The queue itself");
    },
  ),

  def(
    "service-mesh",
    "Service mesh",
    "Platform",
    "Services with sidecar proxies talking over mTLS, managed by a control plane.",
    ["istio", "envoy", "sidecar", "mtls", "mesh", "linkerd"],
    [num("services", "Services", 2, 5, 3), bool("controlPlane", "Control plane", true)],
    async (p, sb) => {
      const k = n(p.services);
      const members: string[] = [];
      for (const i of range(k)) {
        const x = 20 + i * (W + 90);
        await sb.node(`svc-${i + 1}`, x, 150, `Service ${i + 1}`, {
          cat: "Compute",
          icon: "carbon:microservices-1",
          h: 80,
        });
        await sb.node(`proxy-${i + 1}`, x + 15, 270, "Sidecar", {
          cat: "Edge & network",
          icon: "logos:envoy",
          w: 120,
          h: 76,
        });
        sb.edge(`local-${i + 1}`, `svc-${i + 1}`, `proxy-${i + 1}`, { start: "arrow" });
        members.push(`svc-${i + 1}`, `proxy-${i + 1}`);
        if (i > 0)
          sb.edge(`mtls-${i}`, `proxy-${i}`, `proxy-${i + 1}`, { label: "mTLS", start: "arrow" });
      }
      if (p.controlPlane) {
        await sb.node("control", 20 + ((k - 1) * (W + 90)) / 2, -40, "Control plane", {
          cat: "Operations",
          icon: "logos:kubernetes",
          dashed: true,
        });
        for (const i of range(k))
          sb.edge(`config-${i + 1}`, "control", `proxy-${i + 1}`, {
            dashed: true,
            label: i === 0 ? "config + certs" : undefined,
          });
        members.push("control");
      }
      sb.wrap("root", "Service mesh", members);
      for (const i of range(k)) sb.port(`svc-${i + 1}`, `svc-${i + 1}`, `Service ${i + 1}`);
    },
  ),
];

export const getSmartDef = (id: string) => SMART_DEFS.find((d) => d.id === id);
