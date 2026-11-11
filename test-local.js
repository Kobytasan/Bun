// Тестовий запуск сервера з in-memory PostgreSQL (pg-mem)
const { newDb } = require('pg-mem');
const mem = newDb();
const pgmem = mem.adapters.createPg();
const Module = require('module');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'pg') return pgmem;
  return origLoad.apply(this, arguments);
};
process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
process.env.PORT = process.env.PORT || '3001';
require('./server.js');
