# Astro Starter Kit: Basics

```sh
npm create astro@latest -- --template basics
```

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/withastro/astro/tree/latest/examples/basics)
[![Open with CodeSandbox](https://assets.codesandbox.io/github/button-edit-lime.svg)](https://codesandbox.io/p/sandbox/github/withastro/astro/tree/latest/examples/basics)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/withastro/astro?devcontainer_path=.devcontainer/basics/devcontainer.json)

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

![just-the-basics](https://github.com/withastro/astro/assets/2244813/a0a5533c-a856-4198-8470-2d67b1d7c554)

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src/
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## Project Route Notes

- `/visualize` supports query parameters:
  - `tab=map|timeline|charts` redirects to the corresponding visualization route.
  - `focus=<lynching-id>` is forwarded to the target route.
  - `year=<YYYY>` is forwarded to the target route.
  - `all=1` is forwarded to the target route.
- `/visualize/map` supports query parameters:
  - `focus=<lynching-id>` centers the map on that record when coordinates are available.
  - `all=1` jumps the timeline range end to 1915 immediately (show all markers without waiting).
- `/visualize/charts` stable anchors:
  - `#charts-top`
  - `#chart-01` … `#chart-11` (top-to-bottom chart order)
- `/visualize/compare` stable anchors:
  - `#compare-top`
  - `#compare-chart-01`
  - `#compare-chart-02`
  - `#compare-chart-03`
- Record template stable anchors (all `/records/:lynchingId` pages):
  - `#record-top`
  - `#record-metadata`
  - `#record-map`
  - `#record-narrative`
  - `#record-evidence` (when related articles are present)

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
