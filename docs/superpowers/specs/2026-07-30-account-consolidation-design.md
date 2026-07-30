# Account Consolidation Design

## Problem

The database contains nine historical accounts, while `Leo Liu` is the intended
owner of the application. The historical `测试用户` account currently owns the
administrator role, and five retained resumes plus one position are distributed
across five legacy accounts. The current authentication policy therefore:

- requires an invite because the database is not empty;
- rejects a new `Leo Liu` registration because that account already exists;
- cannot recover access when the existing Leo password is unknown;
- risks deleting retained resumes if legacy users are deleted before ownership
  is transferred.

## Chosen approach

Run one explicit, transactional account-consolidation migration with `Leo Liu`
as the canonical account.

The migration will:

1. require exactly one case-insensitive `Leo Liu` account;
2. abort before changing data if moving positions would violate the
   `(user_id, url)` unique index;
3. move every resume, position, analysis, and follow-up bullet to Leo;
4. promote Leo to active administrator;
5. replace Leo's password with a generated temporary bcrypt password;
6. revoke every existing session;
7. delete every noncanonical user only after all owned business data has moved;
8. verify foreign keys and post-migration ownership before reporting success.

The live script will make a timestamped byte-for-byte database backup before
opening the database for mutation. The backup path and audit counts will be
printed after the transaction.

## Alternatives considered

### Keep all users and only reset Leo's password

This would restore login but leave the historical test administrator and
fragmented resume ownership in place. It does not solve the root data-model
problem.

### Delete all users and register again

Foreign-key cascades could delete the retained resumes and position. Restoring
ownership afterward would be less reliable than transferring it first.

### Transactional consolidation (selected)

This preserves every retained business record, leaves one unambiguous owner,
and makes the authentication bootstrap state consistent with the intended
product.

## Components

### `server/src/account-consolidation.js`

Exports:

- `buildAccountConsolidationPlan(db, canonicalDisplayName)` for read-only
  preflight and audit;
- `applyAccountConsolidation(db, options)` for the guarded transaction.

The module accepts an already-open SQLite database and a precomputed password
hash. It never generates or prints credentials.

### `server/scripts/consolidate-accounts.mjs`

Owns operational concerns:

- copies `app.db` to `server/data/backups`;
- generates a random temporary password;
- hashes the password with bcrypt;
- calls the reusable consolidation module;
- validates foreign keys and final counts;
- prints the temporary password once.

### `server/test/account-consolidation.test.mjs`

Uses in-memory SQLite fixtures to prove:

- all owned business records move before legacy users are deleted;
- sessions are revoked;
- Leo becomes the only active administrator with the supplied hash;
- invite codes remain untouched;
- ambiguous canonical users and conflicting position URLs abort without
  partial mutation.

## Data safety and rollback

- The backend must be stopped before the live migration.
- A nonempty backup is mandatory before mutation.
- All database writes occur inside `BEGIN IMMEDIATE` / `COMMIT`.
- Any exception causes `ROLLBACK`.
- The backend is restarted only after ownership counts and
  `PRAGMA foreign_key_check` pass.
- The original feature worktree and Git safety branch remain untouched.

## Success criteria

- exactly one user remains: `Leo Liu`;
- Leo is active and has role `admin`;
- all five resumes and the position remain and belong to Leo;
- no analyses or follow-up bullets are lost;
- all old sessions are removed;
- database foreign-key violations equal zero;
- login with the generated temporary password succeeds;
- the server still reports MiniMax configured and an actual MiniMax request
  completes successfully.
