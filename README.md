# Boulder Budget Atlas — how to put it online

This folder is the whole website. It has two parts:

- **The site** (`site/index.html`): the map, issues, entities, About page and Ask tab.
- **The assistant's server** (`netlify/functions/ask.mjs`): a small program that holds your Claude API key and answers questions from the Ask tab, so visitors don't need a Claude account.

The assistant answers from two things: the atlas data (entities, line items, issues) and the source notes in `knowledge/sources.md`. It isn't retrained; it reads all of that material every time someone asks a question. To teach it something new, add notes to that file.

You'll set up three free accounts. Plan on 30–60 minutes the first time.

---

## Step 1. Get a Claude API key (this is what you pay for)

1. Go to **platform.claude.com** and create an account.
2. Add a payment method under **Billing**, and buy a small amount of credit to start (for example $20).
3. Under **Limits**, set a **monthly spend limit** you're comfortable with. This caps your cost even if the site gets heavy traffic.
4. Under **API Keys**, choose **Create Key**, name it "Budget Atlas", and copy it. Keep it private; anyone with it can spend your credit.

Rough cost: each question costs about one to three cents with the default model.

## Step 2. Put the files on GitHub

1. Create a free account at **github.com**.
2. Click **+** (top right) → **New repository**. Name it `boulder-budget-atlas`. Choose **Public** or **Private** (either works). Click **Create repository**.
3. On the next page, click **uploading an existing file**.
4. Unzip the folder I sent you. Open it, select **everything inside it** (the `site`, `netlify`, `knowledge` and `scripts` folders plus `netlify.toml` and this README), and drag it all into the GitHub page.
5. Click **Commit changes**.

## Step 3. Publish with Netlify

1. Go to **netlify.com** and sign up using **Continue with GitHub**.
2. Click **Add new site** → **Import an existing project** → **GitHub**, and pick `boulder-budget-atlas`.
3. Netlify reads the settings from `netlify.toml`. Leave everything as it is and click **Deploy**.
4. When it finishes, go to **Site configuration** → **Environment variables** → **Add a variable**:
   - Key: `ANTHROPIC_API_KEY`
   - Value: the key from Step 1
5. Go to **Deploys** → **Trigger deploy** → **Deploy site** so the assistant picks up the key.

Your site is live at an address like `boulder-budget-atlas.netlify.app`. Open it, go to **Ask**, and try a question.

## Step 4 (optional). Use your own web address

Buy a domain (for example from Namecheap or Cloudflare), then in Netlify go to **Domain management** → **Add a domain** and follow the prompts. Netlify adds the secure https certificate for you.

---

## Making changes later

Every time you change a file on GitHub, Netlify rebuilds the site within a minute or two.

- **Teach the assistant something new:** on GitHub, open `knowledge/sources.md`, click the pencil icon, add a section (source name, link, then factual bullet points), and commit. You can also add more `.md` files in the `knowledge` folder.
- **Add your contact email to the About page:** open `scripts/atlas-source.html`, find `const CONTACT='';`, put your address between the quotes, and commit.
- **Change the map's data** (entities, line items, issues): these live in `scripts/atlas-source.html`. Ask Claude to make the edit and send you the updated file, then upload it to the same place on GitHub.

## If something goes wrong

- **The site shows a black "Error – Request ID" page:** check Netlify → **Logs** → **Functions** → `ask` for the error, and make sure every file from the latest zip is at the top level of the repository (you should see `netlify.toml` on the repository's main page).

- **Ask says the assistant isn't connected:** the API key is missing. Repeat Step 3, parts 4 and 5.
- **Ask says it's getting a lot of questions:** either one visitor hit the limit (20 questions per 10 minutes) or your Claude account reached its spend limit. Check Billing at platform.claude.com.
- **To change the model:** add an environment variable `ATLAS_MODEL` (for example `claude-haiku-5-5` for a cheaper, faster assistant) and redeploy.
