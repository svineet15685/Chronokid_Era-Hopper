# Security Policy

## Reporting a vulnerability

Please report security issues privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue for security problems.

Include what you found, how to reproduce it, and the impact you expect. You should get a reply within 7 days.

## Scope

Chronokid is a browser game with a small API. The game runs in the browser, so scores and progress are client-controlled and are not cheat-proof; reports that only show a player can edit their own local game state are out of scope. Reports about the API, the database, dependencies, CI workflows, or leaked secrets are in scope.

## What the service stores

No email, passwords, real names, or analytics. Players get generated names (for example "Brave Otter 27") and a random token whose hash is stored; runs store score, era, and timing. See [docs/operations.md](docs/operations.md) for details, retention, and deleting a player.

## Supported versions

Only the latest `main` branch is supported.
