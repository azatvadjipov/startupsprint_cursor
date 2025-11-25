import serverless from "serverless-http";
import { createApp } from "../backend/dist/app.js";

const app = createApp();

export default serverless(app);


