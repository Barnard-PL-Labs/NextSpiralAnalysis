// pages/404.jsx (or app/404.jsx if using App Router)

export default function NotFoundPage() {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0c0c0c',
        color: '#fff'
      }}>
        <h1 style={{ fontSize: '5rem' }}>404</h1>
        <p style={{ fontSize: '1.5rem' }}>Oops! Page not found.</p>
        <a href="/" style={{ marginTop: '1rem', color: '#0070f3' }}>← Go back home</a>
      </div>
    );
  }
  