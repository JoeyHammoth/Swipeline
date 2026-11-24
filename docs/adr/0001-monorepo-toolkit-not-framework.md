# 0001: A monorepo of small packages, not a framework

**Status:** accepted

We ship a library-first toolkit as a pnpm-workspaces monorepo rather than an
opinionated framework or a single component library. The gap Swipeline fills is
the glue between a data source, a ranking pipeline and a swipe UI, and adopters
need those layers separately: one project only wants the event log and ranker,
another only wants `<swipe-deck>`. A framework would force stack choices and a
single package would force weight. The cost — more packages, slower releases,
stronger docs discipline — is paid deliberately, and §3.1 of the design plan
records the options that were rejected.
