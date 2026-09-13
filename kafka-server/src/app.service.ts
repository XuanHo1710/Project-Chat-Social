import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): { status: 'ok'; service: string } {
    return { status: 'ok', service: 'kafka-worker' };
  }
}
