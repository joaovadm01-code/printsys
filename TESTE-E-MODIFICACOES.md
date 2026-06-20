# Roteiro De Teste Do PrintSys ERP/PDV

## Como Iniciar

1. Abra a pasta `printsys-erp`.
2. Dê dois cliques em `iniciar-printsys.bat`.
3. Aguarde aparecer a mensagem do servidor.
4. Dê dois cliques em `abrir-sistema.bat` ou abra no navegador:

```text
http://localhost:3000
```

## O Que Testar Primeiro

### 1. Dashboard

- Verifique as bolinhas verde, amarela e vermelha no topo.
- Confira o painel rápido.
- Veja se os alertas aparecem corretamente.

### 2. Orçamento

- Entre em `Orcamentos`.
- Escolha produtos como lona, adesivação, ACM, toldo, PVC ou metalon.
- Responda o questionário.
- Use `Simular preco antes de salvar`.
- Depois salve o orçamento.
- Aprove o orçamento para gerar O.S.

### 3. Ordem De Serviço

- Entre em `Ordem de Servico`.
- Atualize aprovação do cliente.
- Veja o histórico da O.S.
- Faça baixa de estoque.
- Gere ficha de produção.
- Confira o pós-cálculo.

### 4. PCP / Produção

- Entre em `PCP/Producao`.
- Vincule equipe de instalação a uma O.S.
- Registre etapa de produção.
- Teste envio para próximo setor.

### 5. Caixa / PDV

- Registre venda normal.
- Registre venda rápida sem O.S.
- Teste fechamento cego de caixa.

### 6. Produtos

- Cadastre produto com código interno.
- Edite ficha técnica.
- Confira se aparece no orçamento.

### 7. Questionários

- Entre em `Questionarios`.
- Adicione pergunta personalizada a um produto.
- Configure impacto de preço.
- Volte para orçamento e teste o cálculo.

### 8. Controle

- Veja alertas automáticos.
- Confira auditoria.
- Confira estoque de materiais.

### 9. Despesas operacionais

- Entre em `Financeiro`.
- Use `Despesas Operacionais`.
- Registre uma retirada de caixa com responsável, categoria, valor e data/hora.
- Vincule a uma O.S. quando for custo direto.
- Confira se entrou em DRE, resumo diário e pós-cálculo da O.S.
- Teste adiantamento para equipe e prestação de contas.
- Cadastre veículo e confira custo por veículo/instalação.

## Anotações Para Modificações

Use este espaço para registrar mudanças desejadas:

- [ ] Ajustar layout:
- [ ] Adicionar campo:
- [ ] Alterar regra de preço:
- [ ] Criar relatório:
- [ ] Melhorar fluxo:
- [ ] Corrigir comportamento:

## Observações Técnicas

Esta versão usa dados em memória. Ao reiniciar o servidor, os dados voltam ao estado inicial.

Para virar sistema definitivo, o próximo passo é ligar o backend ao PostgreSQL usando o arquivo:

```text
docs/schema.sql
```
