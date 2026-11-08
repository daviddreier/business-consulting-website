export const SERVICES = Object.freeze([
  "Excel report design",
  "Power BI report design",
  "Data cleanup",
  "Business reporting",
  "Bookkeeping support",
]);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateQuote(input) {
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim();
  const service = String(input.service || "").trim();
  const message = String(input.message || "").trim();
  const gotcha = String(input.gotcha || "").trim();

  if (gotcha) {
    return {
      ok: false,
      errors: [{ field: "gotcha", message: "The form was not sent." }],
    };
  }

  const errors = [];
  if (!name || name.length > 100) {
    errors.push({ field: "name", message: "Enter your name (100 characters or fewer)." });
  }
  if (!EMAIL.test(email) || email.length > 200) {
    errors.push({ field: "email", message: "Enter an email address with a name and a domain." });
  }
  if (!SERVICES.includes(service)) {
    errors.push({ field: "service", message: "Choose a service from the list." });
  }
  if (message.length < 10 || message.length > 4000) {
    errors.push({ field: "message", message: "Enter a message of at least 10 characters." });
  }

  return {
    ok: errors.length === 0,
    errors,
    value: errors.length === 0 ? { name, email, service, message } : null,
  };
}
