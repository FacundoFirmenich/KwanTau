# KwanTau2DOS Outcome Studio v0.36 — SHADOW integration status

## Canon

```text
KwanTau2DOS
KwanTau DOS = KwanTau Dual Operational System
KWAN = K + W
KwanBlocks = plural
No run. No implant. Ride.
```

## Sealed identity

```text
release:        0.36.0-alpha.1
branch:         outcome-studio/v0.36.0-alpha.1
tag:            outcome-studio-v0.36.0-alpha.1
release commit: ee01e75e3f4bc611bb3a5b4b9539762b4d105cd9
feature commit: f6181ca4043849908a321135674acfdd0af591f9
predecessor:    7ef47cfd4af117e257227592ef97b2d7b079ba41
git tree:       06a8c38dbbab69fb334919058cf3f904019df5f5
annotated tag:  40605050e652d8109c927f842d3a88f761a7f11a
```

## Material result

v0.36 binds the current successor deliverable exactly and exposes a dedicated human-outcome instrument. It preserves two distinct validated state-machine paths:

```text
SUCCESSOR_ACCEPTED_NO_REPAIR_SIGNAL
SUCCESSOR_ACCEPTED_WITH_REPAIR_REVIEW_REQUIRED
```

The technical evidence and the human outcome are kept separate. Test fixtures exercise both paths; they are not represented as real user evidence.

When defects or rejection are recorded, the application creates a zero-authority `SHADOW` repair blueprint:

```text
schema:             kwan.mission.repair-successor-blueprint.v1
realm:              SHADOW
authority inherited:false
auto execute:       false
next capability:    mission.repair.propose
```

## Validation

```text
static audit:                 PASS
repair-lineage audit:         PASS
generic Playwright QA:        PASS
successor-outcome QA:         PASS
visual QA:                    PASS
Kwan Browser audit:           PASS
source / clean ZIP / bundle:  logically equivalent
tracked files:                51
logical tree SHA-256:
9d95145b19ef43a9ea96f9f3fc78612278b6a891dfc2282e33465e98176a64c9
```

The first combined bundle validation timed out while waiting on descendant process cleanup. Every gate was rerun in an isolated process with a hard timeout and passed. The initial timeout is neither counted as a pass nor as a product failure.

## Canonical artifact hashes

```text
standalone HTML:
c1eb098c7bcda90a42ae8871945aa5bf536fe4bed8dda8f7037bdbd072434711

source ZIP:
92db6ba91cbd8ef92ba525ad41784674f31e165cd6be48ed30b9a838463d0ef6

Git bundle:
f020347fcad271b04f97594109f68ada26506af7e6db52ce326594974b423b8d

Kwan Browser:
5a806d2c2a963ca044b63adad416ab4ba19e3846ac60eb398425e2f94d4daee1

integral delivery:
f4f5057dc182a1fbf2d24e154224c1873e991ec3ff3bc90eae5589cf705a7469
```

## Scientific boundary

```text
technical repair verified ≠ successor human acceptance
fixture outcome ≠ empirical user outcome
repair blueprint ≠ repair execution
successful QA ≠ user utility
outcome evidence ≠ training permission
```

This branch is a textual audit and migration surface. It grants no KCH authority, records no real successor human outcome, creates no executable repair mission, performs no training or promotion and must not be merged as a substitute for the sealed Git bundle.
