-- Webhook saliente por empresa: n8n recibe eventos de pedidos y manda WhatsApp.
alter table companies add column if not exists notify_webhook_url text;
