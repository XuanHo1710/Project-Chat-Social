import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Partitioners } from 'kafkajs';
import { KafkaProducerService } from './kafka-producer.service';

@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: 'KAFKA_SERVICE',
                imports: [ConfigModule],
                useFactory: async (configService: ConfigService) => ({
                    transport: Transport.KAFKA,
                    options: {
                        client: {
                            clientId: 'backend-producer',
                            brokers: [configService.get<string>('KAFKA_BROKER') || 'localhost:9092'],
                        },
                        producer: {
                            allowAutoTopicCreation: true,
                            createPartitioner: Partitioners.LegacyPartitioner,
                        },
                        // Ensure producer connects successfully
                        run: {
                            autoCommit: true,
                        },
                    },
                }),
                inject: [ConfigService],
            },
        ]),
    ],
    providers: [KafkaProducerService],
    exports: [KafkaProducerService],
})
export class KafkaModule { }
