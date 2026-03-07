---
description: Deep Refactor Workflow
---

# Deep Refactoring Workflow

**Purpose**: To systematically improve code quality, test coverage, and modularity for a specific feature, component, or the entire project. This workflow enforces a rigorous, multi-step process to ensure nothing breaks during structural changes, especially during "heavy-duty" refactoring involving architectural shifts.

## Prerequisites & Mindset
- **"If it ain't tested, it's broken"**: Do not simply move logic around blindly. Rely on tests.
- **Reference Core Skills**: Always keep the `/clean-code` and `/system-detective` skills in mind when analyzing and redesigning architecture.

## Step-by-Step Procedure

### 1. Deep Codebase Audit & Planning
- Thoroughly audit the target code for the following "code smells":
  - **DRY (Don't Repeat Yourself)**: Generalize duplicate logic (e.g., via Dispatchers or Hooks).
  - **SOLID Principle Violations**: Especially Single Responsibility Principle (SRP) violations, bloated classes/functions, and tight coupling.
  - **Architectural Boundary Violations**: Domain logic mixed into UI components, or infrastructure layer operations hardcoded in the service layer.
  - **Magic Numbers, Hardcoding, and Type Loss**: Isolate constant classes and enforce strict schemas/interfaces (TypeScript / Pydantic).
  - **Async/Concurrency Anti-patterns**: Race conditions, blocking via synchronous Awaits, and flaky Timeout handling.
- Compile the analysis results and proposed fixes into an artifact like `implementation_plan.md` and **await User approval unconditionally**.

### 2. Pre-Refactor Test Coverage (Building the Defense Line)
- Reinforce tests for existing features to withstand large-scale structural changes.
- Ensure that tests exist that guarantee *Behavior* rather than just validating isolated methods.
- If the tests themselves have flaky issues (e.g., incorrect Mocks or timing-dependent `asyncio.sleep`), fix them first. **Do not alter the code structure without this step.**

### 3. Incremental Implementation (with Active Guardrails)
- Based on the approved plan, do not destroy everything at once. Implement changes incrementally in meaningful chunks (by module or layer).
- **Run associated tests after EACH incremental change** to catch regressions immediately.
  1. Isolate constants and enforce strict type definitions.
  2. Abstract common logic into helpers/utilities.
  3. Replace and separate core logic.
  4. Finally, wire up the UI layer or router layer.

### 4. Full Automated Verification (The Ultimate Safeguard)
- **Run the ENTIRE project test suite** (e.g., `pytest` on the root directory) to confirm there is zero functional regression across the whole system. Do not skip any files.
- Crush any remaining errors reported by compilers or Linters (TypeScript / Mypy, etc.).

### 5. Quality Gate: Startup & UI Verification
- Follow the `/startup-check` skill procedure to launch both the backend and frontend, ensuring no fatal errors appear in the logs.
- After self-verifying that backend initialization (e.g., EventSub, DB connections) and initial UI rendering pass normally, prompt the User to perform a final visual check of the UI.

### 6. Atomic Commits via `/git-commit-craft`
- Refactoring often incurs large diffs. Strictly follow the `/git-commit-craft` policy to generate incremental, logically grouped commits (e.g., "split UI," "generalize logic," "fix tests") making them easy to review as Atomic Commits.
