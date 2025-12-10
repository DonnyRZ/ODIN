# ODIN – AI Visual Assistant for Slides

ODIN helps slide builders fill empty spaces in their decks with contextual, perfectly sized visuals.

## Current Scope
- Documentation: `ODIN.md`, `TECH_STACK.md`, `DESIGN_RULES.md`.
- Legacy static mockups in `UI TEST/` for reference.
- **New Next.js app** in `web/` containing the home page and workspace placeholder built with TypeScript + Tailwind.

## Getting Started
The `web/` directory is a standard Next.js project.

```bash
cd web
npm install    # install deps (requires Node.js)
npm run dev    # start local dev server
```

> Note: Node.js isn’t available in this environment, so run the commands locally after cloning.

## Next Steps
1. Flesh out the workspace UI (control panel, canvas, results) inside the Next app.
2. Integrate persistence/history and any supporting APIs.
3. Connect the AI generation backend once UX is finalized.

## Contributing
- Follow the design rules in `DESIGN_RULES.md` before modifying any mockup or UI implementation.
- Keep the `TECH_STACK.md` document up to date whenever we change architecture decisions.
- Commit documentation and mockup updates with clear descriptions so the product spec stays traceable.

## License
Proprietary – do not distribute without permission.
