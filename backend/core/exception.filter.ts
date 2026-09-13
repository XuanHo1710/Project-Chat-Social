import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | string[] = 'Internal server error';
        let error = null;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse();
            if (typeof res === 'string') {
                message = res;
            } else if (typeof res === 'object' && res !== null) {
                // NestJS thường trả về object { message, error, statusCode }
                message = (res as any).message || message;
                error = (res as any).error || null;
            }
        } else {
            const detail =
                exception instanceof Error ? exception.message : String(exception);
            const stack = exception instanceof Error ? exception.stack : undefined;
            this.logger.error(
                `${request.method} ${request.url} -> ${status}: ${detail}`,
                stack
            );
        }

        if (Array.isArray(message)) {
            message = message.join(', ');
        }

        response.status(status).json({
            statusCode: status,
            message,
            error,
            data: null,
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }
}