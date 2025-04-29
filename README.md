Installation

Clone the repository

```
git clone https://github.com/Alcasni/NextSpiralAnalysis.git
cd spiral-analysis-tool
```

Install dependencies with either:

```
npm install
yarn install
```

Set up environment variables
Create a .env.local file in the root directory.
Add the following variables:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Run the development server

```
npm run dev
```

Note:
The code for the page is under src > app > {xxx} > page.jsx
The home page is page.jsx directly under app, meaningly src > app > page.jsx
Components contains of separate items that can just be imported or can be used in multiple pages, such as Header
Styles is the list of CSS for designed specifically in pages or components where it imports for styles from it, or otherwise it follow the styles in global.css under app