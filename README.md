Project Overview
Editing the Code

You can update and maintain this project using any of the methods below.

1. Using a Local Development Environment

If you prefer working locally in your preferred IDE, clone the repository and push updates. This project uses Supabase for backend services; see `SUPABASE_MIGRATION.md` and the `supabase/` folder for configuration and deployment guidance.

Requirements: Node.js and npm (installing via nvm is recommended)

# Step 1: Clone the repository with your Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Enter the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install dependencies.
npm i

# Step 4: Start the development server with auto-reload.
npm run dev

3. Editing Directly on GitHub

Navigate to the file you want to modify.

Click the Edit (pencil) icon.

Apply your changes and commit them.

4. Using GitHub Codespaces

Open the main page of the repository.

Click Code → Codespaces.

Create a new Codespace.

Edit files directly and commit/push your changes when done.

Technologies Used

This project is built with:

Vite

TypeScript

React

shadcn-ui

Tailwind CSS

Deployment

For deployment, build the app with `npm run build` and host the generated `dist/` directory on your preferred static host (Netlify, Vercel, Cloudflare Pages, etc.). Backend services use Supabase — consult `SUPABASE_MIGRATION.md` for steps to connect and migrate data.

Custom Domain

Connect a custom domain using your host's domain settings once the site is deployed.
