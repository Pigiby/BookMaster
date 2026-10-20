// Consumes mail jobs from RabbitMQ and sends them with Nodemailer.
const amqp = require('amqplib');
const nodemailer = require('nodemailer');

const env = process.env;
const RABBITMQ_URL = env.RABBITMQ_URL || `amqp://${encodeURIComponent(env.RABBITMQ_USER || 'guest')}:` +
  `${encodeURIComponent(env.RABBITMQ_PASSWORD || 'guest')}@${env.RABBITMQ_HOST || 'rabbitmq:5672'}`;
const QUEUE = env.MAIL_QUEUE || 'mail';
const FROM = env.MAIL_FROM || `BookMaster <${env.MAIL_USER || 'noreply@bookmaster.local'}>`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createTransport() {
  if (env.MAIL_USER && env.MAIL_PASSWORD) {
    return nodemailer.createTransport({
      service: env.MAIL_SERVICE || 'gmail',
      auth: { user: env.MAIL_USER, pass: env.MAIL_PASSWORD },
    });
  }
  console.warn('MAIL_USER/MAIL_PASSWORD not set: emails are logged instead of sent.');
  return nodemailer.createTransport({ jsonTransport: true });
}

function welcomeEmail(to) {
  return {
    from: FROM,
    to,
    subject: 'Benvenuto su BookMaster',
    text: 'Benvenuto su BookMaster! BookMaster è la tua libreria digitale.',
    html: '<h1>Benvenuto su BookMaster</h1><p>BookMaster è la tua libreria digitale.</p>',
  };
}

async function connectWithRetry(attempts = 30) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await amqp.connect(RABBITMQ_URL);
    } catch (err) {
      if (attempt >= attempts) throw err;
      console.warn(`RabbitMQ not ready (${err.message}), retrying in 2s...`);
      await sleep(2000);
    }
  }
}

async function main() {
  const transporter = createTransport();
  const connection = await connectWithRetry();
  // Let Docker restart the container instead of trying to recover in-process.
  connection.on('close', () => {
    console.error('RabbitMQ connection closed, exiting.');
    process.exit(1);
  });

  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.prefetch(5);
  console.log(`Waiting for messages on queue "${QUEUE}"`);

  await channel.consume(QUEUE, async (msg) => {
    if (!msg) return;
    try {
      const job = JSON.parse(msg.content.toString());
      if (job.type !== 'welcome' || !job.email) throw new Error(`unknown job ${msg.content}`);
      const info = await transporter.sendMail(welcomeEmail(job.email));
      console.log(`Welcome email sent to ${job.email} (${info.messageId})`);
      channel.ack(msg);
    } catch (err) {
      console.error('Could not send email:', err.message);
      channel.nack(msg, false, false); // drop it rather than retrying forever
    }
  });

  const shutdown = () => connection.close().finally(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Mailer failed to start:', err);
  process.exit(1);
});
