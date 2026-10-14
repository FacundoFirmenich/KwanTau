# Human Authority Console

The console is a decision surface, not an authority generator.

## Request contents

Every request shows:

- what will happen;
- which component owns the action;
- whether it is productive or irreversible;
- what personal data and jurisdictional relations are implicated;
- what alternatives exist;
- what rollback or compensation is declared;
- when the request expires.

## Decision ceremony

```text
pending request
→ local one-time challenge
→ exact request/resource binding
→ APPROVE | DENY | ABSTAIN | REQUEST_CHANGES
→ encrypted rationale
→ immutable decision hash
```

`APPROVE` means that the human permits the scheduler to attempt the next
constitutional gate. It does not mean that the action is technically possible,
legally valid, safe, or already authorised by the owning component.

## Browser boundary

Kwan Browser may display the request and submit the decision code. It does not
generate the code and never receives the productive component lease. The local
challenge is created from the trusted KwanTau DOS side, for example through the
CLI.

## Known limitations

- a ten-digit local code is not phishing-resistant identity;
- UI integrity depends on the host and browser surface;
- the alpha does not provide multi-person approval, threshold signatures or
  hardware-backed confirmation;
- a rationale proves what was entered, not that the user understood every
  consequence.
