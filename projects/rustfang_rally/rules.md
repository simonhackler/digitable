# Rustfang Rally

First prototype notes for a 2-player post-apocalyptic combat race.

## Core Shape

- 2 players, 20-30 minutes.
- First vehicle to reach the finish wins.
- Players race on a shared road track where position and range matter.
- Scrap is the only currency. Spend it to buy cards, install parts, repair parts, and fuel movement.
- Each vehicle has these part slots: Front, Rear, Left, Right, Engine, Weapon.
- Each vehicle also has a Crew row. Crew provide passive powers and may exhaust for actions.
- Installed parts have durability and can be destroyed by combat, crashes, and future event cards.

## Current Card Slice

This project starts with one aggressive raider set:

- 4 Crew cards.
- 6 Part cards, one for each slot.
- Cards use lean values: cost, card type, slot, durability, and one effect.

## Round Skeleton

1. Reveal an event. For this first card slice, use a simple placeholder event: each player gains 2 scrap, then the trailing vehicle gains 1 extra scrap.
2. Set turn order. The player who spends more scrap as fuel this round acts first. Ties go to the trailing vehicle.
3. In turn order, each player may buy 1 card from the market.
4. In turn order, each player may install 1 bought part or crew card by paying its cost again.
5. In turn order, each player may spend scrap as fuel. Each scrap spent gives 1 movement unless modified by installed cards.
6. In turn order, each player may make 1 attack if an installed card or crew effect allows it.
7. Ready exhausted crew and parts.

## Damage

- Damage is assigned to a specific installed part when an effect names a slot or facing.
- Reduce a part's durability by the damage dealt.
- When a part reaches 0 durability, discard it from the vehicle.
- Crew are not damage targets in this first slice.

## First Test Questions

- Does spending scrap as fuel create enough tension against buying and installing?
- Does the raider set pressure the opponent without creating an automatic snowball?
- Are fixed slots easy to understand in combat?
- Does the current placeholder event create enough pressure until the event deck is designed?
