// Require the necessary modules
const fs = require('fs');
const http = require('http');
const path = require('path');

// Define the root directory to scan
const rootDir = path.join(__dirname, 'files');

// Create the HTTP server
const server = http.createServer((req, res) => {
  // Read all files in the root directory
  const files = fs.readdirSync(rootDir);

  // Prepare the HTML response
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        ul { list-style-type: none; padding: 0; }
        li { margin-bottom: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>File List</h1>
        <ul>
          ${files.map(file => `<li>${file}</li>`).join('')}
        </ul>
      </div>
    </body>
    </html>
  `;

  // Set the response headers
  res.writeHead(200, { 'Content-Type': 'text/html' });

  // Send the HTML response
  res.end(html);
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
