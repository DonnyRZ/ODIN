# ODIN – an AI assistant for powerpoint creation – MVP

## 1. Empathize

**Who the user is:**

- Founders, product managers, marketers, or solo consultants who build their own pitch
  decks, sales slides, or internal presentations.
- They already have their own templates in Google Slides, PowerPoint, Canva, or Figma.
- They are NOT looking for someone to generate the entire deck — they want full control
  over layout, fonts, and structure.
- They spend 10–60 minutes per slide hunting for the “perfect” icon, illustration, or
  infographic that:
  o Matches the exact meaning of the text
  o Fits the empty space perfectly (no stretching, no weird white bars)
  o Matches the deck’s color palette and style (minimalist, 3D, flat, corporate blue,
  etc.)
- Current options suck:
  o Stock icon sites → endless scrolling, wrong style, wrong aspect ratio
  o Asking a designer → takes hours or days + costs money
  o General AI image tools (Imagen, Midjourney, Gemini) → wrong size, wrong
  vibe, burn through credits, still need manual cropping/resizing
- Result: frustration, wasted time, and slides that look “meh” instead of sharp.

**Key quotes from you that capture the feeling:**

- “I end up exhausting all the limits... and it still didn’t do a good job.”
- “It’s actually hard to find the image or icons... it took time and it’s not efficient.”

- “Even if people haven’t tried it, they’ll think ‘I can just do it with other tools’... but it’s
  actually not that easy.”
- “I need it to perfectly fill the space — not landscape when the spot is portrait.”

## 2. Define

**Primary problem to solve:** People who already own their slide templates waste hours
searching, generating, and manually resizing visuals that perfectly match both the content and
the exact empty space on each slide — because no tool today understands context + precise
dimensions + brand style in one simple flow.

## 3. Feature Spec

**Exact MVP Scope (what ships first, nothing else):**

1. **Home Screen**
   o Clean, calm interface
   o Big hero button:
   ▪ + New from screenshot ← this is the main purple hero button
   ▪ + New from text only ← new secondary button
   o Below it: Recent Projects grid (auto-saved in browser)
   ▪ Each card shows:
   ✓ Thumbnail of the last uploaded slide
   ✓ Project name (auto: “Pitch Deck – Dec 2025” or custom rename)
   ✓ Date / time of last edit
   ✓ Number of visuals generated (e.g., “12 visuals”)
   ▪ Click any card → instantly jumps into that project with full history
   loaded
   o Top-right corner:

```
▪ “Start blank project” (quick way if no screenshot yet)
▪ “View all history” (opens the full History Panel across all projects)
```

2. **Landing & Upload**

```
o Clean one-page workspace
o Big drop zone: “Drag your slide screenshot here” (also supports click-to-upload)
o Accepts PNG/JPG (full slide screenshot only – no PDFs or links yet)
```

3. **Slide Preview**

```
o Uploaded screenshot appears full-screen in the center
o Light zoom/pan so user can see details
```

4. **Draw the Empty Area**

```
o One button: “Draw the area you want to fill”
o User clicks and drags a rectangle (lasso) over the exact empty spot
o ODIN instantly shows the pixel dimensions + aspect ratio in the corner
o ODIN auto-snaps to square or 16:9 if it’s within ~5% tolerance (with a tiny
badge “snapped to square”)
```

5. **Text Input**

```
o Simple text box below: “What does this slide say? (paste title + body text)”
o Optional, but strongly encouraged (if empty, ODIN still works from visual style
only)
```

6. **Color & Style Detection (automatic, no user work)**

```
o ODIN extracts dominant colors + detects if the deck looks flat/minimal (99% of
corporate decks)
o Locks style to flat/minimal only (no 3D, no gradients, no illustrations yet)
```

7. **Generate Button**

```
o Big button: “Generate 3 perfect-fit visuals”
o Takes 4-8 seconds
o Shows exactly 3 variations side-by-side, each exactly the size & ratio of the
drawn rectangle
o Transparent background PNGs
```

8. **Instant Use**
   o Hover any variation → two huge buttons appear:
   ▪ “Download PNG”
   ▪ “Copy to Clipboard” (one-click, ready for Ctrl+V into Google Slides /
   Canva / PowerPoint)
   o Tiny toast confirmation “Copied! Paste it now →”
9. **History Panel**
   o Right sidebar (collapsible)
   o Shows every generation from this browser session + last 50 from localStorage
   o Click any past image → copy/download again instantly
   o “This Session” and “Previous” tabs

**Tech constraints for MVP (keeps it fast & cheap)**

- Only two ratios enforced: square & 16:
- Only flat/minimal style (fine-tune Flux.1-schnell or SDXL on icon datasets)
- Masking + inpainting trick to force exact crop size every time
- Everything runs client-side where possible or on cheap GPU API (RunPod / Replicate)

**Exact User Flow (30-second version)**

1. Open odin.ai
2. Home screen

3. Drag today’s slide screenshot
4. Click+drag over the empty right side (2 seconds)
5. Paste the bullet points (or skip)
6. Hit Generate → 3 perfect options appear
7. Click “Copy” on the one you love → switch tab → Ctrl+V → done.

## 4. Other Features (needed to be implemented before selling)

1. **Persistence and Data Handling**
   a. Cloud database
   b. Login feature
   Add Basic Login: Optional Google/Email sign-in for cloud history sync
2. **Error Handling and Robustness**
   If the the input is:
   a. Failed input
   b. Generation errors (e.g., API timeout)
   c. Bas screenshot (blurry/low-res)
   Add a graceful fallbacks like "Try again" buttons or progress indicators. Error States:
   Include loaders during generation, retry buttons, and messages like "Screenshot too
   blurry—try again?"
3. **Mobile/Responsive Design**
   Mobile Optimization: Make draw tool touch-friendly; responsive layout.
   **4. Payment Gateway**
   Needs a way for customers to pay for the app, an through something like PayPal or
   even Crypto payment.
