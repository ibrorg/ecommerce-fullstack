import swaggerJSDoc from 'swagger-jsdoc';

/**
 * Swagger/OpenAPI configuration for API documentation
 */
export const swaggerConfig = (PORT: string | number) => {
  const options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'E-Commerce API',
        version: '1.0.0',
        description: 'Full-stack e-commerce platform API with admin & seller features'
      },
      servers: [
        {
          url: `http://localhost:${PORT}`,
          description: 'Development server'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      },
      security: [{ bearerAuth: [] }]
    },
    apis: ['./src/routes/*.ts']
  };

  return swaggerJSDoc(options);
};
