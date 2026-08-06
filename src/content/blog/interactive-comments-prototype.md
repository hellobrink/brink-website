---
title: "Reading in the margins: a prototype"
subheading: A working demo of paragraph-level comments. Hover any paragraph and leave a note.
summary: Prototype of the interactive, annotatable blog post format.
date: 2026-08-06
authorName: Brink
interactive: true
unlisted: true
shareLinkedIn: false
contactAuthor: false
sortOrder: 0
---

This is a prototype of an interactive post. Hover over any paragraph and a small marker appears in the right-hand margin. Click it to open the comments panel, add a note, and leave your name. Once a paragraph has comments, the marker shows a count so other readers can see where the conversation is happening.

The idea borrows from the way people actually read together. A good piece of writing rarely lands the same way for everyone, and the most interesting response is often not a like or a share but a question in the margin. Comment threads at the bottom of an article flatten all of that into one undifferentiated pile. Anchoring a comment to the exact paragraph that prompted it keeps the thought where it belongs.

Notice that you do not have to register. The first time you comment, you add your name, and it is remembered for the rest of your visit through a small cookie. You can change it whenever you like. There is no account, no password, and no email to hand over before you can join in.

Try replying to your own comment to see how threads nest. A reply sits underneath the comment it answers, indented and marked, so a back-and-forth reads as a conversation rather than a list. Keep replies to a single level for now, which is usually enough to follow who is answering whom.

In this prototype the comments are saved only in your own browser, so nobody else can see them yet. That is deliberate. Before building the shared database that lets everyone see everyone else's notes, it is worth proving that the reading and writing experience itself feels right. If the marker, the panel, and the threading work here, wiring them to a real backend is the straightforward part.

Moderation is built into the plan from the start rather than bolted on later. Because anyone can comment without an account, an open comment box will attract spam, so a small moderation view lets an editor remove anything that should not be there. You can preview that behaviour by adding <code>?moderate</code> to the end of this page's address, which reveals a delete control on each comment.

Have a go. Leave a comment on this paragraph, reply to it, refresh the page to confirm it persists, and picture the same thing working across every reader once the shared backend is in place. That is the whole feature in miniature.
