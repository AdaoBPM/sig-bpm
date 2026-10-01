import rateLimit from "express-rate-limit";

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  // Por e-mail: todo login chega pelo servidor do Next, com o mesmo IP, e contar
  // por IP bloquearia a empresa inteira. Login certo não conta.
  keyGenerator: (request) => String((request.body as { email?: unknown } | undefined)?.email ?? "").trim().toLowerCase() || "sem-email",
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Muitas tentativas de login. Tente novamente em alguns minutos.",
  },
});
