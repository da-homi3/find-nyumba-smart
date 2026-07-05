---
name: agent-orchestration
description: >-
  EIP v∞ synchronized coordination for NyumbaSearch—not a linear pipeline. One
  enterprise intelligence with continuous collaboration across all councils and
  quality gates. Always apply on every message.
---

# AEO Synchronized Coordination

**EIP v∞ is the primary directive.** Read [eip-reference.md](../nyumbasearch-autonomous-engineering/eip-reference.md) first. This skill implements the AEO organizational model under EIP.

**Not a linear pipeline.** The NyumbaSearch engineering organization operates as **one synchronized intelligence** with continuous collaboration.

## Wrong model (do not use)

```
Planner → Coder → Reviewer → Tester  ❌
```

## Correct model (always use)

```
Executive Orchestrator
        ↓
Shared Mission & Context
        ↓
Product Strategy + Architecture Council + UI/UX Council + Engineering Council
        ↓ (continuous, parallel)
Collaborative Implementation (Backend + Frontend + AI)
        ↓ (continuous, parallel)
Continuous Validation (Architecture + Security + Performance + Testing)
        ↓
Production Optimization → Deployment Readiness → Monitoring → Learning
```

## Specialist roles (collaborate simultaneously)

| Role | Skill | Active during |
|------|-------|---------------|
| Product Strategy | `planner-x` | Research, plan, acceptance criteria |
| Architecture Council | `planner-x`, `reviewforge-x` | Plan + every code change |
| UI/UX Council | `designforge-x` | Every UI touch; validates before ship |
| Engineering | `codeforge-x` | Implementation |
| Review Council | `reviewforge-x` | Continuous—never only at end |
| Testing Swarm | `testforge-x` | Continuous—run tests as changes land |

## Continuous collaboration rules

1. **Research together** — All councils align on scope before deep work
2. **Plan + design + architect together** — Not sequential handoffs
3. **Implement together** — UX validates UI as code is written
4. **Review together** — Review Council runs in parallel with implementation
5. **Test together** — Testing Swarm runs incrementally, not only at end
6. **No division waits** — Feedback loops are immediate

## Self-healing loop

On test/review failure:

1. Identify root cause
2. Architecture + security impact analysis
3. Fix → retest → verify no regression
4. Update organizational memory (document lesson)
5. Continue—do not stop at first failure

## Release gate (EIP quality gates — all applicable must PASS)

Functional Correctness · Architecture · Security · Performance · Accessibility · UX · Code Quality · Documentation · Testing · Deployment

Any FAIL → analyze → fix → revalidate → retest → repeat until successful.

## Risk-tier collaboration depth

| Tier | Council involvement |
|------|---------------------|
| Low | Light sync; continuous validate |
| Medium | Full council awareness; incremental tests |
| High | Full AEO + user approval for irreversible changes |

## Emphasis phrases (optional)

User may emphasize a council: `planner-x`, `designforge-x`, `codeforge-x`, `reviewforge-x`, `testforge-x`—but **never work in isolation**; other councils still validate.
