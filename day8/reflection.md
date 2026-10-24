# Reflection

## The most difficult concept

The hardest idea for me was how a database stays correct when many people use it at the same moment: transactions, constraints and isolation. "Check the seat, then book it" sounded perfectly fine until I imagined two buyers doing it in the same instant. I overcame it by running small SQL examples and always asking, "What happens if two requests arrive together?" Once I could explain why one conditional `UPDATE`, wrapped in a transaction and backed by a `UNIQUE` constraint, is safer than checking first and saving later, the idea finally made sense.

## What I would improve in my capstone

Feedback on my capstone showed that I named the components of my design well, but did not always explain the problem each one solved or the new problem it created. I would improve this by giving every box in the architecture diagram one clear reason and one honest trade-off, as I tried to do in the TicketHub design. I would also test more error cases in my API client, so that the demo shows what happens when something goes wrong, not only when everything works.

## What I will learn next

Next I want to build a real backend with Node.js and Express, connected to a PostgreSQL database, so that the QuickNotes API design becomes working code. After that I will learn React to build larger, reusable front ends, which fits the front-end developer roles I am aiming for. I will keep practising the basics every week, because fluency comes from repetition.