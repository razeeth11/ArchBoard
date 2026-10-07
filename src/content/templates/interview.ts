import type { Template } from "../types";

export const INTERVIEW: Template[] = [
  {
    slug: "url-shortener",
    title: "URL Shortener",
    category: "Interview classics",
    summary:
      "A read-heavy link shortener with a CDN, cache and key generator in front of a database.",
    body: `A URL shortener looks trivial until the traffic numbers arrive: redirects outnumber creations by a hundred to one, so the whole design bends toward fast reads. This template puts a CDN and a Redis cache in front of the link database so a hot short code never touches disk. Creation goes through a separate key generation service that hands out unique, non-guessable codes ahead of time, which avoids both collisions and a write-time lookup. Clicks are not recorded inline; the app emits them to a Kafka topic and an analytics worker aggregates them into a warehouse, so a slow report can never slow a redirect. Use it to discuss base62 versus hashing, expiry, custom aliases and abuse handling. The weak spot is the key service: it needs its own replication story, because every create depends on it.`,
    dsl: `title "URL shortener"
direction LR
user "Visitors" -> cdn cloudfront "CDN" -> lb nginx "Load balancer" -> service app "Shortener API"
[app x3]
app -> cache redis "Hot links"
app -> db postgres "Links DB"
app -> service keygen "Key generator"
app -[click event]-> topic kafka "Click events" -> worker stats "Analytics" -> warehouse snowflake "Click warehouse"`,
    keywords: ["url shortener", "tinyurl", "bitly", "system design interview"],
  },
  {
    slug: "pastebin",
    title: "Pastebin Service",
    category: "Interview classics",
    summary:
      "Store and share text snippets with object storage for content and a database for metadata.",
    body: `Pastebin is a lesson in separating what changes from what does not. The text of a paste is immutable once written, so it belongs in object storage where it is cheap, durable and cacheable at the edge. The things that do change, such as expiry time, visibility and view counts, live in a small relational table keyed by paste id. A write returns a short identifier produced by a key service, then the content lands in a bucket under that key. Reads check the cache, fall back to the metadata row to confirm the paste has not expired, and stream the body from storage. A scheduled cleanup job deletes expired rows and objects together, which is the part candidates forget. Discuss size limits, syntax highlighting done on the client, and what happens when one paste goes viral and a single object key becomes hot.`,
    dsl: `title "Pastebin"
direction LR
client "Browser" -> cdn "CDN" -> service api "Paste API"
[api x2]
api -> cache redis "Paste cache"
api -> db postgres "Paste metadata"
api -> storage s3 "Paste content"
cron expiry "Expiry job" -> paste-metadata
expiry -> paste-content`,
    keywords: ["pastebin", "text sharing", "object storage design"],
  },
  {
    slug: "rate-limiter",
    title: "Rate Limiter",
    category: "Interview classics",
    summary: "A distributed rate limiter at the gateway with shared counters and a rules store.",
    body: `A rate limiter protects a service from both abuse and accidents, and the interesting question is where the counters live. This design checks every request at the API gateway, before any application code runs, using a shared Redis instance so that all gateway nodes agree on how many calls a key has made. The limiter reads its rules, such as requests per minute per API key, from a small configuration store that operators can edit without a deploy. Counters use a sliding window or token bucket depending on whether bursts are acceptable, and each check is a single atomic script so two nodes cannot both let the last request through. Rejected calls get an HTTP 429 with a retry hint. Talk through what to do when Redis is unreachable, since failing open keeps the product alive and failing closed protects the backend, and make that an explicit decision rather than an accident.`,
    dsl: `title "Distributed rate limiter"
direction LR
client "API clients" -> gateway kong "API gateway" -> ratelimiter limiter "Limiter check"
[api-gateway x2]
limiter -> cache redis "Counters"
limiter -> db postgres "Rules"
api-gateway -> service backend "Backend service"
monitor prometheus "Metrics"
limiter -> metrics`,
    keywords: ["rate limiter", "token bucket", "sliding window", "throttling"],
  },
  {
    slug: "notification-system",
    title: "Notification System",
    category: "Interview classics",
    summary: "Fan out email, SMS and push notifications through a queue with per-channel workers.",
    body: `Notification systems fail by being synchronous: a slow email provider should never block an order from completing. This template accepts requests from internal services through one notification API, validates them against user preferences, and writes a message onto a durable queue. Separate worker pools consume per channel, one each for email, SMS and mobile push, so each can scale and fail on its own and each can respect its provider's rate limits. Workers call out to external gateways such as Twilio, record the delivery result, and push failures into a retry path with backoff. A preferences store holds opt-outs and quiet hours, which is both a product feature and a legal requirement. Use the diagram to discuss deduplication keys, template rendering, priority lanes for password resets, and how you would show delivery status back to the sender without polling every provider.`,
    dsl: `title "Notification system"
direction LR
service orders "Order service" -> service notify "Notification API"
service billing "Billing service" -> notify
notify -> db postgres "Preferences"
notify -> queue kafka "Notification queue"
notification-queue -> worker email "Email worker" -> external "Email provider"
notification-queue -> worker sms "SMS worker" -> external twilio "SMS gateway"
notification-queue -> worker push "Push worker" -> external "Push service"`,
    keywords: ["notification system", "push notifications", "message queue"],
  },
  {
    slug: "chat-application",
    title: "Chat Application",
    category: "Interview classics",
    summary: "Real-time chat with WebSocket gateways, a message store, presence and offline push.",
    body: `A chat system has two very different jobs: keep millions of open connections alive, and keep every message safely ordered and stored. The diagram separates them. Stateful WebSocket gateways hold the connections and do nothing smart; a stateless chat service validates, sequences and persists each message to a wide-column store that scales for append-heavy writes. A pub/sub layer routes a message from the sender's gateway to the gateway holding the recipient's socket, and a presence service tracks who is online with short expiring keys. If the recipient is offline the message still lands in the store and a push notification goes out through a mobile provider. Walk through group chats, where fan-out grows with membership, read receipts, and the choice between per-conversation ordering and a global clock. Connection draining during deploys is the operational detail worth mentioning.`,
    dsl: `title "Chat application"
direction LR
mobile "Mobile app" -> lb "Load balancer" -> service ws "WebSocket gateway"
[ws x3]
ws -> service chat "Chat service"
chat -> db cassandra "Message store"
chat -> pubsub "Message router"
message-router -> ws
chat -> cache redis "Presence"
chat -> queue sqs "Offline queue" -> worker push "Push sender"`,
    keywords: ["chat system design", "websocket", "whatsapp design", "presence"],
  },
  {
    slug: "news-feed",
    title: "News Feed",
    category: "Interview classics",
    summary:
      "Fan-out on write for most users and fan-out on read for celebrities, behind a feed cache.",
    body: `The news feed problem is a trade between write cost and read latency. Pushing every new post into each follower's precomputed feed makes reads instant, but a user with ten million followers turns one post into ten million writes. This template shows the hybrid most real systems adopt: ordinary accounts fan out on write through a queue and workers that fill per-user feed lists in Redis, while very popular accounts are merged in at read time. A graph store answers who follows whom, a post service owns the canonical content, and a ranking step orders what the user finally sees. Media is served through a CDN and never passes through the feed path. Use it to discuss pagination with cursors, cache warming for returning users, and how to backfill a feed when someone follows a new account.`,
    dsl: `title "News feed"
direction LR
mobile "App" -> gateway "API gateway" -> service feed "Feed service"
gateway -> service post "Post service" -> db postgres "Posts DB"
post -> queue kafka "Fan-out queue" -> worker fan "Fan-out workers"
fan -> db neo4j "Social graph"
fan -> cache redis "Feed cache"
feed -> feed-cache
feed -> service rank "Ranking"
cdn "Media CDN" -> storage s3 "Media"`,
    keywords: ["news feed", "fan-out", "timeline design", "twitter design"],
  },
  {
    slug: "ride-sharing",
    title: "Ride Sharing",
    category: "Interview classics",
    summary:
      "Match riders and drivers with a location service, geospatial index and trip state machine.",
    body: `Ride sharing combines a hot stream of location updates with a low-volume, high-stakes trip lifecycle, and the design keeps them apart. Drivers send their position every few seconds to a location service that writes into an in-memory geospatial index, so a nearby search is a single radius query instead of a database scan. A matching service reads candidates from that index, scores them on distance and rating, and offers the trip to one driver at a time. Once accepted, the trip enters a state machine in a relational database where correctness matters more than speed, and payments are triggered only from that record. Notifications and live tracking flow back to the rider over a push channel. Discuss geohash versus quadtree, surge pricing as a separate service, and what to do when a driver app loses connectivity mid-trip.`,
    dsl: `title "Ride sharing"
direction LR
mobile "Driver app" -> service loc "Location service" -> cache redis "Geo index"
mobile "Rider app" -> gateway "API gateway" -> service match "Matching service"
match -> geo-index
match -> service trip "Trip service" -> db postgres "Trips DB"
trip -> external stripe "Payments"
trip -> queue kafka "Trip events" -> worker notify "Notifications"`,
    keywords: ["uber design", "ride sharing", "geospatial index", "matching service"],
  },
  {
    slug: "video-streaming",
    title: "Video Streaming",
    category: "Interview classics",
    summary:
      "Upload, transcode into adaptive bitrate renditions and serve video segments through a global CDN.",
    body: `Video streaming splits cleanly into an upload path that is slow and compute heavy, and a playback path that must be cheap and global. Uploads land in object storage, which emits an event that triggers a transcoding pipeline: workers split the file, encode several resolutions and bitrates, and write the segments plus a manifest back to storage. Playback never touches the application servers for bytes; players fetch the manifest and then segments directly from a CDN, switching bitrate as the network changes. A metadata service and database hold titles, thumbnails and permissions, and a search index makes the catalogue findable. Use this template to talk about chunked uploads that can resume, hardware encoding cost, DRM, and why popular titles are pushed to edge caches ahead of release while the long tail is pulled on demand.`,
    dsl: `title "Video streaming"
direction LR
client "Creator" -> service upload "Upload service" -> storage s3 "Raw video"
raw-video -> queue sqs "Transcode jobs" -> worker enc "Transcoder"
enc -> storage s3 "Encoded segments"
user "Viewer" -> cdn cloudfront "CDN" -> encoded-segments
user -> service meta "Metadata API" -> db mysql "Catalogue"
meta -> search elasticsearch "Search index"`,
    keywords: ["video streaming", "netflix design", "transcoding", "adaptive bitrate"],
  },
  {
    slug: "file-storage-sync",
    title: "File Storage and Sync",
    category: "Interview classics",
    summary: "Chunked file sync with a metadata service, block store and change notifications.",
    body: `A Dropbox style product avoids re-uploading whole files by cutting them into content-addressed blocks. The client hashes each block and asks the sync service which ones the server already has, so only new or changed blocks travel over the network, and identical blocks across users are stored once. Blocks go to object storage; the file tree, versions and sharing permissions live in a metadata database that is the real source of truth. When something changes, the metadata service writes an event and a notification service tells other devices to pull the diff over a long-lived connection. This template highlights the separation between cheap bulk bytes and small, consistent metadata. Discuss conflict handling when two devices edit offline, delta compression, soft delete for version history, and encryption at rest versus true end-to-end encryption.`,
    dsl: `title "File sync"
direction LR
client "Desktop client" -> lb "Load balancer" -> service sync "Sync service"
sync -> db postgres "File metadata"
sync -> storage s3 "Block store"
sync -> queue kafka "Change events" -> service notify "Notification service"
notify -> desktop-client
sync -> cache redis "Block index"`,
    keywords: ["dropbox design", "file sync", "block storage", "deduplication"],
  },
  {
    slug: "web-crawler",
    title: "Web Crawler",
    category: "Interview classics",
    summary:
      "A polite distributed crawler with a URL frontier, fetchers, parsers and dedup storage.",
    body: `A crawler is a loop: take a URL, fetch it, extract links, and feed the new ones back in. Doing that at scale means the URL frontier becomes the heart of the system. It orders work by priority and enforces politeness, ensuring one host is never hammered by many fetchers at once. Fetcher workers resolve DNS, honour robots rules, download pages and place raw content in object storage. Parsers pull out text and links, a deduplication step using content hashes and a bloom filter keeps the crawler from revisiting the same page, and fresh links return to the frontier. A scheduler decides recrawl frequency from how often a page changes. Discuss traps such as infinite calendars, handling JavaScript-rendered pages, and splitting the frontier by host hash so each worker owns a stable set of domains.`,
    dsl: `title "Web crawler"
direction LR
scheduler "Seed scheduler" -> queue kafka "URL frontier"
url-frontier -> worker fetch "Fetchers"
[fetch x4]
fetch -> external "Websites"
fetch -> storage s3 "Raw pages"
raw-pages -> worker parse "Parsers"
parse -> cache redis "Seen URLs"
parse -> url-frontier
parse -> search elasticsearch "Index"`,
    keywords: ["web crawler", "url frontier", "bloom filter", "search engine"],
  },
  {
    slug: "search-autocomplete",
    title: "Search Autocomplete",
    category: "Interview classics",
    summary: "Type-ahead suggestions served from an in-memory trie rebuilt from query logs.",
    body: `Autocomplete has a brutal latency budget: suggestions must arrive before the next keystroke, so there is no room for a database query on the hot path. This design serves prefixes from a trie held in memory on a fleet of suggestion servers, fronted by a cache and a CDN for the most common prefixes. The data comes from the other direction: search queries are logged to a stream, an offline pipeline counts them over a time window, filters out spam and offensive terms, and builds a fresh trie snapshot that servers load atomically. Trending terms can be mixed in from a faster, smaller pipeline. Use the template to discuss personalised versus global suggestions, how many characters to wait before calling the server, debouncing on the client, and how to roll back a bad snapshot quickly.`,
    dsl: `title "Search autocomplete"
direction LR
browser "Search box" -> cdn "Edge cache" -> service suggest "Suggestion service"
[suggest x3]
suggest -> cache redis "Trie cache"
search-box -[query log]-> topic kafka "Query log" -> worker agg "Aggregator" -> storage s3 "Trie snapshots"
trie-snapshots -> suggest`,
    keywords: ["autocomplete", "typeahead", "trie", "search suggestions"],
  },
  {
    slug: "key-value-store",
    title: "Distributed Key-Value Store",
    category: "Interview classics",
    summary:
      "A Dynamo-style store with consistent hashing, replication and quorum reads and writes.",
    body: `A distributed key-value store answers one question many times: which nodes own this key? Consistent hashing places nodes and keys on a ring so that adding a machine moves only a small slice of data. Each key is replicated to several neighbouring nodes, and clients or a coordinator read and write with a quorum, for example two of three replicas, trading latency against consistency. Writes also append to a commit log and an in-memory table that flushes to sorted files on disk, which keeps writes fast. Gossip spreads membership and failure information, hinted handoff holds writes for a node that is briefly down, and anti-entropy repair reconciles replicas that drifted apart. The diagram is deliberately small so you can talk through vector clocks, tombstones, hot keys and what the client sees during a network partition.`,
    dsl: `title "Distributed key-value store"
direction LR
client "Client" -> service coord "Coordinator"
[coord x3]
coord -> node n1 "Storage node A"
coord -> node n2 "Storage node B"
coord -> node n3 "Storage node C"
n1 -> n2 -> n3
monitor prometheus "Cluster health"
coord -> cluster-health`,
    keywords: ["key-value store", "dynamo", "consistent hashing", "quorum"],
  },
  {
    slug: "ticket-booking",
    title: "Ticket Booking",
    category: "Interview classics",
    summary: "Prevent double booking with seat holds, a waiting room and transactional payments.",
    body: `Selling a limited set of seats to a huge crowd is a concurrency problem wearing a retail costume. The core rule is that a seat can be held by exactly one person at a time, so selecting a seat creates a short-lived hold with an expiry, stored in Redis for speed and mirrored by a transactional database that is the final authority. A virtual waiting room in front of the booking service meters entry when a popular event opens, protecting the backend from a stampede. Checkout converts a hold into a booking inside a database transaction and only then charges the payment provider, with idempotency keys so a retry never double charges. Expired holds return seats to the pool. Use this template to compare pessimistic and optimistic locking, discuss bot defence, and plan what the user sees when a hold times out during payment.`,
    dsl: `title "Ticket booking"
direction LR
user "Buyers" -> service waitroom "Waiting room" -> gateway "API gateway" -> service book "Booking service"
book -> cache redis "Seat holds"
book -> db postgres "Bookings"
book -> external stripe "Payment provider"
book -> queue sqs "Confirmation queue" -> worker mail "Email confirmations"`,
    keywords: ["ticket booking", "seat reservation", "double booking", "ticketmaster design"],
  },
  {
    slug: "payment-system",
    title: "Payment System",
    category: "Interview classics",
    summary:
      "A payment flow with idempotent APIs, a ledger, a provider gateway and reconciliation.",
    body: `A payment system is judged by what it never does: charge twice, lose a transaction, or let two records disagree. This template routes every request through an API that demands an idempotency key, so a retried call returns the original result. A payment service moves a payment through explicit states and calls an external processor, while a double-entry ledger records each movement as balanced debits and credits that are never updated, only appended. Results from the processor arrive asynchronously through webhooks, which a dedicated handler verifies and applies. A nightly reconciliation job compares the ledger with the processor's settlement files and flags every difference for a human. Use the diagram to discuss timeouts with unknown outcomes, retry safety, PCI scope reduction through tokenisation, and why money amounts are stored as integer minor units rather than floating point.`,
    dsl: `title "Payment system"
direction LR
client "Merchant app" -> gateway "API gateway" -> service pay "Payment service"
pay -> db postgres "Payments DB"
pay -> db postgres "Ledger"
pay -> external stripe "Payment processor"
payment-processor -[webhook]-> service hook "Webhook handler" -> pay
cron "Reconciliation" -> ledger
reconciliation -> storage s3 "Settlement files"`,
    keywords: ["payment system", "idempotency", "ledger", "reconciliation"],
  },
  {
    slug: "distributed-cache",
    title: "Distributed Cache",
    category: "Interview classics",
    summary:
      "A sharded cache tier with consistent hashing, replicas and a cache-aside application.",
    body: `A cache tier is only useful if it is cheaper and faster than what it protects, and only safe if you know what happens when it is cold. Here the application owns the logic: it asks a client library which shard holds a key using consistent hashing, reads from that shard, and on a miss loads from the database and writes the value back with a time to live. Each shard has a replica that is promoted if the primary fails, and a monitor watches hit ratio, evictions and memory. The diagram is a prompt to discuss thundering herds when a hot key expires, request coalescing, negative caching for missing rows, invalidation versus short expiry, and what capacity you need if the cache disappears entirely. A cache that the database cannot survive without is a dependency, not an optimisation.`,
    dsl: `title "Distributed cache"
direction LR
service app "Application"
[app x3]
app -> cache redis "Cache shard 1"
app -> cache redis "Cache shard 2"
app -> cache redis "Cache shard 3"
app -[on miss]-> db postgres "Database"
cache-shard-1 -> cache memcached "Replica 1"
monitor prometheus "Hit ratio"
cache-shard-1 -> hit-ratio`,
    keywords: ["distributed cache", "redis cluster", "cache invalidation", "thundering herd"],
  },
  {
    slug: "unique-id-generator",
    title: "Unique ID Generator",
    category: "Interview classics",
    summary: "Time-ordered 64-bit identifiers from many generators without central coordination.",
    body: `Auto-increment columns stop working the moment data spans several databases, and a single ticket server becomes a bottleneck and a single point of failure. The Snowflake style answer packs a timestamp, a machine identifier and a per-millisecond sequence into 64 bits, so every generator can mint ids independently and they still sort roughly by time. The only coordination happens at start up, when a node claims a unique machine id from a small coordination store. Services call the generator through a library or a thin service, and clock drift is guarded by refusing to issue ids if time moves backwards. Use this template to discuss bit allocation, what happens on a leap second or a restart inside the same millisecond, why ULIDs and UUIDs trade ordering for simplicity, and how ids interact with database index locality.`,
    dsl: `title "Unique ID generator"
direction LR
service orders "Order service" -> service idgen "ID generator"
[idgen x3]
service users "User service" -> idgen
idgen -> db postgres "Machine id registry"
monitor prometheus "Clock drift alerts"
idgen -> clock-drift-alerts`,
    keywords: ["unique id generator", "snowflake id", "uuid", "distributed ids"],
  },
  {
    slug: "metrics-monitoring",
    title: "Metrics and Monitoring",
    category: "Interview classics",
    summary: "Collect, store, query and alert on time-series metrics from a fleet of services.",
    body: `Monitoring is itself a distributed system with a write path far heavier than its read path. Agents on every host and sidecars in every service push or expose counters and gauges; a collector tier batches them and writes to a time-series database, usually after passing through a queue that absorbs bursts. Storage downsamples old data, keeping per-second detail for hours and per-minute rollups for months, because nobody needs last year at full resolution. A query layer powers dashboards, while a separate rules engine evaluates alert conditions continuously and sends pages through an on-call tool. The template invites discussion of cardinality explosions from badly chosen labels, pull versus push collection, how to monitor the monitor, and why alerting should be on symptoms users feel rather than every internal metric that wobbles.`,
    dsl: `title "Metrics and monitoring"
direction LR
service a "Service A" -> worker collect "Collector"
service b "Service B" -> collect
node host "Host agents" -> collect
collect -> queue kafka "Metrics buffer" -> db influxdb "Time-series DB"
time-series-db -> monitor grafana "Dashboards"
time-series-db -> service alert "Alert rules" -> external twilio "On-call pager"`,
    keywords: ["metrics monitoring", "time series database", "alerting", "observability"],
  },
  {
    slug: "ecommerce-checkout",
    title: "E-commerce Checkout",
    category: "Interview classics",
    summary: "Cart, inventory reservation, payment and order events across cooperating services.",
    body: `Checkout touches inventory, pricing, payment and fulfilment, and the trap is making them all succeed or fail together inside one transaction. This template keeps each concern in its own service and coordinates them through events. The cart service holds the basket in Redis; at checkout the order service creates a pending order and asks inventory to reserve stock for a limited time. Payment is called next, and only when it succeeds does the order move to confirmed and publish an event that fulfilment, email and analytics consume independently. If any step fails, compensating actions release the stock and cancel the order. It is a good starting point for discussing sagas, idempotent consumers, price changes between cart and payment, and how to keep the storefront browsable when a downstream service is unavailable.`,
    dsl: `title "E-commerce checkout"
direction LR
browser "Shopper" -> gateway "API gateway" -> service cart "Cart service" -> cache redis "Cart store"
gateway -> service order "Order service" -> db postgres "Orders DB"
order -> service stock "Inventory service" -> db mysql "Stock DB"
order -> external stripe "Payments"
order -> topic kafka "Order events"
order-events -> worker ship "Fulfilment"
order-events -> worker mail "Email receipts"`,
    keywords: ["e-commerce architecture", "checkout flow", "saga", "inventory reservation"],
  },
];
