# Privacy Policy — Ultra RSS Reader

Last updated: 2026-08-16

Ultra RSS Reader is a local-first desktop RSS reader. This policy describes what data the app handles and where it goes.

## Data stored on your device

- **Articles, feeds, and reading state** (read/starred status, search index) are stored in a local SQLite database on your machine. They are never uploaded to us.
- **Account credentials** for RSS sync services (such as a FreshRSS server you configure) are stored in your operating system's credential manager (macOS Keychain / Windows Credential Manager). They are only sent to the server you configure, for authentication.
- **Preferences** (theme, layout, shortcuts) are stored locally.

## Network access

- The app fetches RSS/Atom feeds and web pages from the URLs you subscribe to or open.
- If you connect a sync account, the app communicates directly with the server you specify (for example, your FreshRSS instance via the Google Reader API).
- The app checks GitHub Releases for application updates (direct-download builds only; Microsoft Store builds are updated through the Store).

## Crash reporting

The app uses [Sentry](https://sentry.io) to collect crash reports and error diagnostics. These reports may include technical information such as OS version, app version, and stack traces. They do not intentionally include your articles, feed URLs, or credentials.

## What we do not do

- We do not collect analytics or usage tracking.
- We do not sell or share your data with third parties.
- We do not operate any server that receives your articles, subscriptions, or credentials.

## Contact

For questions or concerns, open an issue at
<https://github.com/jey3dayo/ultra-rss-reader/issues>.
