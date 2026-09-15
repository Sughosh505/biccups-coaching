# Consultation intake webhook

How the consultation Google Form reaches the app. Set this up **at deployment**, pointing at the live
Vercel URL — the script cannot reach `localhost`.

- Endpoint: `POST https://<your-domain>/api/consultation-intake`
- Auth: the `x-webhook-secret` header must equal `CONSULTATION_WEBHOOK_SECRET`
- Route: [`src/app/api/consultation-intake/route.ts`](../src/app/api/consultation-intake/route.ts)

---

## 1. The payload

```jsonc
{
  "responseId": "2_ABaOnu...",       // e.response.getId() — the idempotency key
  "name":  "Priya Raghavan",
  "email": "priya@example.com",
  "phone": "+91 98842 20114",
  "fields": [                         // ORDERED, and the order is preserved
    { "section": "Basics", "q": "Age",          "a": "29" },
    { "section": "Basics", "q": "Height",       "a": "164 cm" },
    { "section": "Goals",  "q": "Primary goal", "a": "Fat loss" }
  ]
}
```

`fields` is an **array, not an object**. Postgres `jsonb` normalises object keys by length then
bytewise, so an object would render the coach's questions in an order unrelated to the form
(DESIGN.md D-9). `section` is the Form page break the question sits under, and may be null.

The route caps everything it stores: 64 KB body, 120 fields, and per-field length limits. Anything
over the cap is truncated or rejected — it treats the payload as untrusted, because the endpoint is
public.

## 2. Limits and responses

| Status | Meaning |
|---|---|
| `201` | Created |
| `200` | Already recorded — this `responseId` has been seen. Not an error; do not retry |
| `400` | Body was not JSON, or carried neither a name nor any answers |
| `401` | Missing or wrong `x-webhook-secret` |
| `413` | Body over 64 KB |
| `429` | Rate limited |
| `500` | Server-side failure — safe to retry |

Responses carry **no body**, deliberately: a message distinguishing "bad secret" from "bad payload"
helps someone probing the endpoint.

---

## 3. Set up the Apps Script

1. Open the consultation Form → **⋮ → Script editor**.
2. **Project Settings → Script properties → Add script property**:
   - `WEBHOOK_URL` = `https://<your-domain>/api/consultation-intake`
   - `WEBHOOK_SECRET` = the same value as `CONSULTATION_WEBHOOK_SECRET` in Vercel

   Script properties, **never** literals in the code below — anyone you give edit access to the Form
   can read the script body.
3. Paste `Code.gs` below.
3b. **Check the mapping against the real Form.** Run `logFormStructure` once (select it from the
    function dropdown → Run → **View → Logs**). It prints every section and question, and flags
    which ones will be treated as name/email/phone. If a `->` line is missing for any of the three,
    add that question's exact title to the matching list at the top of `Code.gs`.
4. **Triggers → Add trigger**: function `onFormSubmit`, event source *From form*, event type
   *On form submit*. Authorise it when prompted.
5. Submit a test response and confirm it appears at `/coach/consultations`.

### `Code.gs`

```javascript
/**
 * Consultation Form -> coaching CRM.
 * Sends each response with its Form section, so the review screen can group answers
 * the way the form asks them.
 */

// Question titles that map onto their own database columns rather than a form answer.
// Matching ignores case, spacing and punctuation, so 'Full Name' and 'full name:'
// both hit. Add your own wording here if the Form asks it differently.
var NAME_FIELDS  = ['Name', 'Full name', 'Your name'];
var EMAIL_FIELDS = ['Email', 'Email address', 'Email ID'];
var PHONE_FIELDS = [
  'Phone', 'Phone number', 'Mobile', 'Mobile number', 'Contact number',
  'WhatsApp number', 'Contact whatsapp number'
];

// Google Forms gives the FIRST section no page-break item, so questions before the
// first break have no section name of their own. They are the intake basics, so
// they get a label rather than falling into a generic bucket.
var FIRST_SECTION = 'Basics';

function onFormSubmit(e) {
  var props  = PropertiesService.getScriptProperties();
  var url    = props.getProperty('WEBHOOK_URL');
  var secret = props.getProperty('WEBHOOK_SECRET');

  if (!url || !secret) {
    throw new Error('Set WEBHOOK_URL and WEBHOOK_SECRET in Project Settings -> Script properties.');
  }

  var sections = sectionsByItemId_(e.source);
  var payload  = { responseId: e.response.getId(), fields: [] };

  e.response.getItemResponses().forEach(function (item) {
    var question = item.getItem().getTitle();
    var isUpload = item.getItem().getType() === FormApp.ItemType.FILE_UPLOAD;
    // A file-upload answer is a list of Drive file IDs, which are meaningless on
    // their own. Turn them into links the coach can actually open.
    var answer = isUpload
      ? driveLinks_(item.getResponse())
      : formatAnswer_(item.getResponse());
    if (!answer) return;

    if (matches_(question, NAME_FIELDS))  { payload.name  = answer; return; }
    if (matches_(question, EMAIL_FIELDS)) { payload.email = answer; return; }
    if (matches_(question, PHONE_FIELDS)) { payload.phone = answer; return; }

    payload.fields.push({
      section: sections[item.getItem().getId()] || null,
      q: question,
      a: answer
    });
  });

  // If the Form collects respondent emails itself, there is no email QUESTION to
  // match — take it from the response instead.
  if (!payload.email) {
    try { payload.email = e.response.getRespondentEmail() || undefined; } catch (err) {}
  }

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-webhook-secret': secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  // 200 means "already recorded" — a retry landing twice is expected and fine.
  if (code !== 201 && code !== 200) {
    throw new Error('Consultation webhook failed: ' + code);
  }
}

/**
 * Run this once by hand, before wiring the trigger. Prints the Form exactly as the
 * webhook will read it: the sections it will group by, and which questions it will
 * lift into name/email/phone instead of storing as answers.
 */
function logFormStructure() {
  var form = FormApp.getActiveForm();
  var current = FIRST_SECTION;
  var seen = { name: false, email: false, phone: false };
  var out = ['SECTION: ' + current + '   (no page break - labelled by FIRST_SECTION)'];

  form.getItems().forEach(function (item) {
    if (item.getType() === FormApp.ItemType.PAGE_BREAK) {
      current = item.getTitle();
      out.push('');
      out.push('SECTION: ' + current);
      return;
    }

    var title = item.getTitle();
    var tag = '';
    if (matches_(title, NAME_FIELDS))  { tag = '   -> name';  seen.name = true; }
    if (matches_(title, EMAIL_FIELDS)) { tag = '   -> email'; seen.email = true; }
    if (matches_(title, PHONE_FIELDS)) { tag = '   -> phone'; seen.phone = true; }
    out.push('  ' + title + tag);
  });

  out.push('');
  out.push('name  mapped: ' + seen.name);
  out.push('email mapped: ' + seen.email +
    (seen.email ? '' : '  (ok if Settings -> Collect email addresses is on)'));
  out.push('phone mapped: ' + seen.phone);

  Logger.log(out.join('\n'));
}

/** Compare titles ignoring case, spaces and punctuation: 'Full Name:' === 'full name'. */
function matches_(title, candidates) {
  var normalised = String(title).toLowerCase().replace(/[^a-z0-9]/g, '');
  return candidates.some(function (c) {
    return c.toLowerCase().replace(/[^a-z0-9]/g, '') === normalised;
  });
}

/**
 * Walk the Form in order. Every item after a PAGE_BREAK belongs to that page's
 * section until the next one. Items before the first page break have no section.
 */
function sectionsByItemId_(form) {
  var current = FIRST_SECTION;
  var map = {};

  form.getItems().forEach(function (item) {
    if (item.getType() === FormApp.ItemType.PAGE_BREAK) {
      current = item.getTitle();
    } else {
      map[item.getId()] = current;
    }
  });

  return map;
}

/**
 * File uploads land in the Form owner's Drive, and the response is the file IDs.
 * The coach owns those files, so a plain Drive link opens for them and for nobody
 * else — the permissions stay Google's problem, not ours.
 */
function driveLinks_(ids) {
  var list = Array.isArray(ids) ? ids : [ids];
  return list
    .filter(String)
    .map(function (id) { return 'https://drive.google.com/file/d/' + id + '/view'; })
    .join('\n');
}

/** Checkbox and grid answers come back as arrays (or arrays of arrays). */
function formatAnswer_(response) {
  if (Array.isArray(response)) {
    return response
      .map(function (part) { return Array.isArray(part) ? part.join(', ') : part; })
      .filter(String)
      .join(', ');
  }
  return String(response == null ? '' : response).trim();
}
```

---

## 4. Testing it without the Form

From Git Bash, with `npm run dev` running:

```bash
SECRET=$(grep '^CONSULTATION_WEBHOOK_SECRET=' .env.local | cut -d= -f2-)

curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/consultation-intake \
  -H "content-type: application/json" -H "x-webhook-secret: $SECRET" \
  -d '{"responseId":"manual-1","name":"Curl Test","email":"c@example.com",
       "fields":[{"section":"Basics","q":"Age","a":"29"}]}'
```

`scripts/verify-rls.mjs` checks 33-37 exercise the same route adversarially — no secret, a wrong
secret of the same length, an oversized body, a valid submission and a replay.

## 5. If submissions stop arriving

Apps Script failures are silent to the coach. Check **Executions** in the script editor first; a
throw there is what a non-2xx response becomes. Then confirm the Vercel env var and the script
property still match — rotating one without the other returns `401` on every submission.

### Recovering the submissions you already missed

Fixing the trigger does **not** backfill anything: the Apps Script only fires on new submits, and
re-running `onFormSubmit` by hand needs an event object it has no way to rebuild. Submissions made
while the webhook was down never arrive.

Put them in by hand instead — **Consultations → Add consultation** — copying the answers from the
Form's own response view or the linked Sheet. A hand-added record is the same shape as a delivered
one and renders identically; the review screen marks it `Added by hand` rather than
`From the consultation form`, and it carries no `form_response_id`.

**Do not** try to give it the real Google response id. There is nowhere in the UI to set one, and for
good reason: if the webhook later delivered that same submission the insert would collide, and the
route turns a collision into a silent `200` because a retrying Apps Script must not create the person
twice. The real submission would be dropped with nothing anywhere saying so.

Set **Submitted on** to the date they actually filled the form, not today — the review screen's
pipeline dates its first step from it.
