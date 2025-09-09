import { PeaqueRequest, PeaqueReply } from '@peaque/framework';

export async function GET(req: PeaqueRequest, reply: PeaqueReply) {
  // Get a specific cookie
  const userId = req.cookies.get('userId');
  const sessionToken = req.cookies.get('sessionToken');

  // Get all cookies
  const allCookies = req.cookies.getAll();

  reply.send({
    message: 'Cookie demo - GET',
    userId,
    sessionToken,
    allCookies
  });
}

export async function POST(req: PeaqueRequest, reply: PeaqueReply) {
  const { action, name, value } = req.body;

  if (action === 'set') {
    // Set a cookie
    req.cookies.set(name, value, {
      httpOnly: true,
      secure: true,
      maxAge: 3600, // 1 hour
      sameSite: 'strict'
    });
    reply.send({ message: `Cookie '${name}' set to '${value}'` });
  } else if (action === 'remove') {
    // Remove a cookie
    req.cookies.remove(name, {
      httpOnly: true,
      secure: true
    });
    reply.send({ message: `Cookie '${name}' removed` });
  } else {
    reply.code(400).send({ error: 'Invalid action. Use "set" or "remove"' });
  }
}
