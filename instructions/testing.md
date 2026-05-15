## Run a single e2e test (only the one you're working on)

- `bun run playwright test e2e/data-editor.test.ts -g "Name of current test"`

Tests should NEVER test visual changes, e.g asserting a position or something like that. They have to test functionality.
Use the data-editor.test.ts as a guidline for how to write test files.
Focus on writing tests that test the outcome of the action. E.g when creating something new make sure it now shows up in the overview.
Write simple and straightforward test code.
When writing tests use an iterative red-green testing approach. That means the test should first fail and then pass.
So you should ALWAYS run the test make it fail, update the test code, then run the test again to make it pass.
Keep building up the test in this fail/pass loop until the final test is implemented.
NEVER change non test code when writing a test. If a test fails because of an error of the application code report that immedieately. Do not try to fix the application code
Focus on the red-green testing loop.
