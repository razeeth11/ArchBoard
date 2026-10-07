import type { Template } from "../types";

export const ARCHITECTURE: Template[] = [
  {
    slug: "three-tier-web-app",
    title: "Three-Tier Web Application",
    category: "Web architecture",
    summary: "The classic presentation, application and data tiers behind a load balancer.",
    body: `The three-tier layout remains the right default for most products because each tier has one reason to change. A load balancer terminates TLS and spreads traffic across stateless application servers, which can be added or removed freely because no session lives on any one of them; sessions go to a shared Redis store instead. The application tier holds business logic and talks to a primary database for writes and a read replica for reporting queries. Static files are offloaded to a CDN so the servers only handle dynamic requests. Start from this template when someone says they need microservices and you want to show how far a well-run monolith goes. Then annotate where it would first hurt: the database connection pool, the deployment that releases everything at once, or the one team that owns the whole codebase.`,
    dsl: `title "Three-tier web app"
direction TB
user "Users" -> cdn cloudflare "CDN" -> lb nginx "Load balancer" -> service web "Web app"
[web x3]
web -> cache redis "Session store"
web -> db postgres "Primary database"
primary-database -> db postgres "Read replica"`,
    keywords: ["three tier architecture", "web application architecture", "monolith"],
  },
  {
    slug: "microservices-gateway",
    title: "Microservices with API Gateway",
    category: "Web architecture",
    summary:
      "An API gateway in front of independently deployable services that each own their data.",
    body: `Microservices trade simplicity for independence, and this template shows the minimum scaffolding that makes the trade worthwhile. Every client request enters through an API gateway that authenticates the caller, applies rate limits and routes to the right service, so individual services never implement those concerns twice. Each service owns its database, which is the rule that matters most: if two services share tables they are one service with extra latency. Services talk to each other synchronously for queries and through events for anything that can happen later. Use the diagram to discuss service boundaries drawn around business capabilities, versioned contracts, distributed tracing so a slow request can be followed across hops, and the cost of a network call that used to be a function call. Add a service only when a team can run it end to end.`,
    dsl: `title "Microservices with gateway"
direction LR
browser "Web client" -> gateway kong "API gateway" -> auth auth0 "Auth0"
gateway -> microservice users "Users service" -> db postgres "Users DB"
gateway -> microservice orders "Orders service" -> db mysql "Orders DB"
gateway -> microservice catalog "Catalog service" -> db mongodb "Catalog DB"
orders -> topic kafka "Domain events"
domain-events -> worker mail "Notifications"`,
    keywords: ["microservices", "api gateway", "service boundaries", "database per service"],
  },
  {
    slug: "serverless-api",
    title: "Serverless API",
    category: "Web architecture",
    summary:
      "An HTTP API backed by stateless functions, a managed database and an event queue for slow work.",
    body: `Serverless moves the operational burden of servers, patching and capacity onto the platform, and charges per invocation instead of per idle hour. In this template an API gateway maps routes to functions; each function does one job, reads or writes a managed key-value database, and stays stateless between calls. Slow or retryable work, such as sending email or generating a PDF, is placed on a queue and handled by a second function so the HTTP response stays fast. Authentication is delegated to a managed identity provider and verified at the gateway. It is a good fit for spiky or unpredictable traffic. Use the diagram to discuss cold starts, concurrency limits that protect a downstream database, local development without the cloud, vendor lock-in, and the point at which steady heavy traffic makes a container cheaper than a function.`,
    dsl: `title "Serverless API"
direction LR
client "App" -> gateway apigw "API gateway" -> auth cognito "Cognito"
gateway -> function lambda "Read handler" -> db dynamodb "Items table"
gateway -> function lambda "Write handler"
write-handler -> items-table
write-handler -> queue sqs "Work queue" -> function lambda "Email sender"
email-sender -> external "Email provider"`,
    keywords: ["serverless architecture", "aws lambda", "api gateway", "event driven functions"],
  },
  {
    slug: "jamstack-site",
    title: "Jamstack Site",
    category: "Web architecture",
    summary: "Pre-built static pages on a CDN with serverless functions for the dynamic parts.",
    body: `A Jamstack site does as much work as possible at build time, so a visitor receives plain files from the nearest CDN edge with no server in the request path. A build pipeline pulls content from a headless CMS, renders pages, and publishes them to object storage fronted by a CDN. Anything genuinely dynamic, such as form submissions, search or a pricing lookup, goes to small functions behind an API route. A webhook from the CMS triggers a rebuild when editors publish, so content updates reach production within a minute or two. The result is fast, cheap and hard to take down. Use it to discuss incremental rebuilds on very large sites, preview environments for editors, cache invalidation after a deploy, and when personalised or authenticated content makes a fully static approach the wrong choice.`,
    dsl: `title "Jamstack site"
direction LR
user "Visitors" -> cdn cloudfront "CDN" -> storage s3 "Static site"
external "Headless CMS" -[webhook]-> ci github "Build pipeline" -> static-site
user -> function lambda "Forms and search API" -> db dynamodb "Submissions"`,
    keywords: ["jamstack", "static site architecture", "headless cms", "cdn hosting"],
  },
  {
    slug: "backend-for-frontend",
    title: "Backend for Frontend",
    category: "Web architecture",
    summary:
      "One tailored backend per client type, each aggregating the same downstream services for its screens.",
    body: `A mobile app, a web app and a partner API rarely want the same data in the same shape, and forcing one general API to serve them all leads to over-fetching and constant compromise. The Backend for Frontend pattern gives each client its own thin backend, owned by the team that owns the client. Each BFF calls the shared domain services, trims and combines their responses into exactly what its screen needs, and handles concerns specific to that client such as token handling or payload size on a slow connection. The domain services stay clean and reusable behind it. This template makes the shape obvious. Discuss the risk of duplicated logic across BFFs, when GraphQL is a better answer, caching responses per client type, and how to keep each BFF thin enough that business rules do not creep into it.`,
    dsl: `title "Backend for frontend"
direction LR
browser "Web app" -> service webbff "Web BFF"
mobile "Mobile app" -> service mobilebff "Mobile BFF"
external "Partner" -> service partnerbff "Partner API"
webbff -> microservice catalog "Catalog service"
mobilebff -> catalog
partnerbff -> catalog
webbff -> microservice orders "Orders service"
mobilebff -> orders`,
    keywords: ["backend for frontend", "bff pattern", "api aggregation", "graphql"],
  },
  {
    slug: "strangler-fig-migration",
    title: "Strangler Fig Migration",
    category: "Web architecture",
    summary:
      "Incrementally replace a legacy monolith by routing slices of traffic to new services.",
    body: `Rewriting a large system from scratch rarely ends well; the strangler fig approach replaces it a slice at a time while production keeps running. A routing layer sits in front of the legacy application and decides, per URL or feature, whether a request goes to the old monolith or to a new service. Initially everything goes to the monolith. Each time the team extracts a capability, they build the new service, send a small share of traffic to it, compare behaviour and then move the route fully across. Data is the hard part, so the diagram shows the new service reading through an anti-corruption layer and syncing changes from the old database. Use it to plan the order of extraction, feature flags for gradual cutover, how to retire the old code safely, and how to know when the monolith is small enough to turn off.`,
    dsl: `title "Strangler fig migration"
direction LR
user "Users" -> proxy nginx "Routing proxy"
routing-proxy -> service legacy "Legacy monolith" -> db mysql "Legacy database"
routing-proxy -[new routes]-> microservice billing "Billing service" -> db postgres "Billing DB"
legacy-database -[CDC sync]-> worker sync "Sync worker" -> billing-db
flags "Feature flags" -> routing-proxy`,
    keywords: ["strangler fig", "monolith migration", "legacy modernization"],
  },
  {
    slug: "read-replicas",
    title: "Read Replicas",
    category: "Data and storage",
    summary: "Scale reads with asynchronous replicas while the primary handles all writes.",
    body: `Most applications read far more than they write, which makes replicas the cheapest first step in scaling a relational database. All writes go to a single primary; it streams its changes to several replicas that serve read-only queries, and the application, or a proxy in front of it, routes each statement accordingly. The catch is replication lag: a replica may be a few hundred milliseconds behind, so a user who just saved a profile can briefly read stale data. The template includes a connection proxy to make routing transparent and a monitor to watch lag. Use it to discuss read-your-writes consistency, sending a user's own reads to the primary for a short window, promoting a replica after a primary failure, and the point where one primary can no longer absorb the write volume and sharding becomes unavoidable.`,
    dsl: `title "Read replicas"
direction LR
service app "Application"
[app x3]
app -> proxy "DB proxy"
db-proxy -[writes]-> db postgres "Primary"
db-proxy -[reads]-> db postgres "Replica 1"
db-proxy -[reads]-> db postgres "Replica 2"
primary -[replication]-> replica-1
primary -[replication]-> replica-2
monitor prometheus "Replication lag"
replica-1 -> replication-lag`,
    keywords: ["read replicas", "database replication", "replication lag", "scaling reads"],
  },
  {
    slug: "database-sharding",
    title: "Database Sharding",
    category: "Data and storage",
    summary:
      "Partition data across several databases with a routing layer, a shard map and a rebalancing job.",
    body: `Sharding splits one logical dataset across several databases so that both storage and write throughput can scale horizontally. The central decision is the shard key: a good key spreads load evenly and keeps the data a request needs on one shard, while a poor key creates hot spots or forces expensive queries across every shard. A routing layer looks up the key in a shard map, either by hash or by range, and sends the query to the right database. The diagram includes a small directory database for that map and a rebalancing job that moves ranges when a shard grows too large. Use it to talk through cross-shard joins and transactions, which you should design away, resharding without downtime, per-tenant sharding in B2B products, and why you should exhaust replicas, caching and indexing before you accept this complexity.`,
    dsl: `title "Database sharding"
direction LR
service app "Application" -> service router "Shard router"
router -> db postgres "Shard map"
router -> db postgres "Shard 1"
router -> db postgres "Shard 2"
router -> db postgres "Shard 3"
cron "Rebalancer" -> shard-map
rebalancer -> shard-1`,
    keywords: ["database sharding", "partitioning", "shard key", "horizontal scaling"],
  },
  {
    slug: "cqrs",
    title: "CQRS",
    category: "Data and storage",
    summary: "Separate write and read models, kept in sync by events, for independent scaling.",
    body: `Command Query Responsibility Segregation separates the model you change from the model you read. Commands go to a write service that enforces business rules against a normalised database. Each accepted change publishes an event, and a projector consumes those events to maintain one or more read models shaped exactly for the screens that need them, perhaps a denormalised document store or a search index. Queries hit only the read side, so the two sides can scale, be cached and even use different technologies. The price is eventual consistency: a read may lag a write by a moment, which the interface must be designed to tolerate. Use this template to decide whether the pattern earns its complexity, and to discuss rebuilding a read model from history, handling projector failures, and reporting a command's outcome back to the user.`,
    dsl: `title "CQRS"
direction LR
client "Client" -> service cmd "Command API" -> db postgres "Write model"
cmd -> topic kafka "Domain events" -> worker proj "Projector" -> search elasticsearch "Read model"
client -[query]-> service qry "Query API" -> read-model`,
    keywords: ["cqrs", "read model", "event driven", "eventual consistency"],
  },
  {
    slug: "data-lake-etl",
    title: "Data Lake and ETL",
    category: "Data and storage",
    summary: "Land raw data in object storage, transform on a schedule and load a warehouse.",
    body: `A data lake keeps raw data in cheap object storage so that nothing is lost and questions you have not thought of yet can still be answered later. Sources such as application databases and partner files are extracted on a schedule and written, untouched, into a raw zone. Transform jobs on a distributed engine clean, join and conform that data into a curated zone, and the results are loaded into a warehouse that analysts query with SQL. A scheduler orchestrates the dependencies so that a late input delays only what depends on it. Use this template to discuss batch versus streaming, schema evolution when a source adds a column, partitioning files by date to keep scans cheap, data quality checks between zones, and who is allowed to see personal data once it has been copied three times.`,
    dsl: `title "Data lake and ETL"
direction LR
db mysql "Orders DB" -> storage s3 "Raw zone"
external "Partner files" -> raw-zone
raw-zone -> worker spark "Transform jobs" -> storage s3 "Curated zone" -> warehouse snowflake "Warehouse"
scheduler "Orchestrator" -> spark
warehouse -> monitor grafana "BI dashboards"`,
    keywords: ["data lake", "etl pipeline", "data warehouse", "batch processing"],
  },
  {
    slug: "cache-aside",
    title: "Cache-Aside Pattern",
    category: "Data and storage",
    summary: "The application checks the cache first and loads from the database on a miss.",
    body: `Cache-aside, sometimes called lazy loading, puts the application in charge of the cache. On a read it asks the cache first; a hit returns immediately, and a miss loads the row from the database, stores it in the cache with a time to live and then returns it. On a write the application updates the database and either deletes or refreshes the cached entry, so the next read repopulates it. The pattern is simple and resilient because the cache can disappear and the system still works, only slower. It is a good fit for read-heavy data that tolerates brief staleness. Use the template to discuss choosing time to live values, race conditions when a stale value is written back after an update, stampedes on a popular key, and why deleting on write is usually safer than updating in place.`,
    dsl: `title "Cache-aside"
direction LR
service app "Application"
app -[1. get]-> cache redis "Redis"
app -[2. on miss]-> db postgres "Database"
app -[3. set with TTL]-> redis`,
    keywords: ["cache aside", "lazy loading", "redis caching", "ttl"],
  },
  {
    slug: "write-through-cache",
    title: "Write-Through Cache",
    category: "Data and storage",
    summary:
      "Writes go through the cache, either synchronously to the database or batched behind it.",
    body: `Where cache-aside leaves the application to coordinate, write-through and write-behind make the cache the front door for writes. With write-through, every write updates the cache and the database before it is acknowledged, so reads are always fresh and the database is authoritative, at the cost of write latency. With write-behind, the cache acknowledges immediately and a background worker flushes batches to the database later, which absorbs bursts and reduces database load but risks losing the buffered writes if the cache node dies before they are flushed. This template shows both paths so a team can choose deliberately. Discuss durability guarantees, ordering of coalesced updates, replaying a queue after a crash, and which data, such as view counters or likes, is genuinely safe to lose a few seconds of.`,
    dsl: `title "Write-through and write-behind"
direction LR
service app "Application"
app -[write-through]-> cache redis "Cache" -[sync write]-> db postgres "Database"
app -[write-behind]-> cache
cache -> queue sqs "Flush queue" -> worker flush "Batch writer" -> database`,
    keywords: ["write through cache", "write behind", "caching strategies"],
  },
  {
    slug: "change-data-capture",
    title: "Change Data Capture",
    category: "Data and storage",
    summary: "Stream database changes from the transaction log to search, cache and analytics.",
    body: `Change data capture turns a database's own commit log into a stream of events, which is more reliable than asking applications to also write to a queue. A connector reads inserts, updates and deletes from the log in order and publishes them to a Kafka topic, without adding load to the tables or touching application code. Downstream consumers subscribe independently: one keeps a search index current, another invalidates cache entries, a third lands the changes in a warehouse for analytics. Because the source of truth stays the database, there is no dual-write inconsistency. The template is a good basis for discussing initial snapshots, schema changes that break consumers, exactly-once expectations versus at-least-once reality, deleting personal data downstream, and the lag a consumer can tolerate before users notice stale results.`,
    dsl: `title "Change data capture"
direction LR
service app "Application" -> db postgres "Source database"
source-database -[WAL]-> worker cdc "CDC connector" -> topic kafka "Change stream"
change-stream -> worker idx "Index updater" -> search elasticsearch "Search index"
change-stream -> worker inv "Cache invalidator" -> cache redis "Cache"
change-stream -> warehouse snowflake "Warehouse"`,
    keywords: ["change data capture", "debezium", "event streaming", "database log"],
  },
  {
    slug: "pubsub-fanout",
    title: "Pub/Sub Fan-Out",
    category: "Messaging and events",
    summary:
      "One publisher, one topic and many independent subscribers, each consuming at its own pace.",
    body: `Publish and subscribe decouples the service that knows something happened from every service that cares. The publisher writes an event such as an order was created to a topic and moves on; it neither knows nor waits for the consumers. Each subscriber, billing, shipping and notifications in this template, gets its own copy of every message and processes it at its own pace, so a slow consumer never delays the others. Adding a new subscriber needs no change to the publisher at all, which is the real benefit. The costs are indirect control flow that is harder to trace, and the need for consumers to cope with duplicates and ordering gaps. Use the diagram to talk about delivery guarantees, schema versioning of event payloads, dead letter handling, and how a team finds out who consumes its events.`,
    dsl: `title "Pub/sub fan-out"
direction LR
service pub "Order service" -> topic sns "orders.created"
orders-created -> worker billing "Billing"
orders-created -> worker shipping "Shipping"
orders-created -> worker notify "Notifications"
orders-created -> worker analytics "Analytics"`,
    keywords: ["pub sub", "fan out", "event driven architecture", "sns sqs"],
  },
  {
    slug: "event-sourcing",
    title: "Event Sourcing",
    category: "Messaging and events",
    summary: "Store every change as an immutable event and derive current state by replay.",
    body: `Event sourcing stores what happened instead of what is. Rather than overwriting a row with the latest balance, the system appends events such as deposited or withdrawn to an immutable log, and current state is whatever you get by replaying them. This gives a perfect audit trail, makes it possible to answer questions about the past and allows new read models to be built from history. An aggregate loads its events, applies a command, and appends new events; snapshots speed up aggregates with long histories. Projections consume the log to build query tables. This template shows the write path, the event store and two projections. Discuss versioning events that live forever, the difficulty of correcting mistakes, privacy deletion in an append-only log, and whether the benefits outweigh the extra thinking your team will need.`,
    dsl: `title "Event sourcing"
direction LR
client "Client" -> service cmd "Command handler" -> db postgres "Event store"
event-store -> topic kafka "Event stream"
event-stream -> worker p1 "Balance projection" -> db postgres "Balances view"
event-stream -> worker p2 "Audit projection" -> search elasticsearch "Audit index"
cmd -> storage s3 "Snapshots"`,
    keywords: ["event sourcing", "event store", "projections", "audit log"],
  },
  {
    slug: "saga-orchestration",
    title: "Saga Orchestration",
    category: "Messaging and events",
    summary: "A coordinator drives a multi-service workflow with compensating actions on failure.",
    body: `A saga replaces a distributed transaction with a sequence of local ones, each followed by a compensating action if a later step fails. In the orchestrated style shown here, a central coordinator holds the workflow's state and tells each participant what to do next: reserve stock, charge the card, create the shipment. If charging fails, the coordinator instructs inventory to release the reservation rather than rolling anything back magically. The workflow state is persisted so the saga can resume after a crash. Compared with choreography, where services react to each other's events, orchestration makes the flow easy to read and monitor, at the cost of a coordinator that must be built and kept reliable. Use the template to discuss idempotent steps, timeouts, human intervention for stuck sagas, and visualising in-flight workflows for support teams.`,
    dsl: `title "Saga orchestration"
direction LR
client "Client" -> service orch "Saga orchestrator" -> db postgres "Saga state"
orch -> microservice inv "Inventory"
orch -> microservice pay "Payments"
orch -> microservice ship "Shipping"
inv -[compensate]-> orch
pay -[compensate]-> orch`,
    keywords: ["saga pattern", "orchestration", "distributed transactions", "compensation"],
  },
  {
    slug: "outbox-pattern",
    title: "Transactional Outbox",
    category: "Messaging and events",
    summary: "Write business data and an event in one transaction, then relay the event reliably.",
    body: `The dual write problem is simple to state and surprisingly easy to ship: a service updates its database and then publishes an event, and a crash between the two leaves them disagreeing. The transactional outbox removes the gap. In one local transaction the service writes its business change and also inserts a row describing the event into an outbox table. A separate relay process reads unpublished outbox rows and sends them to the message broker, marking each as sent afterwards. If the relay crashes it simply resumes, so every event is published at least once, and consumers deduplicate using the event id. Use this template to discuss polling versus log tailing for the relay, ordering per aggregate, cleaning up old outbox rows, and why this pattern is almost always preferable to distributed transactions across a database and a broker.`,
    dsl: `title "Transactional outbox"
direction LR
service app "Order service" -> db postgres "Orders and outbox"
orders-and-outbox -> worker relay "Outbox relay" -> topic kafka "Order events"
order-events -> worker c1 "Billing consumer"
order-events -> worker c2 "Shipping consumer"
c1 -> cache redis "Processed ids"`,
    keywords: ["outbox pattern", "dual write", "reliable messaging", "at least once"],
  },
  {
    slug: "dead-letter-queue",
    title: "Dead Letter Queue",
    category: "Messaging and events",
    summary:
      "Isolate poison messages with retries, a dead letter queue and an operator replay path.",
    body: `A message that can never be processed, a malformed payload or a record that violates a rule, will block a queue forever if the consumer retries it blindly. This template adds the standard safeguards. The consumer processes each message and, on failure, returns it for a limited number of retries with growing delays. After the final attempt the broker moves it to a dead letter queue, where it waits without holding up healthy traffic. An alert tells the owning team that the dead letter queue is not empty, and an operator tool lets them inspect a message, fix the bug or the data, and replay it into the main queue. Use the diagram to discuss retry budgets, distinguishing transient from permanent errors, preserving the failure reason and original headers, and treating a growing dead letter queue as an incident.`,
    dsl: `title "Dead letter queue"
direction LR
service prod "Producer" -> queue sqs "Main queue" -> worker cons "Consumer"
cons -[retry with backoff]-> main-queue
main-queue -[after 5 attempts]-> queue sqs "Dead letter queue"
dead-letter-queue -> monitor datadog "Alert"
service tool "Replay tool" -> dead-letter-queue
tool -> main-queue`,
    keywords: ["dead letter queue", "retry", "poison message", "message broker"],
  },
];
