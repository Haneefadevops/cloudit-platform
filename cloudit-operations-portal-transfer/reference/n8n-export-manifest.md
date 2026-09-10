# Canonical n8n Export Manifest

The completed production workflow JSON files remain in the Cavetta repository
and are not copied into the portal application repository. The portal must use
the sanitized publishing contract instead of importing or executing these files.

Verified on 10 September 2026:

| Export | SHA-256 |
| --- | --- |
| `Cavetta - Approved Monthly Report Sender.json` | `32F0B8B1267FBF5687144BC810417332E1529381F0C3D9B8CECFDBF561E2FE8F` |
| `Cavetta - Automation Watchdog.json` | `114B5E95B6E49BCDE635A1621594CB01DF0803B8075DB5788F5E10E741808EFB` |
| `Cavetta - Load Maintenance Configuration.json` | `064414A17310D37F0927B2629EF99C80A6C182BF26F1CC1F14FA800284BC9E26` |

Acceptance summary: ten JSON exports parsed, 54 Code nodes passed syntax checks,
and the corrected production-safety batch retained report-state/idempotency
guards with `ticketing_enabled=false`.

