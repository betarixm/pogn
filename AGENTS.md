# AGENTS.md

This document defines the permanent engineering principles of this repository.

All contributors and agents must follow this document.

---

## 1. Runtime & Tooling

- Runtime: Bun
- Testing: bun:test
- Do not assume npm or pnpm.

---

## 2. Core Principles

- Deterministic over magical
- Explicit over implicit
- Composition over inheritance
- Incremental over destructive
- Secure by default
- Strong typing everywhere
- Test-first mindset
- Consistency over cleverness

---

## 3. TypeScript Philosophy

- Strict mode enabled.
- No implicit `any`.
- Prefer `type` over `interface`.
- Use branded types for entity identifiers.
- All exported functions must have explicit return types.
- No abbreviations in identifiers.

---

## 4. Function Style

- Arrow functions are preferred.
- Avoid `function` declarations unless necessary.
- Avoid mixing styles arbitrarily.

---

## 5. React Component Rules

- Always extend native element props when wrapping HTML elements.
- Always extend wrapped component props.
- Do not use `React.FC`.
- Explicitly type props and return type.

---

## 6. Error Handling Model

- Exception-based control flow only.
- Domain errors must use typed error classes.
- Catch errors only at boundary layers.
- Do not use result-union patterns.
- Do not swallow errors silently.

---

## 7. Architectural Boundaries

- UI layer must not access database directly.
- Database access must go through typed query modules.
- Environment branching must be isolated to infrastructure layer.
- Attachments must not store binary data in relational database.

---

## 8. Data & Migration Discipline

- All migrations must be incremental.
- Never rewrite migration history.
- Never perform destructive schema changes in a single deploy.
- Prefer additive schema evolution.

---

## 9. Security Defaults

- Validate all input at boundary.
- Never trust client-provided content.
- Storage should be private by default.
- Minimize data exposure to UI.

---

## 10. Testing Philosophy

- Write unit tests aggressively.
- Prefer many small tests.
- Every bug fix must include a regression test.
- Tests must not depend on production infrastructure.
