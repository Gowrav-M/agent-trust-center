# Evidence Schema

Agent Trust Center consumes `agent.trust.evidence.v1`.

```json
{
  "schemaVersion": "agent.trust.evidence.v1",
  "tool": { "name": "agent-skillguard", "version": "1.0.0" },
  "subject": { "type": "skill", "name": "code-reviewer" },
  "decision": "allow",
  "score": 0,
  "generatedAt": "2026-05-30T00:00:00.000Z",
  "findings": [],
  "artifacts": [],
  "recommendations": []
}
```

## Fields

- `tool`: producer of the evidence.
- `subject`: thing being evaluated. Types are `skill`, `endpoint`, `nim`, `mcp`, `runtime`, and `toolset`.
- `decision`: `allow`, `review`, or `block`.
- `score`: normalized risk score from `0` to `100`.
- `findings`: portable findings with severity, title, message, and optional source/recommendation.
- `artifacts`: local files that support the decision.
- `recommendations`: human-readable next actions.

The schema is intentionally small so each tool can keep its own detailed report while still feeding one enterprise gate.
