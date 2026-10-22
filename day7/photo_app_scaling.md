# SnapShare Scaling Plan

SnapShare is a photo-sharing app. Users upload photos and scroll a feed of photos from the people they follow. This plan estimates the load for 10 million registered users and designs a system that can carry it.

## 1. Assumptions

- There are 10,000,000 registered users.
- 10% of them use the app on a given day, so there are **1,000,000 daily active users (DAU)** (10,000,000 × 10%).
- Each active user uploads **1 photo per day**.
- Each active user views **50 feed pages per day**.
- An average photo is **2 MB**, and each photo also gets a **50 KB thumbnail**.
- Peak traffic is **5×** the average.
- For easy maths, 1 day ≈ 100,000 seconds (the real figure is 86,400), and 1 KB = 1,000 bytes, 1 MB = 1,000 KB, 1 GB = 1,000 MB, 1 TB = 1,000 GB.
- My own assumption for the database: each photo's metadata row (id, owner, caption, file location, time) is about 500 bytes.

## 2. Load estimates

```text
Uploads (writes):
  1,000,000 users × 1 photo        = 1,000,000 uploads per day
  1,000,000 ÷ 100,000              ≈ 10 uploads per second (average)
  Peak (× 5)                       ≈ 50 uploads per second

Feed views (reads):
  1,000,000 users × 50 pages       = 50,000,000 feed views per day
  50,000,000 ÷ 100,000             ≈ 500 feed views per second (average)
  Peak (× 5)                       ≈ 2,500 feed views per second

Photo storage per year:
  Originals:   1,000,000 × 2 MB    = 2,000,000 MB  = 2 TB per day
  Thumbnails:  1,000,000 × 50 KB   = 50,000,000 KB = 50 GB per day
  Total per day                    ≈ 2.05 TB
  Per year:    2 TB × 365          = 730 TB (originals)
               50 GB × 365         ≈ 18 TB  (thumbnails)
               Total               ≈ 750 TB per year (about 0.75 PB)

Database (metadata only):
  1,000,000 rows/day × 500 bytes   = 500 MB per day
  500 MB × 365                     ≈ 180 GB per year
```

What this tells us:

- Upload bandwidth is about 10 uploads/s × 2 MB = **20 MB/s on average and about 100 MB/s at peak**.
- The photo files need about **750 TB per year**, which is more than 4,000 times the 180 GB the database needs for the same photos.
- If the cache serves 80–90% of feed views (as in the course example), only about 250–500 of the 2,500 peak feed views per second reach the database.

## 3. Read-heavy or write-heavy?

SnapShare is **read-heavy**. There are about 500 feed views per second against about 10 uploads per second, so reads outnumber writes about **50 to 1**.

What this means for the design:

- **Cache the feeds** in memory so most reads never reach the database.
- **Use read replicas**, so the primary database only handles the small number of writes and the replicas handle reads.
- **Serve photos from a CDN**, since the same popular photos and thumbnails are requested again and again.
- **Keep writes simple and safe**: they are rare, but each one carries a 2 MB file, so the upload path must be reliable and slow work must go to a queue.

## 4. Why photos do not go inside the database

- **Size:** photos would add about 750 TB per year to a database that otherwise needs about 180 GB. A database is built for small structured rows, not huge files.
- **Cost and speed:** database storage is more expensive than file storage, and large files slow down queries, backups and replication, because every replica would have to copy every photo.
- **Cache and CDN:** a CDN can serve a file from object storage directly, whereas a photo inside a database would have to be fetched through the database and app servers every time.

Photos go into **object storage** (for example Amazon S3), which is cheap, very durable and built for huge numbers of files. The database stores only a **link** (the file's key or URL) for each photo, together with its owner, caption and time.

## 5. Architecture diagram

```text
 ┌───────────────────┐   1. DNS lookup       ┌───────────┐
 │ Browser / mobile  │ ────────────────────> │    DNS    │
 │      client       │                       └───────────┘
 └─────┬───────┬─────┘
       │       │ 2. photos and thumbnails (static files)
       │       v
       │   ┌───────┐  cache miss: fetch the file from object storage
       │   │  CDN  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
       │   └───────┘                                              │
       │ 3. API calls (HTTPS, JSON)                               │
       v                                                          │
 ┌───────────────┐                                                │
 │ Load balancer │                                                │
 └───────┬───────┘                                                │
   ┌─────┴─────────┬───────────────┐                              │
   v               v               v                              │
┌────────┐     ┌────────┐     ┌────────┐                          │
│ App 1  │     │ App 2  │     │ App 3  │   (stateless, identical) │
└───┬────┘     └───┬────┘     └───┬────┘                          │
    └──────────────┼──────────────┘                               │
                   │ every app server talks to all of these:      │
      ┌────────────┼───────────────┬──────────────────┐           │
      v            v               v                  v           │
┌───────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────────┐  │
│   Cache   │ │ Primary DB │ │   Queue    │ │  Object storage  │<─┘
│  (Redis)  │ │  (writes)  │ │   (jobs)   │ │ originals  2 MB  │
└───────────┘ └─────┬──────┘ └─────┬──────┘ │ thumbnails 50 KB │
                    │ copy         │        └────────▲─────────┘
                    v              v                 │
             ┌────────────┐  ┌────────────┐          │ reads the original,
             │ Read       │  │   Worker   │──────────┘ saves the thumbnail
             │ replica    │  │(thumbnails)│
             │ (feed      │  └────────────┘
             │  reads)    │
             └────────────┘

 Writes (uploads, follows) go to the primary DB.
 Feed reads go to the cache first, then to the read replica on a miss.
```

## 6. What each component does

- **DNS:** turns the name `snapshare.com` into the IP address of the system, so users do not need to know where the servers are.
- **CDN:** keeps copies of photos and thumbnails on edge servers near users, so images load faster and our own servers carry far less traffic.
- **Load balancer:** spreads requests across the app servers and skips any that fail a health check, so no single server is overloaded or a single point of failure.
- **App servers:** run the SnapShare API code (uploads, feeds, follows), and because they are stateless we can add more of them as traffic grows.
- **Cache (Redis):** keeps recent feeds in memory so most of the 500 feed views per second never touch the database.
- **Primary database:** stores users, follows and photo metadata, and is the single place that accepts writes so the data stays consistent.
- **Read replica:** holds a copy of the primary's data and answers feed reads, so reading does not slow down writing and the primary is not overloaded.
- **Object storage:** holds the actual photo files (about 750 TB per year) cheaply and durably, which a database cannot do economically.
- **Queue:** holds "create a thumbnail" jobs so the upload can finish quickly and sudden bursts of uploads wait in line instead of overloading the system.
- **Worker:** takes jobs from the queue in the background and creates the thumbnails, so this slow work never delays the user.

## 7. Upload flow, step by step

1. The user picks a photo and taps upload. The client sends the photo with a `POST /photos` request. DNS has already pointed the API address at the load balancer, so the request goes there.
2. The **load balancer** forwards the request to a healthy app server.
3. The **app server** checks the user's token and validates the upload (it is an image and it is not too large).
4. The app server saves the original 2 MB file to **object storage** and gets back the file's key.
5. The app server writes a metadata row (owner, caption, file key, time, `thumbnail_ready = false`) to the **primary database**.
6. The app server adds a job, "create thumbnail for photo 123", to the **queue**.
7. The app server replies to the user with `201 Created` straight away, without waiting for the thumbnail. The upload feels fast.
8. A **worker** takes the job from the queue, reads the original from object storage, creates a 50 KB thumbnail and saves it to object storage.
9. The worker updates the photo's row in the primary database (`thumbnail_ready = true`). If the job fails, it is retried later (waiting longer each time).
10. The poster's own cached feed is deleted so they see the new photo at once. Followers' cached feeds are not deleted one by one (a popular user could have millions of followers). They simply expire after a short time to live (about 1 minute), and the next feed read then fetches fresh data from a read replica and stores it in the cache.
11. When followers scroll their feed, the thumbnails and photos are served from the **CDN**, which fetches them from object storage the first time and keeps a copy near each user.

## 8. Trade-offs

- **Speed versus freshness.** Caching feeds and using read replicas make reads very fast, but a replica can lag by a few milliseconds and a cached feed can be slightly out of date. A new photo may take up to about a minute to show up in a follower's feed. That is acceptable for a photo feed (unlike a bank balance), so I chose speed.
- **Fast upload versus instant thumbnail.** Using a queue and worker means the user gets a reply immediately, but the thumbnail does not exist for the first few seconds. The app must show a placeholder until `thumbnail_ready` is true. In exchange, bursts of uploads cannot overload the app servers, but we must run and monitor a queue and workers, which adds complexity.
- **Cost versus reliability.** A CDN, replicas, a cache and 750 TB of new storage every year improve speed and uptime, but they cost a lot. To control the cost, rarely viewed old originals could move to cheaper "cold" storage, at the price of slower access to them.
- **Simplicity versus scalability.** I kept one primary database with replicas and did not shard it, because about 180 GB of metadata per year fits comfortably in one database for now. This is simpler to build and run, but if the app grows much larger, the primary could become the bottleneck and sharding would be needed.