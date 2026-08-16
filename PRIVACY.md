# Privacy Policy — Ultra RSS Reader

Last updated: 2026-08-16

Ultra RSS Reader is a local-first desktop RSS reader. This policy describes what data the app handles and where it goes.

## Data stored on your device

- **Articles, feeds, and reading state** (read/starred status, search index) are stored in a local SQLite database on your machine. They are never uploaded to us.
- **Account credentials** for RSS sync services (such as a FreshRSS server you configure) are stored in your operating system's credential manager (macOS Keychain / Windows Credential Manager). They are only sent to the server you configure, for authentication.
- **Preferences** (theme, layout, shortcuts) are stored locally.

## Network access

- The app fetches RSS/Atom feeds and web pages from the URLs you subscribe to or open.
- Reader articles and thumbnails can automatically load remote images from publisher-controlled or other third-party hosts. Those hosts may receive your IP address, user agent, request timing, and the requested image URL.
- To display feed icons, the app requests favicons from Google's favicon service. The request includes the feed site's hostname; Google also receives the usual connection information, such as your IP address and user agent.
- If you connect a sync account, the app communicates directly with the server you specify (for example, your FreshRSS instance via the Google Reader API).
- The app checks GitHub Releases for application updates (direct-download builds only; Microsoft Store builds are updated through the Store).

## Crash reporting

The app uses [Sentry](https://sentry.io) to process crash reports and error diagnostics on our behalf. Reports can include an exception type, message, stack trace, and release environment. We disable Sentry's default collection of personal data and do not intentionally include your articles, feed URLs, or credentials.

## What we do not do

- We do not collect analytics or usage tracking.
- We do not sell your data or share it with third parties for their own marketing or analytics. Sentry processes the limited crash diagnostics described above as our service provider.
- We do not operate any server that receives your articles, subscriptions, or credentials.

## Contact

For questions or concerns, open an issue at
<https://github.com/jey3dayo/ultra-rss-reader/issues>.
