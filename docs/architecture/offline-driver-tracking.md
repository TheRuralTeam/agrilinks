# Freight tracking and custody implementation notes

## Confirmed production defects
- \`advance_freight_load_status\` currently allows the assigned driver to set \`in_transit\` and writes a \`supplier_handover\` event with the driver as actor. This conflates supplier custody transfer with driver departure.
- Production has supplier-handover timestamps but no supplier handover evidence table/RPC.
- Current location upsert overwrites the latest point and the history has no client event ID, device sequence, device capture time, or server receipt time. It cannot safely deduplicate offline replay.
- Buyer map component accepts a driver marker, but the buyer purchase page does not yet provide the full tracking experience.
- The existing \`freight_loads\` policy \`Authenticated can view freight loads\` uses \`USING (true)\`; it is a separate high-priority exposure because the row contains \`qr_token\`. Do not broaden reads or publish this table through Realtime while this is unresolved.
- PR #76 remains open and contains older delivery/payment changes. It must be reviewed and reconciled separately; it is not a safe drop-in base.

## Implemented in this feature branch
- Supplier handover evidence table, private storage bucket and participant-only read policies.
- Supplier submission RPC validates supplier ownership, pickup status, assigned driver/vehicle, payment and approved freight quote; it records supplier evidence without starting transit.
- Driver acknowledgement RPC is the only path that completes handover and transitions the load into transit.
- A database trigger blocks direct \`at_pickup -> in_transit\` transitions unless the matching supplier receipt is acknowledged.
- GPS history now supports client event UUID, device UUID, device sequence, device capture time and server receipt time.
- Batch GPS RPC accepts up to 100 samples, validates timestamps and coordinates, deduplicates replays, preserves captured chronology, and updates the latest marker only when a newer capture arrives.
- Existing single-point GPS RPC remains compatible and now fills capture/receipt timestamps.

## Not yet implemented / release blockers
- Native Android driver client with a foreground location service and durable encrypted SQLite queue.
- Web IndexedDB queue and UI integration.
- Supplier and driver UI for the two-step handover receipt.
- Buyer realtime tracking page and stale/offline status display.
- Removal or narrowing of the broad freight-load SELECT policy after a complete query audit (must avoid breaking open-load discovery).
- Physical-device tests: screen lock, process death, reboot, airplane mode, no GPS fix, battery optimization and reconnection.
- CI and production migration rollout.

## Platform constraint
A service worker cannot provide a continuous GPS execution context. Android background tracking requires a correctly permissioned location foreground service started while the app is visible and a persistent notification; Android versions also impose while-in-use and background-start restrictions. Device-off, revoked permissions, unavailable GNSS, or OS-enforced suspension must be represented as tracking gaps, never as fabricated live locations.
