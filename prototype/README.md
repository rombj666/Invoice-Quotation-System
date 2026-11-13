# Hour Coffee – HTML prototype

`hour-coffee-quotation.html` is a single, self-contained page (no backend, no build step) that previews the customer flow:

1. **Quotation** – event details, date picker, packages, live pricing (same rules as `packages/shared/pricing`), and a printable quotation document with WhatsApp contact.
2. **Customization** – acknowledgements, event details, cart logo, cup sleeve, cup stickers, foam board, custom menu, and latte art / print pen, each with a live preview at real-life size.

Open the file in any modern browser. Template images are embedded, so it works offline.

## Notes

- Prototype only: nothing is saved to a server and nothing is sent. Uploads are kept in memory until the page is refreshed.
- One design is used for all event dates (no per-date designs).
- Low-resolution warnings appear below 100 DPI (cart, foam board) or 150 DPI (sticker, sleeve, menu, latte art).

### Sizing rules used in the prototype

| Item | Rule |
| --- | --- |
| Cart logo | Up to 87 cm wide × 63.5 cm tall on the front panel; proportions kept |
| Cup sticker | 1–4 cm tall, width capped at 6 cm; drawn to real cup size (hot 8 oz white: 80 mm top, 55 mm base, 90 mm tall; cold 12 oz: 95 mm top, 65 mm base, 88 mm tall; lids excluded) |
| Cup sleeve | Logo layers can be moved, resized (4–68 % of the sleeve width) and rotated |
| Foam board | Up to the full 60 × 90 cm board, shown in the A-frame stand |
| Custom menu | A4 (21 × 29.7 cm); artwork can be resized and moved |
| Latte art | Up to 5 cm wide × 3 cm tall on an 8 cm cup; optional 90° rotation; converted to black and white |

### Estimates to confirm

- Cup sleeve flat length (assumed ~25 cm) – affects the sleeve resolution check.
- Cup scale is measured from product photos (about ±5 %).
- Foam board stand rails are drawn at ~2 cm.
