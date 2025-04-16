# NextSpiralAnalysis

A Next.js application with Supabase integration for spiral analysis.

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Alcasni/NextSpiralAnalysis.git
cd spiral-analysis-tool
```

2. Install dependencies:
```bash
# Using npm
npm install

# Or using yarn
yarn install
```

3. Set up environment variables:
   - Create a `.env.local` file in the root directory
   - Add the following variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. Run the development server:
```bash
npm run dev
```

## Project Structure

- `src/app/page.jsx` - Home page
- `src/app/{xxx}/page.jsx` - Other pages
- `src/components/` - Reusable components (e.g., Header)
- `src/styles/` - CSS styles
  - `global.css` - Global styles
  - Page/component-specific styles

## Development

The application uses:
- Next.js for the frontend framework
- Supabase for backend services
- CSS for styling

Components are modular and can be imported across different pages. Styles can be either imported from the styles directory or follow the global.css configuration.