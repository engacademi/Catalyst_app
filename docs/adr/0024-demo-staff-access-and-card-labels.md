# Demo staff access and card labels

The staff dashboard loads events from the authenticated user's database role grants. Seeded demo data and a Staff account preference do not grant a real Clerk account permission. Keep that boundary: do not display privileged data to every signed-in user or infer authorization from an editable profile.

Add `python -m app.cli grant-demo-staff --email <verified-demo-email>` as a one-time operator command. It resolves exactly one verified email through Clerk using the existing server-side secret, then grants event-scoped staff permissions only to synthetic events. Repeated calls reuse existing grants, re-enable expired staff grants, and refuse disabled database accounts. No public endpoint, global administrator grant, hardcoded user email or recurring deployment hook is added. Demo reseeding preserves event-wide grants.

The operations read-back must confirm the same events are returned by `admin_events` for that account. Production access must not be reported as fixed until the one-time operation has run and its result is verified.

Remove the Demo data badge from public event tiles while retaining the synthetic data flag and existing event titles. Hide the redundant delay-notice change badge on match cards, retaining the actual delay duration and See alerts link. Updates and match history still contain the underlying notice and provenance.
