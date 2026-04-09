// Local development entry point.
// Vercel uses api/index.js directly as a serverless function.
require("dotenv").config();

const app = require("./api/index");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
