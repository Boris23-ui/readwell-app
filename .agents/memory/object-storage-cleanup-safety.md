---
name: Object storage cleanup safety
description: Safety rules for deleting abandoned PDF page objects from cloud-storage listings.
---

## Rule

Orphan cleanup must fail closed when a PDF page object's age metadata is
missing or invalid. Skip only the affected book folder and continue cleaning
other folders whose timestamps are complete and valid.

**Why:** Cloud object listings can temporarily return incomplete metadata. Treating
an unknown timestamp as the Unix epoch makes an active book appear ancient and
can silently delete pages the reader still needs.

**How to apply:** Track metadata completeness per `pdf-pages/<bookId>/` folder,
require a finite `timeCreated` before comparing against the retention cutoff,
and keep deletion of valid sibling folders independent.