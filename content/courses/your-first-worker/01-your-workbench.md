---
# sources (checked 2026-11-03):
# - Node.js, Download (Node 24 is the LTS line; it ships Corepack) https://nodejs.org/en/download
# - pnpm, Installation, "Using Corepack" https://pnpm.io/installation
# - Klippy a-01 (.node-version 24; recorded output docs/outputs/a-01.txt, 2026-11-03, Linux, Node v24.22.2)
title: "Your workbench"
order: 1
minutes: 12
xp: 40
module: Set up
device: desk
verified: 2026-11-03
versions:
  node: "24.22.2"
  pnpm: "10.34.9"
---

You're going to build **Klippy**, a small assistant that lives on the
internet. It answers questions with Claude, and over the next courses it
gets tools, a memory and a face. This lesson gets your machine ready. It
takes about ten minutes, and you only do it once.

You need four things: a **terminal**, an **editor**, **Node** and **pnpm**.
Here's what each one is for.

### A terminal

A terminal is a window where you type commands instead of clicking. Every
build step in these courses is a command you type there. On a Mac it's the
**Terminal** app. On Windows, use **Windows Terminal** with WSL (Ubuntu),
so the commands here work as written. On Linux you already have one.

When a lesson shows a command, type it and press Enter. Lines that start
with `$` in recorded output are commands; the lines under them are what came
back. Don't type the `$`.

### An editor

You'll read and change code in an editor. Any will do. If you don't have
one, install **VS Code**: it's free, and its built-in terminal (View →
Terminal) means you can keep code and commands in one window.

### Node: the runtime

Klippy is written in TypeScript, which is JavaScript with types. Your
laptop needs a program to run JavaScript tools outside a browser. That
program is **Node**, a **runtime**. Install the **LTS** version (Node 24) from
nodejs.org. LTS means long-term support: the one that gets fixes for years.

Check it worked:

:::terminal{cmd="node -v"}
v24.22.2
:::

That's our recorded output. Any `v24.` number is fine. If you see
`command not found`, close the terminal, open a new one and try again: a
terminal only sees programs that were installed before it opened.

### pnpm: the package manager

Klippy uses other people's code, like Cloudflare's tools and the AI SDK.
They come as **packages**, and a **package manager** downloads them and
keeps their versions straight. We use **pnpm**: it's fast, and it handles a
repo with several apps in it well, which is how Klippy grows.

You don't install pnpm by hand. Node includes **Corepack**, a small helper
that fetches the exact pnpm version a project asks for. Switch it on once:

```sh
corepack enable
pnpm -v
```

:::terminal{cmd="pnpm -v"}
[muted]! Corepack is about to download https://registry.npmjs.org/pnpm/-/pnpm-10.34.9.tgz
10.34.9
:::

We ran `pnpm -v` inside a folder whose `package.json` pins pnpm 10.34.9, so
Corepack fetched that version first. That's the notice on the first line.
Outside a project you may see another 10.x number, and that's fine: from the
next lesson, Klippy's `package.json` pins the version for you.

If `corepack enable` says permission denied, your Node was installed for
all users. Run `sudo corepack enable` on Mac or Linux, or open the
terminal as administrator on Windows.

### Git

Each lesson ends at a **git tag** in Klippy's repository, so you can catch
up or compare if you get stuck. Check that git is there:

```sh
git --version
```

Any version prints a line like `git version 2.x`. If it isn't installed, a
Mac offers to install it the first time you run that command, and on Linux
or WSL it's `sudo apt install git`.

:::quiz{id="what-node-does" xp=20}
What does Node do for Klippy?

- [ ] It downloads the packages Klippy uses
  Not quite. That's the package manager's job, pnpm.
- [x] It runs JavaScript and TypeScript tools on your laptop, outside a browser
  Right. Node is the runtime. pnpm, wrangler and the tests all run on it.
- [ ] It hosts Klippy on the internet
  Not quite. Cloudflare does that, from lesson 5. Node only runs things on your machine.
:::

You're set up. In the next lesson you'll make Klippy's folder and your first
Worker.

:::rabbithole
- read "Download Node.js" by="Node.js" url="https://nodejs.org/en/download"
- read "Installing pnpm with Corepack" by="pnpm" url="https://pnpm.io/installation"
:::
