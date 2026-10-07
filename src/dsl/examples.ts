export interface DslExample {
  id: string;
  title: string;
  description: string;
  source: string;
}

/** Ready-to-use snippets (also the seed for the templates gallery). Every one is parsed in tests. */
export const DSL_EXAMPLES: DslExample[] = [
  {
    id: "hello",
    title: "Service and database",
    description: "The smallest useful diagram: a service reading from a PostgreSQL database.",
    source: `service api "Orders API" -> db postgres "Orders DB"\n`,
  },
  {
    id: "replicas",
    title: "Load-balanced replicas",
    description: "A load balancer fanning out to three replicas, with an event queue behind them.",
    source: `service api "Orders API" -> db postgres "Orders DB"\nlb "Edge LB" -> [api x3]\napi -> queue kafka "order-events" -> worker "Fulfilment"\n`,
  },
  {
    id: "url-shortener",
    title: "URL shortener",
    description:
      "Read-heavy write path with a cache in front of the database and a CDN for redirects.",
    source: `title "URL shortener"\nclient "Browser" -> cdn "CDN" -> lb "LB" -> service app "Shortener"\n[app x3]\napp -> cache redis "Hot links"\napp -> db postgres "Links DB"\napp -[async]-> queue kafka "click-events" -> worker "Analytics" -> warehouse snowflake "Clicks"\n`,
  },
  {
    id: "event-driven",
    title: "Event-driven checkout",
    description:
      "Checkout publishes an order event; payments, inventory and email react independently.",
    source: `direction LR\nclient "Web app" -> gateway "API gateway" -> service checkout "Checkout"\ncheckout -> topic kafka "orders"\norders -> service payments "Payments"\norders -> service inventory "Inventory"\norders -> function lambda "Send email"\npayments -> external stripe "Stripe"\n`,
  },
  {
    id: "cache-aside",
    title: "Cache-aside",
    description: "The application checks Redis first and falls back to PostgreSQL on a miss.",
    source: `service app "Application"\napp -[1. get]-> cache redis "Redis"\napp --[2. on miss]--> db postgres "Postgres"\n`,
  },
  {
    id: "microservices",
    title: "API gateway and microservices",
    description:
      "A gateway with authentication routing to independent services that own their data.",
    source: `browser "Web" -> gateway "API gateway" -> auth auth0 "Auth0"\ngateway -> microservice users "Users"\ngateway -> microservice orders "Orders"\ngateway -> microservice catalog "Catalog"\nusers -> db postgres "Users DB"\norders -> db mysql "Orders DB"\ncatalog -> search elasticsearch "Catalog index"\n`,
  },
  {
    id: "cqrs",
    title: "CQRS",
    description:
      "Commands go through a write model; events keep a read model up to date for queries.",
    source: `layout right\nclient "Client" -> service cmd "Command API" -> db postgres "Write model"\ncmd -> topic kafka "events"\nevents -> worker proj "Projector" -> search elasticsearch "Read model"\nclient --[query]--> service qry "Query API" -> search elasticsearch "Read model"\n`,
  },
  {
    id: "pubsub",
    title: "Pub/sub fan-out",
    description: "One publisher, one topic, many subscribers.",
    source: `service pub "Publisher" -> topic sns "orders.created"\norders-created -> worker billing "Billing"\norders-created -> worker shipping "Shipping"\norders-created -> worker notify "Notifications"\n`,
  },
  {
    id: "etl",
    title: "Batch ETL",
    description:
      "Sources land in object storage, a scheduled job transforms them and loads the warehouse.",
    source: `direction LR\ndb mysql "Orders DB" -> storage s3 "Raw zone" -> worker spark "Transform" -> warehouse snowflake "Warehouse"\nexternal "Partner API" -> raw-zone\ncron "Nightly job" -> spark\n`,
  },
  {
    id: "cdn-origin",
    title: "CDN with origin",
    description: "Users hit the CDN, which only reaches the origin on a cache miss.",
    source: `user "Visitors" -> cdn cloudfront "CDN"\ncdn --[miss]--> lb "Origin LB" -> service origin "Origin"\n[origin x2]\norigin -> storage s3 "Assets"\n`,
  },
  {
    id: "observability",
    title: "Observability",
    description: "Services emit metrics and logs to a collector feeding Prometheus and Grafana.",
    source: `service a "Service A" -> monitor prometheus "Prometheus" -> monitor grafana "Grafana"\nservice b "Service B" -> prometheus\nservice c "Service C" -> prometheus\n`,
  },
  {
    id: "cicd",
    title: "CI/CD pipeline",
    description:
      "A push triggers CI, which builds a container, stores it in a registry and deploys to Kubernetes.",
    source: `direction LR\nclient "Developer" -> ci github "GitHub Actions" -> container docker "Image build" -> storage s3 "Registry" -> pod k8s "Kubernetes"\nvault "Secrets" -> github-actions\n`,
  },
];
