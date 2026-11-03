# Sacred Attempt — Android and iOS

Native Android (Java/WebView) and iOS (SwiftUI/WKWebView) applications for the existing tracker. These are installed applications, separate from the PWA. The tracker screens are the hosted web interface; this is not a rewrite of every screen in native UI.

## Architecture and scope

The website uses Next.js server actions, API routes, Prisma/TiDB and HTTP-only session cookies. It cannot simply be exported as static assets. Both apps load only `https://upsc-cse-tracker-adarsh.vercel.app` inside their authenticated web view. Existing server actions and cookies therefore continue to work on the original origin without storing passwords in the app, changing CORS or exposing a JavaScript/native bridge.

The native app adds a workspace menu, navigation/back handling, connection-failure recovery, a persisted device-local 25/50/90-minute focus timer and optional local completion notifications. Starting or finishing a timer does **not** claim study time or update the tracker database. Timer deadlines survive app restarts; alerts depend on OS permission and delivery policies. Android force-stop/reboot can cancel a pending alert. Device clock changes can alter countdowns.

No web application code, database schema, production configuration or user data is modified by this change. Reviewer invitations, report-data repairs and remote/native push delivery are separate backend work and are not implemented in these apps. The existing website has single-user authentication; giving someone these binaries does not grant a separate reviewer account.

## Get an Android test app

The **Android and iOS apps** GitHub Actions workflow builds an APK on relevant pull requests (and manually once the workflow is on the default branch). Open its successful run, download `sacred-attempt-android-test-apk`, unzip and install `app-debug.apk` on Android 8 or newer. It is a **debug-signed testing build**, not a Play Store release. Android may require permission for the specific app used to open the APK. Sign in with the existing tracker credentials inside the app; credentials are never bundled.

A new CI runner may generate a different debug signing key. If a subsequent test APK cannot update the previous test install, uninstall the old test app first (this clears local login/timer state). A release must use one securely retained owner signing key so updates preserve app data.

### Android local build

Install JDK 17, Android SDK platform 36 and Gradle 8.13. Set `ANDROID_HOME` or `mobile/android/local.properties` to the SDK location. Then:

```sh
cd mobile/android
gradle assembleDebug lintDebug
```

Use `gradle assembleRelease bundleRelease` for release outputs. Signing uses `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`, provided through your local environment or protected CI secrets. Without them, release output is unsigned. Never commit signing files or passwords. Play publication is a separate owner-authorized step.

## iPhone build and installation

On a Mac with Xcode and XcodeGen installed:

```sh
python3 mobile/ios/prepare-icons.py
cd mobile/ios
xcodegen generate
open SacredAttempt.xcodeproj
```

Select your Apple development team under Signing & Capabilities, choose a connected iPhone, and run. The bundle ID defaults to `com.adarsh.upsc`; change it if your team requires a different identifier. For TestFlight, configure your Apple Developer/App Store Connect account and archive a signed Release build in Xcode. No Apple credentials, certificates, provisioning profiles, paid membership or TestFlight upload are supplied by this repository.

CI compiles an **unsigned device app**, runs navigation policy tests in an iPhone simulator and uploads the **simulator app**. That simulator artifact **cannot be installed on an iPhone**. A signed TestFlight/device build is still required. TestFlight is beta distribution, not a permanent public release.

## Behaviour and limits to verify on real devices

- Login, session expiry and sign-out use the existing server. First login requires internet.
- Native focus works offline. The website's service worker/offline queue is preserved where supported, but full offline website availability is **not guaranteed**, particularly in WKWebView.
- External HTTPS links require confirmation and open in the system browser. HTTP, custom schemes and credential-bearing destinations are blocked. No embedded credential is shared with the browser.
- Web push from the PWA is not equivalent to native push. This release schedules only local timer-completion alerts. Server-originated reminders and accountability alerts need APNs/FCM registration and backend delivery in a later change.
- Android file inputs use the system document picker. iOS file selection follows WebKit defaults. Downloads that cannot be displayed direct the user to sign in in the system browser; authenticated download/export handling is not yet implemented natively.
- Passwords and cookies are not read by native code. No unsafe TLS bypass, cleartext traffic allowance or JavaScript/native command bridge is included. Android backup is disabled. Local WebView storage follows OS defaults.
- The privacy manifest documents native UserDefaults usage. App Store privacy disclosures must also account for all data the hosted website and its AI providers process; the native manifest is not a complete store privacy declaration.
- Store approval is not guaranteed. Review minimum-functionality requirements, supply a legitimate review account, complete privacy/support information and test accessibility before submission.

## Release acceptance checklist

- Sign in, save a sample entry in a test account, relaunch and verify it once; ensure sign-out really prevents access.
- Open goals, tests, report cards, Guru and syllabus screens. Check text scaling, keyboard, rotation, tablet layout and back navigation.
- Background/lock/reopen during a timer and verify its deadline. Test permission allowed/denied and timer replacement/cancellation.
- Test poor connectivity, TLS failures, session expiry, external links and file selection. Never assume a failed submission was saved.
- Verify native notifications on physical devices. Simulator/compiler success is not a real-device UI test.
- Fix the pre-existing report/viva discrepancies before using reports for third-party accountability.
