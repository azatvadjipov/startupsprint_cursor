import serverless from "serverless-http";
import { createApp } from "../backend/src/app.js";

const app = createApp();

export default serverless(app);


