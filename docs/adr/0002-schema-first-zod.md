# 0002: Schema-first TypeScript with Zod, exported as JSON Schema

**Status:** accepted

`Card`, `SwipeEvent` and `Profile` are defined once as Zod schemas in
`@swipeline/core` and the TypeScript types are inferred from them. Runtime
validation is needed anyway (sources are untrusted and manifests are shared as
data), and a single definition lets us publish JSON Schema for non-JS clients
and an OpenAPI document for the server without a second source of truth. The
alternative — hand-written types plus a separate validator — invites drift
between what compiles and what is accepted on the wire.
