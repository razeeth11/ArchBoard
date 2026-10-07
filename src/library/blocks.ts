import { Builder, DEFAULT_STYLE, type BuiltItem, type StyleCtx } from "./builder";

export type BlockCategory =
  | "Clients"
  | "Edge & network"
  | "Compute"
  | "Data"
  | "Messaging"
  | "Security"
  | "Operations"
  | "External"
  | "Boundaries";

export interface BlockDef {
  id: string;
  name: string;
  category: BlockCategory;
  description: string;
  keywords: string[];
  icon: string;
  kind: "node" | "boundary";
}

export const CATEGORY_COLORS: Record<BlockCategory, { bg: string; stroke: string }> = {
  Clients: { bg: "#d0ebff", stroke: "#1971c2" },
  "Edge & network": { bg: "#e5dbff", stroke: "#6741d9" },
  Compute: { bg: "#d3f9d8", stroke: "#2f9e44" },
  Data: { bg: "#ffe8cc", stroke: "#e8590c" },
  Messaging: { bg: "#fff3bf", stroke: "#f08c00" },
  Security: { bg: "#ffe3e3", stroke: "#e03131" },
  Operations: { bg: "#c5f6fa", stroke: "#0c8599" },
  External: { bg: "#e9ecef", stroke: "#495057" },
  Boundaries: { bg: "transparent", stroke: "#868e96" },
};

const b = (
  id: string,
  name: string,
  category: BlockCategory,
  icon: string,
  description: string,
  keywords: string[] = [],
  kind: BlockDef["kind"] = "node",
): BlockDef => ({ id, name, category, icon, description, keywords, kind });

export const BLOCKS: BlockDef[] = [
  b("client", "Client", "Clients", "lucide:monitor", "Any end-user device or caller.", [
    "user",
    "desktop",
    "caller",
  ]),
  b(
    "browser",
    "Browser",
    "Clients",
    "mdi:web",
    "Web browser running a single-page or server-rendered app.",
    ["web", "spa", "frontend"],
  ),
  b(
    "mobile-app",
    "Mobile app",
    "Clients",
    "mdi:cellphone",
    "Native or cross-platform mobile application.",
    ["ios", "android", "phone"],
  ),

  b(
    "api-gateway",
    "API gateway",
    "Edge & network",
    "carbon:gateway",
    "Single entry point handling routing, auth and throttling.",
    ["gateway", "ingress", "bff"],
  ),
  b(
    "load-balancer",
    "Load balancer",
    "Edge & network",
    "carbon:load-balancer-application",
    "Spreads traffic across healthy instances (L4 or L7).",
    ["lb", "alb", "nlb", "balancer"],
  ),
  b(
    "cdn",
    "CDN",
    "Edge & network",
    "lucide:globe",
    "Edge caches that serve static and cacheable content close to users.",
    ["edge", "cache", "cloudfront", "cloudflare"],
  ),
  b(
    "reverse-proxy",
    "Reverse proxy",
    "Edge & network",
    "logos:nginx",
    "Terminates TLS and forwards requests to backends.",
    ["nginx", "envoy", "haproxy", "proxy"],
  ),
  b(
    "dns",
    "DNS",
    "Edge & network",
    "carbon:dns-services",
    "Resolves names to addresses; often used for failover and geo routing.",
    ["route53", "domain", "resolver"],
  ),
  b(
    "firewall",
    "Firewall",
    "Edge & network",
    "carbon:firewall",
    "Network-level allow/deny rules between zones.",
    ["security group", "acl", "network"],
  ),
  b(
    "waf",
    "WAF",
    "Edge & network",
    "mdi:shield-lock",
    "Web application firewall filtering malicious HTTP traffic.",
    ["web application firewall", "owasp"],
  ),
  b(
    "rate-limiter",
    "Rate limiter",
    "Edge & network",
    "mdi:speedometer",
    "Caps request rates per client to protect backends.",
    ["throttle", "quota", "token bucket"],
  ),

  b("service", "Service", "Compute", "carbon:application", "A deployable application service.", [
    "app",
    "backend",
    "api",
  ]),
  b(
    "microservice",
    "Microservice",
    "Compute",
    "carbon:microservices-1",
    "Small, independently deployable service owning one capability.",
    ["service", "domain"],
  ),
  b(
    "worker",
    "Worker",
    "Compute",
    "mdi:cogs",
    "Background processor consuming jobs from a queue.",
    ["consumer", "job", "background"],
  ),
  b(
    "cron-job",
    "Cron job",
    "Compute",
    "mdi:calendar-clock",
    "Scheduled task running at fixed times or intervals.",
    ["scheduled", "batch", "timer"],
  ),
  b(
    "serverless-function",
    "Serverless function",
    "Compute",
    "logos:aws-lambda",
    "Event-driven function billed per invocation.",
    ["lambda", "faas", "cloud functions"],
  ),
  b(
    "container",
    "Container",
    "Compute",
    "logos:docker-icon",
    "Packaged process with its dependencies.",
    ["docker", "image"],
  ),
  b(
    "pod",
    "Pod",
    "Compute",
    "logos:kubernetes",
    "Smallest deployable unit in Kubernetes (one or more containers).",
    ["k8s", "kubernetes"],
  ),
  b(
    "node",
    "Node / VM",
    "Compute",
    "carbon:virtual-machine",
    "Virtual or physical machine hosting workloads.",
    ["vm", "host", "instance", "ec2"],
  ),

  b(
    "cache-redis",
    "Cache (Redis)",
    "Data",
    "logos:redis",
    "In-memory key-value cache or data structure store.",
    ["redis", "cache"],
  ),
  b(
    "cache-memcached",
    "Cache (Memcached)",
    "Data",
    "logos:memcached",
    "Simple distributed in-memory cache.",
    ["memcached", "cache"],
  ),
  b(
    "sql-db",
    "SQL database",
    "Data",
    "logos:postgresql",
    "Relational database with transactions and joins.",
    ["postgres", "mysql", "rdbms", "relational"],
  ),
  b(
    "nosql-db",
    "NoSQL database",
    "Data",
    "logos:mongodb-icon",
    "Document, key-value or wide-column store scaling horizontally.",
    ["mongodb", "dynamodb", "cassandra", "document"],
  ),
  b(
    "object-storage",
    "Object storage",
    "Data",
    "carbon:object-storage",
    "Durable blob storage for files and media.",
    ["s3", "blob", "bucket", "gcs"],
  ),
  b(
    "search-index",
    "Search index",
    "Data",
    "logos:elasticsearch",
    "Full-text and faceted search engine.",
    ["elasticsearch", "opensearch", "solr"],
  ),
  b(
    "data-warehouse",
    "Data warehouse",
    "Data",
    "logos:snowflake-icon",
    "Columnar store optimised for analytics queries.",
    ["snowflake", "bigquery", "redshift", "olap"],
  ),

  b(
    "message-queue",
    "Message queue",
    "Messaging",
    "logos:rabbitmq-icon",
    "Point-to-point buffer decoupling producers from consumers.",
    ["rabbitmq", "sqs", "queue"],
  ),
  b(
    "topic-stream",
    "Topic / stream",
    "Messaging",
    "logos:kafka-icon",
    "Partitioned, replayable log of events.",
    ["kafka", "kinesis", "stream", "log"],
  ),
  b(
    "pub-sub",
    "Pub/Sub",
    "Messaging",
    "mdi:broadcast",
    "Fan-out of messages to many subscribers.",
    ["sns", "publish", "subscribe", "topic"],
  ),
  b(
    "event-bus",
    "Event bus",
    "Messaging",
    "logos:aws-eventbridge",
    "Routes events between services by rules.",
    ["eventbridge", "events", "bus"],
  ),
  b(
    "scheduler",
    "Scheduler",
    "Messaging",
    "carbon:event-schedule",
    "Triggers work at a future time or on a schedule.",
    ["timer", "delayed", "cron"],
  ),

  b(
    "auth-provider",
    "Auth provider",
    "Security",
    "logos:auth0",
    "Identity provider handling login, SSO and tokens.",
    ["oauth", "oidc", "identity", "sso", "okta"],
  ),
  b(
    "secrets-vault",
    "Secrets vault",
    "Security",
    "logos:vault-icon",
    "Stores and rotates credentials and keys.",
    ["vault", "kms", "secrets"],
  ),

  b(
    "observability",
    "Observability stack",
    "Operations",
    "logos:grafana",
    "Metrics, logs and traces with dashboards and alerts.",
    ["grafana", "prometheus", "monitoring", "logging", "tracing"],
  ),
  b(
    "ci-cd",
    "CI/CD pipeline",
    "Operations",
    "logos:github-actions",
    "Builds, tests and deploys changes automatically.",
    ["pipeline", "deploy", "jenkins", "actions"],
  ),
  b(
    "feature-flags",
    "Feature flag service",
    "Operations",
    "mdi:toggle-switch",
    "Turns features on or off per user or environment at runtime.",
    ["flags", "toggle", "launchdarkly", "experiment"],
  ),

  b(
    "third-party-api",
    "Third-party API",
    "External",
    "mdi:api",
    "External service you integrate with but do not run.",
    ["external", "vendor", "saas", "stripe"],
  ),

  b(
    "vpc",
    "VPC / network",
    "Boundaries",
    "carbon:virtual-private-cloud",
    "Isolated virtual network boundary.",
    ["vpc", "network", "vnet"],
    "boundary",
  ),
  b(
    "subnet",
    "Subnet",
    "Boundaries",
    "carbon:subnet-acl-rules",
    "Address range inside a network, public or private.",
    ["subnet", "private", "public"],
    "boundary",
  ),
  b(
    "k8s-cluster",
    "Cluster",
    "Boundaries",
    "logos:kubernetes",
    "Group of nodes managed together (e.g. Kubernetes).",
    ["kubernetes", "k8s", "cluster"],
    "boundary",
  ),
  b(
    "region",
    "Region / zone",
    "Boundaries",
    "mdi:earth",
    "Geographic region or availability zone.",
    ["az", "region", "datacenter"],
    "boundary",
  ),
];

export interface TechDef {
  id: string;
  name: string;
  group: string;
  icon: string;
  keywords: string[];
}

const t = (group: string, name: string, icon: string, keywords: string[] = []): TechDef => ({
  id: `tech-${icon.replace(/[^a-z0-9]/gi, "-")}`,
  name,
  group,
  icon,
  keywords,
});

/** Technology / cloud-service logos (see /credits for sources and trademark notes). */
export const TECH: TechDef[] = [
  t("AWS", "AWS", "logos:aws"),
  t("AWS", "Lambda", "logos:aws-lambda"),
  t("AWS", "S3", "logos:aws-s3"),
  t("AWS", "EC2", "logos:aws-ec2"),
  t("AWS", "DynamoDB", "logos:aws-dynamodb"),
  t("AWS", "RDS", "logos:aws-rds"),
  t("AWS", "API Gateway", "logos:aws-api-gateway"),
  t("AWS", "CloudFront", "logos:aws-cloudfront"),
  t("AWS", "SQS", "logos:aws-sqs"),
  t("AWS", "SNS", "logos:aws-sns"),
  t("AWS", "EventBridge", "logos:aws-eventbridge"),
  t("AWS", "Route 53", "logos:aws-route53"),
  t("AWS", "ELB", "logos:aws-elb"),
  t("AWS", "VPC", "logos:aws-vpc"),
  t("AWS", "CloudWatch", "logos:aws-cloudwatch"),
  t("AWS", "EKS", "logos:aws-eks"),
  t("AWS", "ECS", "logos:aws-ecs"),
  t("AWS", "Kinesis", "logos:aws-kinesis"),
  t("AWS", "IAM", "logos:aws-iam"),
  t("AWS", "Secrets Manager", "logos:aws-secrets-manager"),
  t("AWS", "ElastiCache", "logos:aws-elasticache"),
  t("AWS", "Cognito", "logos:aws-cognito"),
  t("AWS", "Fargate", "logos:aws-fargate"),
  t("Google Cloud", "Google Cloud", "logos:google-cloud"),
  t("Google Cloud", "Cloud Functions", "logos:google-cloud-functions"),
  t("Google Cloud", "Cloud Run", "logos:google-cloud-run"),
  t("Azure", "Azure", "logos:microsoft-azure"),
  t("Azure", "Azure (icon)", "logos:azure-icon"),
  t("Platform", "Kubernetes", "logos:kubernetes"),
  t("Platform", "Docker", "logos:docker-icon"),
  t("Platform", "Terraform", "logos:terraform-icon"),
  t("Platform", "Helm", "logos:helm"),
  t("Platform", "Ansible", "logos:ansible"),
  t("Platform", "Envoy", "logos:envoy"),
  t("Platform", "Consul", "logos:consul"),
  t("Platform", "Vault", "logos:vault-icon"),
  t("Datastores", "Redis", "logos:redis"),
  t("Datastores", "PostgreSQL", "logos:postgresql"),
  t("Datastores", "MySQL", "logos:mysql"),
  t("Datastores", "MongoDB", "logos:mongodb-icon"),
  t("Datastores", "Cassandra", "logos:cassandra"),
  t("Datastores", "Elasticsearch", "logos:elasticsearch"),
  t("Datastores", "Memcached", "logos:memcached"),
  t("Datastores", "InfluxDB", "logos:influxdb"),
  t("Datastores", "Neo4j", "logos:neo4j"),
  t("Datastores", "SQLite", "logos:sqlite"),
  t("Datastores", "MariaDB", "logos:mariadb-icon"),
  t("Datastores", "Snowflake", "logos:snowflake-icon"),
  t("Messaging & data", "Kafka", "logos:kafka-icon"),
  t("Messaging & data", "RabbitMQ", "logos:rabbitmq-icon"),
  t("Messaging & data", "Spark", "logos:apache-spark"),
  t("Messaging & data", "Flink", "logos:apache-flink"),
  t("Messaging & data", "GraphQL", "logos:graphql"),
  t("Messaging & data", "gRPC", "logos:grpc"),
  t("Messaging & data", "Swagger / OpenAPI", "logos:swagger"),
  t("Edge & identity", "NGINX", "logos:nginx"),
  t("Edge & identity", "Kong", "logos:kong"),
  t("Edge & identity", "Cloudflare", "logos:cloudflare"),
  t("Edge & identity", "Auth0", "logos:auth0"),
  t("Edge & identity", "Okta", "logos:okta"),
  t("Observability", "Grafana", "logos:grafana"),
  t("Observability", "Prometheus", "logos:prometheus"),
  t("Observability", "Datadog", "logos:datadog"),
  t("Observability", "OpenTelemetry", "logos:opentelemetry"),
  t("Observability", "Sentry", "logos:sentry-icon"),
  t("Observability", "Kibana", "logos:kibana"),
  t("Observability", "Logstash", "logos:logstash"),
  t("CI/CD", "GitHub Actions", "logos:github-actions"),
  t("CI/CD", "GitHub", "logos:github-icon"),
  t("CI/CD", "GitLab", "logos:gitlab-icon"),
  t("CI/CD", "Jenkins", "logos:jenkins"),
  t("CI/CD", "CircleCI", "logos:circleci"),
  t("Languages", "Node.js", "logos:nodejs-icon"),
  t("Languages", "React", "logos:react"),
  t("Languages", "Go", "logos:go"),
  t("Languages", "Python", "logos:python"),
  t("Services", "Stripe", "logos:stripe"),
  t("Services", "Twilio", "logos:twilio"),
];

const NODE_W = 168;
const NODE_H = 96;

/** Node: coloured card with the icon on top and an editable bound label below. */
export async function buildBlock(
  def: Pick<BlockDef, "id" | "name" | "category" | "icon" | "kind">,
  style: StyleCtx = DEFAULT_STYLE,
  label?: string,
): Promise<BuiltItem> {
  const c = CATEGORY_COLORS[def.category];
  const b = new Builder(style);
  const text = label ?? def.name;
  if (def.kind === "boundary") {
    b.box(0, 0, 360, 240, text, {
      bg: c.bg,
      stroke: c.stroke,
      dashed: true,
      align: "left",
      valign: "top",
      font: 16,
      round: true,
    });
    await b.icon(def.icon, 360 - 44, 10, 30, c.stroke);
  } else {
    b.box(0, 0, NODE_W, NODE_H, text, { bg: c.bg, stroke: c.stroke, valign: "bottom", font: 16 });
    await b.icon(
      def.icon,
      (NODE_W - 40) / 2,
      12,
      40,
      c.stroke === "#495057" ? "#343a40" : "#1e1e1e",
    );
  }
  return b.finish({ kind: "block", id: def.id });
}

export function buildTech(def: TechDef, style: StyleCtx = DEFAULT_STYLE): Promise<BuiltItem> {
  return buildBlock(
    { id: def.id, name: def.name, category: "External", icon: def.icon, kind: "node" },
    { ...style },
  ).then((item) => ({ ...item, meta: { kind: "icon" as const, id: def.id } }));
}

export function searchBlocks(query: string): BlockDef[] {
  const q = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!q.length) return BLOCKS;
  return BLOCKS.filter((x) => {
    const hay = `${x.name} ${x.category} ${x.description} ${x.keywords.join(" ")}`.toLowerCase();
    return q.every((t) => hay.includes(t));
  });
}

export function searchTech(query: string): TechDef[] {
  const q = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!q.length) return TECH;
  return TECH.filter((x) =>
    q.every((tok) => `${x.name} ${x.group} ${x.keywords.join(" ")}`.toLowerCase().includes(tok)),
  );
}
