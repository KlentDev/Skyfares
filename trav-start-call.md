# Travel Strategy Call — How It Works

A simple walkthrough of what happens from the moment someone pays $99 to the moment they show up for their call.

```mermaid
flowchart TD
    A["Customer pays $99
    (credited back in full if they
    book a flight with us in 30 days)"] --> B["Beehiiv sends an automated
    email with the booking link"]
    B --> C["Customer books a call
    via Cal.com"]
    C --> D["Booking is stored
    in Airtable"]
    D --> E["Airtable fires a
    confirmation to the customer"]
    D -.deferred, future feature.-> F["Airtable notifies Sahej
    on WhatsApp"]
    E --> G["Done — wait for
    the scheduled call"]

    classDef done fill:#d1fae5,stroke:#059669,color:#064e3b;
    classDef pending fill:#fef3c7,stroke:#d97706,color:#78350f;
    class A,B,C,D,E,G done;
    class F pending;
```

## What each step means

1. **Pays $99** — one-time payment. If they end up booking a real flight with us within 30 days, that $99 is credited toward it — not lost.
2. **Automated email** — Beehiiv sends this right after payment, with the button to book a slot.
3. **Books a call** — customer picks a time on Cal.com.
4. **Stored in Airtable** — the booking lands in our records automatically.
5. **Confirmation to customer** — Airtable fires this off, no manual step needed.
6. **Admin WhatsApp notification** — not built yet, on purpose. A future feature: Sahej gets pinged on WhatsApp the moment someone books, instead of checking the calendar himself.
7. **Done** — nothing more needed until the scheduled call.
