# MotoLab Work/Codex Handoff Rules

## Mandatory self-contained handoff rule

Every task handed from ChatGPT to Work, Codex, or any separate execution environment MUST be fully self-contained.

Never assume the target environment can see or remember the source ChatGPT conversation history.

Before starting any handed-off task, verify that the handoff explicitly includes every task-critical item below:

- goal and expected outcome
- repository, branch/ref, and relevant files
- all rules, constraints, and prohibitions agreed in the source conversation
- baseline values and known comparison results
- exact definitions of any named tests, variants, A/B/C experiments, modes, or algorithms
- data locations, session IDs, user/device identifiers, and known missing data/chunks when relevant
- what may be changed and what must not be changed
- acceptance criteria and success/failure thresholds
- required verification steps and tests
- required final report/output, including commit SHA when code is changed

Do not use unresolved references such as "as discussed earlier", "use the previous rules", "continue from there", "A/B/C", or similar shorthand unless their full meaning is restated in the handoff.

If any essential context is missing or ambiguous, DO NOT begin the task. First obtain or reconstruct the missing context and make the handoff complete.

## Required handoff structure

Use this structure whenever practical:

CONTEXT -> RULES -> DATA -> TASK -> DO NOT -> ACCEPTANCE -> OUTPUT

## MotoLab safety against context loss

For MotoLab tasks, conversation-defined technical rules override assumptions. Do not invent missing definitions from repository history when the source conversation defined them separately. If a test or rule originated in ChatGPT discussion, its complete definition must be copied into the handoff before execution.
