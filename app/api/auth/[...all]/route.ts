import { createAuthHandler } from "@/lib/auth";

export const GET = async (request: Request): Promise<Response> => {
  const handler = await createAuthHandler();
  return handler(request);
};

export const POST = GET;
