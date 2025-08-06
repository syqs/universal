import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),

  // Database (prepared for future PostgreSQL)
  DB_TYPE: Joi.string().default('sqlite'),
  DB_HOST: Joi.string().when('DB_TYPE', { is: 'postgres', then: Joi.required(), otherwise: Joi.optional() }),
  DB_PORT: Joi.number().when('DB_TYPE', { is: 'postgres', then: Joi.required(), otherwise: Joi.optional() }),
  DB_USERNAME: Joi.string().when('DB_TYPE', { is: 'postgres', then: Joi.required(), otherwise: Joi.optional() }),
  DB_PASSWORD: Joi.string().when('DB_TYPE', { is: 'postgres', then: Joi.required(), otherwise: Joi.optional() }),
  DB_DATABASE: Joi.string().default('data/db.sqlite'),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
});