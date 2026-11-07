export function authed(req) {
  const pin = process.env.APP_PIN;
  if (!pin) return false;
  return req.headers.get('x-pin') === pin;
}
