# 0016 — Demo scenario on real dates

2026-10-18

The team decided the demo uses real dates and no demo clock. `seed-testing` runs before every Railway deploy and rebuilds the synthetic events (the demo event and the two test tournaments) around the current Toronto time. It refuses to rebuild an event that isn't flagged as a demo, so real AES, TIMU and MyTeam.click events are never touched.

A rebuild empties the event and loads it again through the CSV import pipeline. The event row and its event-wide role grants stay. Coach grants and account team choices are carried over by team name. Demo team and division ids are derived from the event, source and external ids, so follows saved on a device keep working after a redeploy.

Demo transitions are explicit CLI commands rather than a clock. `demo-playoffs` imports the simulated sources' playoff draw, so placeholders fill through the normal change feed. `demo-outage` makes a demo feed fail its refresh through the real sync path. `demo-reset` restores the scenario. The playoff draw is fixed data from the fictional source; the app still calculates no advancement (ADR 0002).
