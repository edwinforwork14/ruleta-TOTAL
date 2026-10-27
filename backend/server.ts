import "./env";
import express from "express";
import cors from "cors";
import { router } from "./app";

const app = express();
const port = process.env.PORT || 3001;

// CORS: en producción (Vercel) se configura con FRONTEND_ORIGIN.
// En desarrollo, permite localhost.
const frontendOrigin = process.env.FRONTEND_ORIGIN;
const allowedOrigins = frontendOrigin
	? frontendOrigin.split(",").map((o) => o.trim())
	: ["http://localhost:5177", "http://localhost:4173"];

app.use(
	cors({
		origin: allowedOrigins,
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "X-Operator-Password"],
	}),
);
app.use(express.json({ limit: "4mb" }));

// Mount the router at /api (frontend) and /api-ruleta (backwards compatibility).
app.use("/api", router);
app.use("/api-ruleta", router);

app.listen(port, () => {
  console.log(
    `Ruleta TOTAL backend server listening on http://localhost:${port}`,
  );
});