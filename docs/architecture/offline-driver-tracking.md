# Offline-first driver tracking and custody evidence

## Status
Architecture decision for the delivery lifecycle. This document is not a claim that background tracking is already implemented.

## Decision
The driver tracking client must be a native Android application (or a native Android shell with a maintained background-location implementation). The existing Vite/PWA browser client remains useful for dispatch, buyer/supplier/admin views, and foreground fallback, but browser geolocation and a service worker cannot guarantee continuous GPS collection while the page is suspended, the phone is locked, or the browser is terminated.

Android is the first supported driver platform. iOS requires a separate native permission and background-execution validation before being advertised as supported.

## Lifecycle and custody
1. The supplier creates a handover receipt for the exact freight load. It records the load, supplier, assigned driver, registered vehicle, quantity/condition declaration, photo evidence, supplier signature/attestation, driver acknowledgement, GPS fix (when available), device capture time, and server receipt time.
2. The backend validates the supplier is the load's supplier, the driver is assigned, the vehicle is the assigned and compliant vehicle, and the load is at pickup. It persists the evidence idempotently and changes the load into the pickup-confirmed / in-transit lifecycle atomically.
3. Immediately after a successful handover confirmation, the driver's native app starts a foreground location service and records a first GPS fix. If no fix is available, the app records a visible pending-fix state and retries; it must not fabricate coordinates.
4. The buyer sees the latest server-received position, its capture time, server-received time, accuracy, and freshness state. A stale point is explicitly labelled as the last known position.
5. The buyer independently confirms receipt at destination. This remains separate from the driver's delivery declaration and supplier handover.
6. Settlement remains blocked until all required evidence and confirmations are present.

## Offline capture and synchronization
- Use a durable SQLite queue on the Android device. Store a generated UUID per sample, load association(s), device timestamp, monotonic sequence, latitude/longitude, accuracy, speed, heading, and capture source.
- Protect queued location and custody payloads at rest using an encryption key held in Android Keystore; do not store access tokens or secrets in the queue.
- Capture locally when mobile data/Wi-Fi is absent. Retry synchronization with bounded exponential backoff and jitter when connectivity returns, and also on app resume / connectivity restoration.
- Upload in ordered, idempotent batches. The server deduplicates by client-generated event UUID and retains both device capture time and server receipt time.
- Acknowledged records may be removed only after the server confirms durable persistence. Failed batches remain queued and visible to the driver.
- The buyer map displays only server-acknowledged records. It never presents queued device records as live server positions.
- On reconnection, historical points are inserted in capture order; the map's current marker uses the newest valid capture, while the timeline preserves all samples and communication gaps.
- Use adaptive sampling (for example, shorter intervals while moving and longer intervals while stationary) with accuracy, battery, and network constraints. Sampling policy must be configurable and tested in real Android devices.

## Android background execution
- Use Android background location permission and a foreground service with a persistent notification while an assigned load is being transported.
- Start only after the supplier handover transaction is confirmed; stop after destination receipt / cancellation / authorized completion.
- Handle permission denial, approximate-only permission, battery optimization, process death, device reboot, revoked permissions, GPS disabled, and low storage explicitly.
- The driver must be shown whether tracking is active, paused by OS/permission, waiting for GPS, or syncing queued samples.
- Do not claim tracking while the device is powered off, the GPS receiver is unavailable, permissions are revoked, or the operating system prevents execution. These states create an explicit tracking gap and last-known-location warning.
- Browser/PWA fallback may capture while active/visible, but must not be described as equivalent to native background tracking.

## Data and API requirements
- Add an immutable location event identifier, device capture timestamp, server receipt timestamp, device sequence, and synchronization metadata to the persisted location model (or a dedicated append-only sample table).
- Enforce load authorization server-side: only the assigned driver can submit samples; buyer, supplier, and authorized admins can read only the loads they participate in.
- Validate coordinate ranges, timestamp skew, sequence/idempotency, payload size, and rate limits. Treat device time and GPS as evidence, not cryptographic proof of physical presence.
- Preserve raw GPS values and accuracy. Never silently snap a reported position to a road.
- Retain the existing Realtime publication for authorized buyer/admin views; realtime is an acceleration path, while persisted history remains the source of truth.
- Ensure a driver with multiple active loads can associate a sample with every currently transported load without starting duplicate GPS services.

## Buyer experience
- Live marker only when a fresh server-acknowledged point exists.
- Show "Última posição recebida", capture time, received time, accuracy, and a clear state: live/recent, delayed, offline gap, or no GPS fix.
- Draw the route from recorded points; do not interpolate or invent movement during gaps.
- Provide a chronological trip history, including synchronization gaps and handover/departure/arrival events.

## Acceptance tests
- Handover starts tracking immediately after server confirmation and is idempotent.
- First fix is captured without requiring the driver to navigate to another screen.
- A 30+ minute network outage retains ordered local samples and syncs them exactly once after reconnection.
- App process termination/restart and Android reboot recover the queued samples and resume only for active assigned loads.
- Permission revoked, GPS disabled, battery restrictions, low storage, and device-off conditions are surfaced honestly.
- Buyer receives realtime updates when online and a correct last-known state during outages.
- Unauthorized users cannot submit or read location or custody evidence.
- Duplicate, out-of-order, malformed, and stale samples are handled deterministically.
- Multi-load trips use one device tracking service and associate points only with active authorized loads.
- Supplier handover proof and buyer receipt remain distinct, independently authorized custody events.

## Rollout
1. Reconcile the existing draft purchase/delivery evidence work with current main; do not merge its stale branch wholesale.
2. Implement and test the server schema/RPCs and custody evidence first.
3. Build the Android driver client and offline queue; test on physical devices with network toggling, screen lock, process kill, reboot, and battery optimization.
4. Integrate buyer realtime map and supplier/admin evidence views.
5. Roll out behind a feature flag to internal test users, then pilot before production-wide enforcement.

## Current repository constraint
The current repository is a Vite/React web application with a service worker; it does not currently contain an Expo/React Native or Capacitor native driver application. A service worker does not provide a continuous GPS execution context. Therefore a browser-only implementation cannot satisfy the background/offline requirement honestly.
