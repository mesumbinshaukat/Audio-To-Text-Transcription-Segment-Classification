export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ 
        fontFamily: 'system-ui, sans-serif', 
        background: '#f4f4f9', 
        color: '#333',
        display: 'flex',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        {children}
      </body>
    </html>
  );
}
