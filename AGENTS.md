# Agent Instructions

- Prefer existing shared UI primitives from `app/components/ui` whenever they
  fit the interaction. Use components such as `Button`, `Input`, `Textarea`,
  `Checkbox`, `Label`, `DropdownMenu`, `Tooltip`, and `StatusButton` instead of
  hand-writing equivalent controls or button-like links.
- For navigational links that should look or behave like buttons, use `Button`
  with `asChild` around `Link` or `a`.
- Only hand-code UI styling when no existing component covers the use case, or
  when the surrounding codebase already uses a specialized local pattern.
