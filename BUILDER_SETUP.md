# Getting set up to build the Brink website with Claude

A one-time setup guide for anyone who wants to make bigger changes to the
website (new pages, new sections, layout or design) using Claude. It is written
for people who have never touched GitHub before. The first time takes roughly
20 to 30 minutes; after that you just open the project and go.

> **Note:** for small content edits (changing wording, swapping an image,
> adding a blog post, updating a bio) you do not need any of this. There is a
> simpler web-based editor for that; ask Rob. This guide is only for the bigger,
> build-it-from-scratch changes.

## The big picture (30 seconds)

The website's code lives in one place online, on a service called **GitHub**.
To make a change, you use a tool called **Claude Code** on your own computer. It
works on a copy of the site's files, shows you a live preview as it goes, and
when you are happy it publishes your change back, which updates the live site
automatically.

You do not need to know how to code. You describe what you want in plain
English and Claude writes it. And you cannot break anything permanently: every
version is saved, so there is always a way back.

## What you will need

1. A **GitHub account** (free).
2. **Access to the site** on GitHub (someone grants this; see step 2 below).
3. A **Claude account** that includes Claude Code (a paid plan; check whether
   Brink provides one for you).

## One-time setup

**1. Create a GitHub account.**
Go to [github.com](https://github.com) and sign up. It is free, and you can pick
any username. If you already have an account, skip this.

**2. Get access to the site.**
Send your GitHub **username** to whoever manages the site (currently Rob). They
will add you, and GitHub will email you an invitation. Click the link in that
email to accept. Nothing else will work until you have done this.

**3. Get Claude Code.**
Make sure you have a Claude account on a plan that includes Claude Code (ask Rob
if you are not sure whether Brink covers it), and install Claude Code. You can
find it through your Claude account at [claude.ai/code](https://claude.ai/code),
or as a desktop app for Mac and Windows.

**4. Put a copy of the site on your computer.**
This is called "cloning". The easiest way is to open Claude Code and ask it, in
plain English:

> "Clone the GitHub repository hellobrink/brink-website into a folder on my
> computer, then set it up so I can preview it."

Claude will download the files and run the one setup step that is needed. (If
you would rather use a button than type a request, the free
[GitHub Desktop](https://desktop.github.com) app has a "Clone" option that does
the same thing.)

That is the setup done. Next time, you just open that folder in Claude Code.

## Making a change (the day-to-day bit)

1. Open the project in Claude Code.
2. Tell it what you want, for example: *"Add a page about our new programme,
   with a headline image and three columns."* No jargon needed.
3. Claude builds it and shows you a preview. Ask for tweaks until it looks right.
4. When you are happy, ask it to **publish**. Your change appears on the live
   site a minute or two later.

## A few good habits

- **Start fresh each time.** Ask Claude to "pull the latest" before you begin,
  so you are working on the current version of the site.
- **One change at a time** is much easier to review than ten at once.
- **Planning something bigger or structural?** Give Rob a heads-up first, so two
  people are not reshaping the same thing at the same time.
- **Stuck?** Ask Rob, or simply describe the problem to Claude. It is usually
  happy to explain what is going on.

Welcome aboard.
