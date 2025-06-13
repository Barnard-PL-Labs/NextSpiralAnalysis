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
## Database setup:

Create 2 tables in Supabase named api_results and drawings.
To create drawings table
```
CREATE TABLE drawings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    username TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    drawing_data JSONB NOT NULL
);

```
To create api_results table
```
CREATE TABLE api_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    username TEXT,
    drawing_id UUID REFERENCES drawings(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    result_data JSONB NOT NULL
);

```

### Row-Level Security (RLS) Policies:
```
CREATE POLICY "Allow user to insert api_results"
ON public.api_results
FOR INSERT
WITH CHECK (
    auth.uid() = user_id
);

CREATE POLICY "Users can view their own api_results"
ON public.api_results
FOR SELECT
USING (
    auth.uid() = user_id
);
```
```
CREATE POLICY "Allow user to insert drawings"
ON public.drawings
FOR INSERT
WITH CHECK (
    auth.uid() = user_id
);

CREATE POLICY "Users can view their own drawings"
ON public.drawings
FOR SELECT
USING (
    auth.uid() = user_id
);
```
### Profiles:
```create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  bio text,
  avatar_path text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```
```
alter table profiles enable row level security;

create policy "Users can read their own profile" on profiles
for select using (auth.uid() = id);

create policy "Users can insert their own profile" on profiles
for insert with check (auth.uid() = id);

create policy "Users can update their own profile" on profiles
for update using (auth.uid() = id);
```
Then create a private bucket callled 'avatars' mannually and run folloing policy
```
-- Allow users to access only their own files
create policy "Users can access their own avatars"
  on storage.objects
  for all
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = split_part(name, '/', 1)  -- ensures folder is user ID
  );
```
Mannually key in these would be:
1.Going to Storage -> Policies 
2.Click New Policy for avatars
3.Select Full customization
4.Policy Name: Allow user to modify their own profile
  Allowed Operation: SELECT INSERT UPDATE
  Target Roles:authenticated
  Policy definition: ((bucket_id = 'avatars'::text) AND ((( SELECT auth.uid() AS uid))::text = split_part(name, '/'::text, 1)))
5.Click Review and save policy

### SuperUser function:
```
CREATE TABLE IF NOT EXISTS app_superusers (
  email TEXT PRIMARY KEY
);

CREATE OR REPLACE FUNCTION is_superuser() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM superusers
    WHERE email = auth.email()
  );
$$ LANGUAGE sql STABLE;

```
```
CREATE POLICY "Allow superuser or owner read access"
ON drawings
FOR SELECT
USING (
  user_id = auth.uid()
  OR is_superuser()
);
CREATE POLICY "Allow superuser or owner read access"
ON api_results
FOR SELECT
USING (
  user_id = auth.uid()
  OR is_superuser()
);

```
***Insert the email you want to set as superuser to app_superusers table***
```
INSERT INTO app_superusers (email)
VALUES
  ('admin@example.com'),
  ('superuser2@example.com'),
  ('superuser3@example.com');
```
***Set environment varible at vercel of NEXT_PUBLIC_SUPERUESERS with the email that you want to set as superuser if you deploy via vercel. If deployed locally, set it in .env.local file.***
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
