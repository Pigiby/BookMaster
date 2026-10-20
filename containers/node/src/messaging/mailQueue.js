const amqp = require('amqplib');

// Publishes mail jobs to RabbitMQ; the mailer service consumes them.
// The connection is opened lazily and re-opened after it drops.
function createMailQueue({ url, queue }) {
  let pending = null; // Promise<{ connection, channel }>

  function connect() {
    if (!pending) {
      pending = (async () => {
        const connection = await amqp.connect(url);
        connection.on('error', () => {}); // 'close' follows and resets the connection
        connection.on('close', () => { pending = null; });
        const channel = await connection.createConfirmChannel();
        await channel.assertQueue(queue, { durable: true });
        return { connection, channel };
      })();
      pending.catch(() => { pending = null; });
    }
    return pending;
  }

  return {
    async sendWelcome(email) {
      const { channel } = await connect();
      const payload = Buffer.from(JSON.stringify({ type: 'welcome', email }));
      channel.sendToQueue(queue, payload, { persistent: true, contentType: 'application/json' });
      await channel.waitForConfirms(); // resolves once RabbitMQ has stored the message
    },

    async close() {
      if (!pending) return;
      const open = await pending.catch(() => null);
      if (open) await open.connection.close().catch(() => {});
    },
  };
}

module.exports = { createMailQueue };
