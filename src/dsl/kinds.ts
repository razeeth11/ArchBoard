import type { BlockCategory } from "@/library/blocks";

export interface KindDef {
  /** Display name when no label is given. */
  name: string;
  category: BlockCategory;
  icon: string;
  /** Technology words that refine the kind (e.g. `db postgres`). */
  techs?: Record<string, { icon: string; name: string }>;
}

const t = (icon: string, name: string) => ({ icon, name });

const DB = {
  postgres: t("logos:postgresql", "PostgreSQL"),
  postgresql: t("logos:postgresql", "PostgreSQL"),
  mysql: t("logos:mysql", "MySQL"),
  mariadb: t("logos:mariadb-icon", "MariaDB"),
  sqlite: t("logos:sqlite", "SQLite"),
  mongodb: t("logos:mongodb-icon", "MongoDB"),
  mongo: t("logos:mongodb-icon", "MongoDB"),
  cassandra: t("logos:cassandra", "Cassandra"),
  dynamodb: t("logos:aws-dynamodb", "DynamoDB"),
  neo4j: t("logos:neo4j", "Neo4j"),
  influxdb: t("logos:influxdb", "InfluxDB"),
  rds: t("logos:aws-rds", "RDS"),
};

/** The vocabulary of the diagram DSL. Aliases share a definition. */
const BASE: Record<string, KindDef> = {
  client: { name: "Client", category: "Clients", icon: "lucide:monitor" },
  browser: { name: "Browser", category: "Clients", icon: "mdi:web" },
  mobile: { name: "Mobile app", category: "Clients", icon: "mdi:cellphone" },
  user: { name: "User", category: "Clients", icon: "mdi:account-group" },
  gateway: {
    name: "API gateway",
    category: "Edge & network",
    icon: "carbon:gateway",
    techs: { kong: t("logos:kong", "Kong"), apigw: t("logos:aws-api-gateway", "API Gateway") },
  },
  lb: {
    name: "Load balancer",
    category: "Edge & network",
    icon: "carbon:load-balancer-application",
    techs: {
      nginx: t("logos:nginx", "NGINX"),
      elb: t("logos:aws-elb", "ELB"),
      envoy: t("logos:envoy", "Envoy"),
    },
  },
  cdn: {
    name: "CDN",
    category: "Edge & network",
    icon: "lucide:globe",
    techs: {
      cloudfront: t("logos:aws-cloudfront", "CloudFront"),
      cloudflare: t("logos:cloudflare", "Cloudflare"),
    },
  },
  proxy: {
    name: "Reverse proxy",
    category: "Edge & network",
    icon: "logos:nginx",
    techs: { nginx: t("logos:nginx", "NGINX"), envoy: t("logos:envoy", "Envoy") },
  },
  dns: {
    name: "DNS",
    category: "Edge & network",
    icon: "carbon:dns-services",
    techs: { route53: t("logos:aws-route53", "Route 53") },
  },
  firewall: { name: "Firewall", category: "Edge & network", icon: "carbon:firewall" },
  waf: { name: "WAF", category: "Edge & network", icon: "mdi:shield-lock" },
  ratelimiter: { name: "Rate limiter", category: "Edge & network", icon: "mdi:speedometer" },
  service: { name: "Service", category: "Compute", icon: "carbon:application" },
  microservice: { name: "Microservice", category: "Compute", icon: "carbon:microservices-1" },
  worker: { name: "Worker", category: "Compute", icon: "mdi:cogs" },
  cron: { name: "Cron job", category: "Compute", icon: "mdi:calendar-clock" },
  function: {
    name: "Function",
    category: "Compute",
    icon: "logos:aws-lambda",
    techs: {
      lambda: t("logos:aws-lambda", "Lambda"),
      cloudfunctions: t("logos:google-cloud-functions", "Cloud Functions"),
    },
  },
  container: {
    name: "Container",
    category: "Compute",
    icon: "logos:docker-icon",
    techs: { docker: t("logos:docker-icon", "Docker") },
  },
  pod: {
    name: "Pod",
    category: "Compute",
    icon: "logos:kubernetes",
    techs: { k8s: t("logos:kubernetes", "Kubernetes") },
  },
  node: {
    name: "Node",
    category: "Compute",
    icon: "carbon:virtual-machine",
    techs: { ec2: t("logos:aws-ec2", "EC2") },
  },
  db: { name: "Database", category: "Data", icon: "logos:postgresql", techs: DB },
  cache: {
    name: "Cache",
    category: "Data",
    icon: "logos:redis",
    techs: {
      redis: t("logos:redis", "Redis"),
      memcached: t("logos:memcached", "Memcached"),
      elasticache: t("logos:aws-elasticache", "ElastiCache"),
    },
  },
  storage: {
    name: "Object storage",
    category: "Data",
    icon: "carbon:object-storage",
    techs: { s3: t("logos:aws-s3", "S3") },
  },
  search: {
    name: "Search index",
    category: "Data",
    icon: "logos:elasticsearch",
    techs: {
      elasticsearch: t("logos:elasticsearch", "Elasticsearch"),
      opensearch: t("logos:elasticsearch", "OpenSearch"),
    },
  },
  warehouse: {
    name: "Data warehouse",
    category: "Data",
    icon: "logos:snowflake-icon",
    techs: { snowflake: t("logos:snowflake-icon", "Snowflake") },
  },
  queue: {
    name: "Queue",
    category: "Messaging",
    icon: "logos:rabbitmq-icon",
    techs: {
      kafka: t("logos:kafka-icon", "Kafka"),
      rabbitmq: t("logos:rabbitmq-icon", "RabbitMQ"),
      sqs: t("logos:aws-sqs", "SQS"),
    },
  },
  topic: {
    name: "Topic",
    category: "Messaging",
    icon: "logos:kafka-icon",
    techs: {
      kafka: t("logos:kafka-icon", "Kafka"),
      sns: t("logos:aws-sns", "SNS"),
      kinesis: t("logos:aws-kinesis", "Kinesis"),
    },
  },
  pubsub: { name: "Pub/Sub", category: "Messaging", icon: "mdi:broadcast" },
  bus: { name: "Event bus", category: "Messaging", icon: "logos:aws-eventbridge" },
  scheduler: { name: "Scheduler", category: "Messaging", icon: "carbon:event-schedule" },
  auth: {
    name: "Auth provider",
    category: "Security",
    icon: "logos:auth0",
    techs: {
      auth0: t("logos:auth0", "Auth0"),
      okta: t("logos:okta", "Okta"),
      cognito: t("logos:aws-cognito", "Cognito"),
    },
  },
  vault: { name: "Secrets vault", category: "Security", icon: "logos:vault-icon" },
  monitor: {
    name: "Observability",
    category: "Operations",
    icon: "logos:grafana",
    techs: {
      grafana: t("logos:grafana", "Grafana"),
      prometheus: t("logos:prometheus", "Prometheus"),
      datadog: t("logos:datadog", "Datadog"),
    },
  },
  ci: {
    name: "CI/CD",
    category: "Operations",
    icon: "logos:github-actions",
    techs: {
      github: t("logos:github-actions", "GitHub Actions"),
      jenkins: t("logos:jenkins", "Jenkins"),
    },
  },
  flags: { name: "Feature flags", category: "Operations", icon: "mdi:toggle-switch" },
  external: {
    name: "External API",
    category: "External",
    icon: "mdi:api",
    techs: { stripe: t("logos:stripe", "Stripe"), twilio: t("logos:twilio", "Twilio") },
  },
};

const ALIASES: Record<string, string> = {
  api: "gateway",
  apigateway: "gateway",
  loadbalancer: "lb",
  reverseproxy: "proxy",
  microsvc: "microservice",
  svc: "service",
  fn: "function",
  lambda: "function",
  database: "db",
  sql: "db",
  nosql: "db",
  redis: "cache",
  bucket: "storage",
  s3: "storage",
  kafka: "topic",
  stream: "topic",
  mq: "queue",
  eventbus: "bus",
  idp: "auth",
  observability: "monitor",
  cicd: "ci",
  pipeline: "ci",
  thirdparty: "external",
  ext: "external",
  web: "browser",
  app: "mobile",
  people: "user",
  actor: "user",
  job: "cron",
  timer: "scheduler",
  container_: "container",
};

export const KINDS: Record<string, KindDef> = (() => {
  const out: Record<string, KindDef> = { ...BASE };
  for (const [alias, target] of Object.entries(ALIASES))
    if (BASE[target]) out[alias] = BASE[target]!;
  return out;
})();

export const KIND_NAMES = Object.keys(KINDS);

export function suggest(word: string, pool: readonly string[]): string | null {
  const w = word.toLowerCase();
  let best: string | null = null;
  let bestScore = Infinity;
  for (const cand of pool) {
    const d = distance(w, cand);
    if (d < bestScore) {
      bestScore = d;
      best = cand;
    }
  }
  return best && bestScore <= Math.max(1, Math.floor(w.length / 3)) ? best : null;
}

function distance(a: string, b: string): number {
  const dp = Array.from(
    { length: a.length + 1 },
    (_, i) => [i, ...Array(b.length).fill(0)] as number[],
  );
  for (let j = 0; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length]![b.length]!;
}
