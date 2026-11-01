---
title: Setup editor
description: Reference for editing the table layout and setup rules.
---

The setup editor defines the starting table layout for a game. It edits the table SVG and the rules attached to table components and slots.

## Opens from

Open a game, then choose the table or setup editor.

## Files

- `setup/table.svg`: saved table layout
- `components/`: decks and cards that can be placed on the table
- `assets/`: images referenced by table and component SVGs

## Table editing

The main canvas is an SVG editor for the table. Use it to arrange the table background, placed components, and slot regions.

## Components

A component represents a deck or a single card placed on the table at the start of play.

Component settings include:

- **Label**: display name for the placed component
- **Shuffle at start**: shuffles a deck before the playtest starts
- **Cards in deck**: selects which cards are included in a placed deck

## Slots

A slot is a table region that can accept cards during play. Slot rules control what can be placed there and how initial contents are arranged.

Slot layout modes:

- **Free**: contents can be placed freely.
- **Horizontal flex**: contents are arranged in a horizontal row with an item count and spacing.
- **Grid**: contents are arranged by rows, columns, column spacing, and row spacing.

Slot settings include:

- **Initial contents**: decks or cards placed into the slot when play starts
- **Shuffle**: shuffles an initial deck before it is placed
- **Allowed decks**: decks accepted by the slot during play
- **Allowed cards**: individual cards accepted by the slot during play

## Saving

Changes are saved automatically to `setup/table.svg`.
