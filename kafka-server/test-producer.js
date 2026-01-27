const { Kafka, Partitioners } = require('kafkajs');

const run = async () => {
    const kafka = new Kafka({
        clientId: 'test-producer',
        brokers: ['localhost:9092'],
    });

    const producer = kafka.producer({
        createPartitioner: Partitioners.LegacyPartitioner,
    });

    await producer.connect();
    console.log('✅ Connected to Kafka');

    const message = {
        key: 'test-key',
        value: JSON.stringify({
            eventType: 'POST_CREATED',
            postId: '65b2f7a2e4b0a1c2d3e4f5a1', // Valid Hex
            authorId: '65b2f7a2e4b0a1c2d3e4f5b2', // Valid Hex
            followerIds: ['65b2f7a2e4b0a1c2d3e4f5c3'], // Valid Hex
            timestamp: new Date().toISOString(),
            postData: {
                content: 'Hello Kafka Newsfeed! This is a test message.',
                privacy: 'PUBLIC',
                mediaType: 'TEXT',
            }
        }),
    };

    console.log('Sending message...');
    await producer.send({
        topic: 'post-events',
        messages: [message],
    });

    console.log('✅ Message sent successfully');
    await producer.disconnect();
};

run().catch(console.error);
