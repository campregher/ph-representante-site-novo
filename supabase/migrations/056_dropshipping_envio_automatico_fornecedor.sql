-- Envio automático do pacote combinado (etiquetas + planilha) pro fornecedor
-- assim que os pedidos ficam "pronto" (NF + etiqueta liberadas) — sem o
-- seller precisar baixar e mandar manual no WhatsApp. Só roda quando o
-- fornecedor tem e-mail cadastrado E um intervalo configurado aqui (null =
-- desativado, continua 100% manual como antes). `ultimo_em` é a trava
-- anti-spam: no máximo 1 lote a cada "intervalo_min" minutos por fornecedor.
alter table dropshipping.fornecedores
  add column if not exists envio_automatico_intervalo_min integer,
  add column if not exists envio_automatico_ultimo_em timestamptz;
