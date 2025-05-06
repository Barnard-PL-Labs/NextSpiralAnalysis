## Local Installation

Clone the repository

```
git clone https://github.com/Alcasni/NextSpiralAnalysis.git
cd NextSpiralAnalysis
```

Start a virtual environment

```bash
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate

# On macOS/Linux:
source venv/bin/activate

# To deactivate the virtual environment when you're done
deactivate
```

Install dependencies with either:

```
npm install

# Or using yarn
yarn install
```

Set up environment variables
Create a .env.local file in the root directory.
Add the following variables:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Or, to run without a db, just leave these blank or omit .env.local

Use the values for the `spiral-db-dev` supabase instance.
Only the values from `spiral-db-prod` for the deployment.

Then, to run the development server locally

```
npm run dev
```

Note:
The code for the page is under src > app > {xxx} > page.jsx
The home page is page.jsx directly under app, meaningly src > app > page.jsx
Components contains of separate items that can just be imported or can be used in multiple pages, such as Header
Styles is the list of CSS for designed specifically in pages or components where it imports for styles from it, or otherwise it follow the styles in global.css under app

## Deployment

To deploy, we use Vercel. Go to vercel and click deploy...

We use Supabase for the db. You need an account there too 
