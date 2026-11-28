import XCTest

/// Reads what iOS actually exposes to an assistive technology: the labelled
/// controls in the deck's accessibility tree. The Android equivalent
/// (`android-smoke.sh`) reads `uiautomator`'s tree; neither drives the screen
/// reader, and what VoiceOver says is still a manual pass
/// (`docs/reference/a11y-manual-script.md`).
///
/// Added to the generated project by `scripts/add-uitest-target.rb`, because
/// `expo prebuild` owns everything under `ios/`.
final class SmokeUITests: XCTestCase {
  func testDeckExposesLabelledControls() {
    let app = XCUIApplication()
    app.launch()

    // The deck is React Native behind an offline fixture: the controls exist only
    // once the JS bundle has run and the first card has been refilled.
    let ready = NSPredicate { _, _ in app.buttons.count >= 3 }
    expectation(for: ready, evaluatedWith: app)
    waitForExpectations(timeout: 180) { error in
      XCTAssertNil(error, "fewer than three buttons after 180s; tree:\n\(app.debugDescription)")
    }

    var labels: [String] = []
    for button in app.buttons.allElementsBoundByIndex {
      let label = button.label.trimmingCharacters(in: .whitespacesAndNewlines)
      XCTAssertFalse(
        label.isEmpty,
        "a control is exposed without a label; tree:\n\(app.debugDescription)"
      )
      labels.append(label)
    }

    print("Accessibility tree: deck reachable, \(labels.count) labelled controls:")
    for label in Set(labels).sorted() {
      print("- \(label)")
    }
  }
}
