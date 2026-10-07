import type { Template } from "../types";

export const OPS: Template[] = [
  {
    slug: "multi-region-active-passive",
    title: "Multi-Region Active-Passive",
    category: "Reliability",
    summary: "A warm standby region with replicated data and DNS failover for disaster recovery.",
    body: `Active-passive keeps a second region ready to take over without paying for two fully live stacks. The primary region serves all traffic; its database replicates continuously, and object storage is copied across regions, so the standby always holds recent data. The standby region runs a scaled-down copy of the application, enough to start quickly but small enough to be affordable. DNS with health checks watches the primary and, when it fails, shifts traffic to the secondary, which is first promoted and scaled up. Two numbers define the design: recovery point objective, how much data you can afford to lose, set by replication lag, and recovery time objective, how long failover takes. Use the template to discuss drills, because an untested failover is a hope, and the human decision about when to fail back.`,
    dsl: `title "Active-passive multi-region"
direction LR
user "Users" -> dns route53 "DNS with health checks"
dns-with-health-checks -[active]-> lb elb "Primary LB" -> service primary "App (region A)" -> db rds "Primary DB"
dns-with-health-checks -[standby]-> lb elb "Standby LB" -> service standby "App (region B)" -> db rds "Replica DB"
primary-db -[async replication]-> replica-db`,
    keywords: ["disaster recovery", "multi-region", "failover", "rpo rto"],
  },
  {
    slug: "blue-green-deployment",
    title: "Blue-Green Deployment",
    category: "Reliability",
    summary: "Two identical environments with an instant traffic switch and a quick rollback.",
    body: `Blue-green deployment removes the nervous moment of a release. Two production-sized environments exist side by side: blue serves live traffic while green receives the new version. Once green is deployed and verified with smoke tests against the real dependencies, the load balancer flips all traffic from blue to green in one step. If something is wrong, flipping back takes seconds, because blue is still running the previous version. The difficulty is the database, which both environments share, so every schema change must be backward compatible across two versions, applied in an expand then contract sequence. The template shows the routing layer and the shared data tier. Use it to discuss cost of the idle environment, draining existing connections, warming caches before the switch, and how this differs from canary releases that move traffic gradually.`,
    dsl: `title "Blue-green deployment"
direction LR
user "Users" -> lb nginx "Router"
router -[100% live]-> service blue "Blue (v1)"
router -[0% idle]-> service green "Green (v2)"
blue -> db postgres "Shared database"
green -> shared-database
ci github "CI pipeline" -> green`,
    keywords: ["blue green deployment", "zero downtime", "rollback", "release strategy"],
  },
  {
    slug: "circuit-breaker",
    title: "Circuit Breaker",
    category: "Reliability",
    summary:
      "Stop calling a failing dependency, serve a fallback response and probe carefully for recovery.",
    body: `A failing dependency is dangerous mostly because callers keep waiting on it. Threads pile up behind slow requests, the caller exhausts its own capacity, and a small outage cascades upward. A circuit breaker wraps the call and counts failures. While the circuit is closed, requests flow normally. When failures cross a threshold the circuit opens and calls fail immediately, with no waiting, returning a cached value or a degraded response instead. After a cool-down the breaker moves to half open and lets a few trial requests through; success closes it again, failure reopens it. This template shows the caller, the breaker, the protected service and a fallback. Discuss thresholds based on error rate rather than count, bulkheads that cap concurrency per dependency, timeouts that are shorter than the user's patience, and alerting when a breaker opens.`,
    dsl: `title "Circuit breaker"
direction LR
service caller "Caller" -> service cb "Circuit breaker"
cb -[closed]-> microservice dep "Payments service"
cb -[open: fail fast]-> cache redis "Fallback response"
cb -> monitor prometheus "State metrics"
cb -[half-open probes]-> dep`,
    keywords: ["circuit breaker", "resilience", "fallback", "bulkhead"],
  },
  {
    slug: "cdn-origin-shield",
    title: "CDN with Origin Shield",
    category: "Reliability",
    summary:
      "Edge caches, a shield layer and an origin protected from simultaneous cache-miss storms.",
    body: `A CDN reduces latency by serving content from a location near the user, but a cold or purged cache can send a flood of simultaneous misses to the origin. An origin shield adds a single intermediate cache layer: edge locations that miss ask the shield rather than the origin, and the shield collapses many identical requests into one. The origin therefore sees a small, predictable load even when thousands of edges are refreshing the same object. The template places users, edge locations, the shield, a load-balanced origin and its storage in a line so the layers are clear. Use it to discuss cache keys and which headers or cookies must vary them, stale-while-revalidate to hide origin slowness, purging by tag, signed URLs for private content, and the cost trade-off of the extra hop.`,
    dsl: `title "CDN with origin shield"
direction LR
user "Visitors" -> cdn cloudfront "Edge locations" -[miss]-> cdn cloudfront "Origin shield" -[miss]-> lb "Origin LB" -> service origin "Origin"
[origin x2]
origin -> storage s3 "Assets"`,
    keywords: ["cdn", "origin shield", "cache hit ratio", "edge caching"],
  },
  {
    slug: "oauth-login",
    title: "OAuth 2.0 Login Flow",
    category: "Security",
    summary: "Authorization code flow with PKCE between a client, an identity provider and an API.",
    body: `Most modern sign-in buttons are the OAuth 2.0 authorization code flow with PKCE, and the diagram makes its three parties explicit. The client app sends the user to the identity provider with a code challenge; the user authenticates there, never on the client, and the provider redirects back with a short-lived authorization code. The client exchanges that code, along with the original verifier, for an access token and a refresh token, so an intercepted code is useless on its own. The client then calls the API with the access token, and the API validates its signature and scopes before answering. Use this template to discuss why the implicit flow is deprecated, where tokens should be stored in a browser, rotating refresh tokens, short access token lifetimes, scope design, and the difference between authentication and authorisation.`,
    dsl: `title "OAuth 2.0 with PKCE"
direction LR
browser "Client app" -[1. authorize + challenge]-> auth auth0 "Identity provider"
identity-provider -[2. code]-> client-app
client-app -[3. code + verifier]-> identity-provider
identity-provider -[4. tokens]-> client-app
client-app -[5. bearer token]-> service api "Resource API" -> db postgres "Data"
api -[6. validate]-> identity-provider`,
    keywords: ["oauth 2.0", "pkce", "authentication flow", "access token"],
  },
  {
    slug: "zero-trust-access",
    title: "Zero Trust Access",
    category: "Security",
    summary: "Every request is authenticated, authorised and inspected, with no trusted network.",
    body: `Zero trust drops the idea that anything inside the office network or VPC is safe. Every request, from a person or a service, must prove who it is and be authorised for exactly what it is asking. In this template users reach internal applications only through an identity-aware proxy, which checks the identity provider, enforces multi-factor authentication and evaluates device posture before forwarding. Service to service calls use mutual TLS with short-lived certificates issued by an internal authority, and a policy engine decides which service may call which. Secrets live in a vault rather than in configuration, and every decision is logged for audit. Use the diagram to discuss migrating from a flat network step by step, the operational cost of certificate rotation, least-privilege policies, and how to keep developers productive under tighter rules.`,
    dsl: `title "Zero trust access"
direction LR
user "Employee" -> proxy envoy "Identity-aware proxy" -> auth okta "Identity provider"
identity-aware-proxy -> service app "Internal app"
app -[mTLS]-> microservice api "Internal API"
app -> vault "Secrets vault"
identity-aware-proxy -> monitor datadog "Audit logs"`,
    keywords: ["zero trust", "mtls", "identity aware proxy", "least privilege"],
  },
  {
    slug: "cicd-pipeline",
    title: "CI/CD Pipeline",
    category: "DevOps",
    summary:
      "Build, test, scan and deploy containers from a pull request all the way to Kubernetes.",
    body: `A good pipeline makes the safe path the easy one. A push or pull request triggers continuous integration: the runner installs dependencies, runs unit tests, lints, and scans for vulnerable packages and leaked secrets. On the main branch it builds a container image, tags it with the commit hash and pushes it to a registry. Continuous delivery then updates a Kubernetes deployment, either by applying manifests or by committing the new image tag to a repository that a GitOps controller reconciles, and runs smoke tests before declaring success. Secrets come from a vault, not from the pipeline's variables. This template is useful for discussing how long a pipeline is allowed to take, caching to keep it fast, promotion between staging and production, protected branches, and how a rollback is performed when a bad build reaches users.`,
    dsl: `title "CI/CD pipeline"
direction LR
client "Developer" -> ci github "GitHub Actions" -> container docker "Image build"
image-build -> storage s3 "Container registry"
github-actions -> vault "Secrets"
container-registry -> pod k8s "Kubernetes"
github-actions -[smoke tests]-> kubernetes`,
    keywords: ["ci cd pipeline", "github actions", "kubernetes deployment", "devops"],
  },
  {
    slug: "observability-stack",
    title: "Observability Stack",
    category: "DevOps",
    summary: "Metrics, logs and traces collected from services into dashboards and alerts.",
    body: `Observability asks whether you can understand what a system is doing from the outside, and it rests on three signals. Metrics are cheap numbers over time, good for dashboards and alerts. Logs are detailed records of events, good for the why. Traces follow one request across service boundaries, good for finding where the time went. In this template each service emits all three through a collector, which batches, samples and routes them to the right store: Prometheus for metrics, a log search index for logs and a trace backend for spans. Grafana joins them in dashboards, and alert rules page the on-call engineer. Use the diagram to discuss correlation ids, sampling to control cost, service level objectives that make alerts meaningful, and avoiding dashboards nobody reads.`,
    dsl: `title "Observability stack"
direction LR
service a "Service A" -> worker otel "Telemetry collector"
service b "Service B" -> otel
service c "Service C" -> otel
otel -> monitor prometheus "Metrics"
otel -> search opensearch "Logs"
otel -> db influxdb "Traces"
metrics -> monitor grafana "Dashboards"
logs -> dashboards
traces -> dashboards`,
    keywords: ["observability", "tracing", "prometheus grafana", "slo"],
  },
  {
    slug: "kubernetes-ingress",
    title: "Kubernetes Cluster with Ingress",
    category: "DevOps",
    summary: "Ingress, services, pods, config and persistent storage inside a Kubernetes cluster.",
    body: `A Kubernetes cluster can look overwhelming until you follow one request through it. Traffic enters through a cloud load balancer to an ingress controller, which routes by host and path to a Service, a stable virtual address. The Service spreads requests across the pods that match its selector, and each pod runs a container built from an image in the registry. Configuration comes from ConfigMaps and Secrets mounted into pods, and anything that must survive a restart, such as a database, uses a persistent volume. A horizontal autoscaler adds pods when CPU or request rate climbs, and a monitor scrapes metrics from the whole cluster. Use this template for onboarding conversations about readiness and liveness probes, resource requests and limits, rolling updates, and which workloads genuinely benefit from running on Kubernetes at all.`,
    dsl: `title "Kubernetes with ingress"
direction LR
user "Users" -> lb elb "Cloud load balancer" -> proxy nginx "Ingress controller"
ingress-controller -> service svc "Service"
svc -> pod k8s "Web pods"
[web-pods x3]
web-pods -> storage s3 "Persistent volume"
web-pods -> vault "Secrets and config"
scheduler "Autoscaler" -> web-pods
monitor prometheus "Cluster metrics"
web-pods -> cluster-metrics`,
    keywords: ["kubernetes", "ingress controller", "pods and services", "autoscaling"],
  },
  {
    slug: "feature-flag-rollout",
    title: "Feature Flag Rollout",
    category: "DevOps",
    summary: "Decouple deploy from release with flags, percentage rollouts and a kill switch.",
    body: `Feature flags separate shipping code from turning it on. Code for a new feature is merged and deployed behind a flag that is off, so deployment becomes a routine, low-risk event. A flag service holds the rules, and each application caches them locally and evaluates them per request using the user's attributes, which allows internal staff first, then one percent of users, then everyone. Evaluations and the metrics that matter, errors and conversion, are sent to a monitoring tool so a bad rollout is visible within minutes, and a kill switch turns the feature off instantly without a deploy. Use the template to discuss flag hygiene, because stale flags are technical debt, consistent bucketing so a user does not flip between variants, testing both code paths, and what happens when the flag service itself is unreachable.`,
    dsl: `title "Feature flag rollout"
direction LR
service app "Application" -> flags "Flag service"
app -[evaluate locally]-> cache redis "Flag cache"
flag-service -> db postgres "Flag rules"
app -[exposure + errors]-> monitor datadog "Monitoring"
client "Product team" -> flag-service`,
    keywords: ["feature flags", "progressive rollout", "kill switch", "canary release"],
  },
  {
    slug: "multi-tenant-saas",
    title: "Multi-Tenant SaaS",
    category: "Web architecture",
    summary: "Shared application tier with tenant routing, isolation and per-tenant limits.",
    body: `A SaaS product serves many customers from one codebase, and the central decision is how strictly their data is separated. This template uses a shared application tier that resolves the tenant from the hostname or token on every request and carries it through the whole call. A tenant router sends small customers to a pooled database where each row carries a tenant id enforced by row level security, while a large or regulated customer is routed to a dedicated database. Per-tenant rate limits and quotas stop one noisy neighbour from degrading everyone else, and usage events feed billing. Use the diagram to discuss the isolation spectrum from shared schema to separate databases, onboarding automation, per-tenant backups and restores, data residency, and the failure mode where a missing tenant filter exposes one customer's data to another.`,
    dsl: `title "Multi-tenant SaaS"
direction LR
user "Tenant users" -> gateway "API gateway" -> ratelimiter quota "Per-tenant limits"
gateway -> service app "Application"
[app x3]
app -> service router "Tenant router"
router -> db postgres "Pooled database"
router -> db postgres "Dedicated database"
app -> topic kafka "Usage events" -> worker bill "Billing meter"`,
    keywords: ["multi-tenant", "saas architecture", "tenant isolation", "row level security"],
  },
];
