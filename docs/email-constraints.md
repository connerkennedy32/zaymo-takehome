# Email HTML Reference

## Layout

- Use **table-based layouts** only. `flexbox`, `grid`, and `float` are unreliable or broken across clients.
- Structure: nested `<table>` → `<tr>` → `<td>`. Every column is a `<td>`.
- Max content width: **600px**. Mobile responsiveness is handled with media queries or fluid tables.

## CSS

- **Inline CSS only** for anything critical. Gmail and others strip `<style>` blocks from `<head>`.
- `margin`, `padding`, `border` work on `<td>`, not on arbitrary `<div>`.
- No `position: absolute/fixed`, no `z-index`, limited `background-image` support.
- Web fonts (`@font-face`) only work in Apple Mail and a few others — always include system font fallbacks.
- `@media` queries belong in a `<style>` block in `<head>` (one of the few exceptions to the inline-only rule).

## Size Limits

- Gmail clips emails over **~102KB** with a "View entire message" link — hurts visibility and deliverability.
- Never embed images as base64. Host them externally.

## Images

- Always include `alt` text — many clients block images by default.
- Set `width` and `height` as HTML attributes on `<img>`, not just CSS, or layout breaks when images are blocked.
- `.gif` is widely supported for animation. CSS animation is not.

## Not Supported

| Feature | Status |
|---|---|
| JavaScript | Universally stripped |
| Video | Use GIF or a linked thumbnail |
| `<svg>` | Mostly broken |
| `<form>` / `<input>` | Often stripped |
| External stylesheets | Not supported |

---

## Key Terminology

**ESP** — Email Service Provider (Klaviyo, Mailchimp, Sendgrid, Braze, Iterable, HubSpot). Where marketers upload and send emails. They expect an HTML string to paste in.

**Merge tags / template variables** — ESP-specific personalization syntax. `{{first_name}}` in Klaviyo, `*|FNAME|*` in Mailchimp. Since the tool doesn't know the target ESP, output placeholder text instead.

**Preview text / preheader** — The gray text shown below the subject line in inbox previews. Implemented as a hidden `<span>` near the top of `<body>` (`display:none` or `font-size:0`). Marketers care about this a lot.

**Hero image** — Large banner image at the top of the email, usually below the logo.

**CTA** — Call to action. The button (e.g. "Shop Now"). Buttons are `<a>` tags styled as table-based buttons — not `<button>` elements.

**Above the fold** — Content visible before scrolling. Critical real estate.

**Deliverability** — Whether an email reaches the inbox vs. spam. Affected by HTML quality, file size, spam trigger words, and sender reputation.

**Transactional vs. Marketing email** — Transactional = triggered by user action (receipts, resets). Marketing = campaigns and promotions. This project is marketing email.

**Responsive / mobile-first** — Emails should stack to single-column on mobile. Achieved with `@media` queries or fluid/hybrid table layouts.

---

## Valid ESP-Pasteable HTML Skeleton

Output should be a complete, self-contained HTML document. Some ESPs strip `<html>`/`<head>` and use only `<body>` content — outputting the full document is safer.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title></title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscope></xml></noscript>
  <![endif]-->
  <style>
    /* Media queries only — this is the one acceptable place for non-inline CSS */
    @media only screen and (max-width: 600px) {
      .mobile-stack { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4;">

  <!-- Hidden preview text -->
  <span style="display:none;font-size:1px;color:#ffffff;max-height:0;overflow:hidden;mso-hide:all;">
    Your preview text here
  </span>

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding:20px 0;">

        <!-- Content table, max 600px -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"
               style="max-width:600px; background-color:#ffffff;">

          <!-- Example: Hero row -->
          <tr>
            <td align="center" style="padding:40px 30px;">
              <img src="https://example.com/hero.jpg" width="540" alt="Hero image"
                   style="display:block; max-width:100%; height:auto;">
            </td>
          </tr>

          <!-- Example: Text row -->
          <tr>
            <td style="padding:20px 30px; font-family:Arial,sans-serif; font-size:16px; color:#333333; line-height:1.5;">
              Body copy goes here.
            </td>
          </tr>

          <!-- Example: CTA button row -->
          <tr>
            <td align="center" style="padding:20px 30px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background-color:#000000; border-radius:4px;">
                    <a href="https://example.com" target="_blank"
                       style="display:inline-block; padding:14px 28px; font-family:Arial,sans-serif;
                              font-size:16px; font-weight:bold; color:#ffffff; text-decoration:none;">
                      Shop Now
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
```

### Required table attributes

Every `<table>` needs these to kill default browser/client styling:

```html
role="presentation"
cellspacing="0"
cellpadding="0"
border="0"
```

---

## AI Prompt Constraints

When prompting an LLM to generate email HTML, be explicit or it will output `<div>`/flexbox layouts. Key constraints to include in the system prompt:

- Table-based layouts only, no flexbox or grid
- All CSS must be inline (except `@media` queries in `<head>`)
- No JavaScript
- Max 600px content width
- Include hidden preview text `<span>` near top of `<body>`
- `role="presentation"` on all tables
- `alt` text on all images
- Buttons as `<a>` inside a styled `<td>`, not `<button>`
- Output must be under 102KB total
