import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import { env as zodEnv } from "@/config/env";

export default httpServerHandler({ port: parseInt(zodEnv.PORT) });