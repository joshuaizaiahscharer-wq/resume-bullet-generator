// Local development entry point.
// Vercel uses api/index.js directly as a serverless function.
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
dotenv.config();

const app = require("./api/index");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
