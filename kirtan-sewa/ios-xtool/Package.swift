// swift-tools-version: 6.0

// Builds the Capacitor iOS app with xtool (https://github.com/xtool-org/xtool) so it can be
// installed on an iPhone from Linux, without a Mac or Xcode.app.
// The web app and its plugins come from ../ios (kept up to date by `npx cap sync ios`).

import PackageDescription

let package = Package(
    name: "KirtanSewa",
    platforms: [
        .iOS(.v15),
    ],
    products: [
        // xtool expects exactly one library product: the app itself.
        .library(
            name: "KirtanSewa",
            targets: ["KirtanSewa"]
        ),
    ],
    dependencies: [
        // Managed by the Capacitor CLI: pulls in Capacitor, Cordova and every installed plugin.
        .package(name: "CapApp-SPM", path: "../ios/App/CapApp-SPM"),
    ],
    targets: [
        .target(
            name: "KirtanSewa",
            dependencies: [
                .product(name: "CapApp-SPM", package: "CapApp-SPM"),
            ]
        ),
    ],
    swiftLanguageModes: [.v5]
)
